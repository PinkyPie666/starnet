import { describe, expect, it } from 'vitest';
import { EventBus } from '../src/core/bus';
import { Scheduler, type Runner } from '../src/core/scheduler';
import type { Events, Task } from '../src/core/types';

const OPTS = { mode: 'demo' as const, model: 'claude-haiku-4-5-20251001' as const };
const tick = () => new Promise((r) => setTimeout(r, 0));

/** A runner whose completion the test controls. */
function controllable() {
  const pending = new Map<string, { resolve: () => void; reject: (e: Error) => void; text: (s: string) => void }>();
  const runner =
    (task: Task): Runner =>
    (ctx) =>
      new Promise((resolve, reject) => {
        pending.set(task.id, { resolve: () => resolve({ input: 10, output: 20 }), reject, text: ctx.text });
        ctx.signal.addEventListener('abort', () => {
          const e = new Error('stopped');
          e.name = 'AbortError';
          reject(e);
        });
      });
  return { pending, runner };
}

function setup(max = 2, guard?: (t: Task) => string | null) {
  const bus = new EventBus<Events>();
  const c = controllable();
  const log: string[] = [];
  for (const e of ['task:start', 'task:done', 'task:error', 'task:stopped'] as const) bus.on(e, (t) => log.push(`${e}:${t.agentId}`));
  const s = new Scheduler({ bus, runner: c.runner, maxConcurrent: max, guard, scheduleFlush: (fn) => fn() });
  return { bus, s, log, ...c };
}

describe('Scheduler', () => {
  it('respects the global concurrency cap and drains the queue', async () => {
    const { s, pending } = setup(2);
    const t1 = s.submit('a', 'one', OPTS);
    const t2 = s.submit('b', 'two', OPTS);
    const t3 = s.submit('c', 'three', OPTS);
    expect(s.running).toBe(2);
    expect(t3.status).toBe('queued');
    pending.get(t1.id)!.resolve();
    await tick();
    expect(t1.status).toBe('done');
    expect(t3.status).toBe('running');
    pending.get(t2.id)!.resolve();
    pending.get(t3.id)!.resolve();
    await tick();
    expect(s.running).toBe(0);
  });

  it('runs at most one task per agent at a time', async () => {
    const { s, pending } = setup(4);
    const t1 = s.submit('a', 'one', OPTS);
    const t2 = s.submit('a', 'two', OPTS);
    expect(t1.status).toBe('running');
    expect(t2.status).toBe('queued');
    expect(s.isBusy('a')).toBe(true);
    pending.get(t1.id)!.resolve();
    await tick();
    expect(t2.status).toBe('running');
  });

  it('runs four agents concurrently', () => {
    const { s } = setup(6);
    const tasks = ['a', 'b', 'c', 'd'].map((id) => s.submit(id, 'x', OPTS));
    expect(tasks.every((t) => t.status === 'running')).toBe(true);
    expect(s.running).toBe(4);
  });

  it('streams text into the task and emits deltas and progress', async () => {
    const { s, pending, bus } = setup();
    const deltas: string[] = [];
    const progress: number[] = [];
    bus.on('task:delta', (d) => deltas.push(d.text));
    bus.on('task:progress', (p) => progress.push(p.progress));
    const t = s.submit('a', 'x', OPTS);
    pending.get(t.id)!.text('Hello ');
    pending.get(t.id)!.text('world');
    pending.get(t.id)!.resolve();
    await tick();
    expect(t.output).toBe('Hello world');
    expect(deltas.join('')).toBe('Hello world');
    expect(progress.length).toBeGreaterThan(0);
    expect(progress.every((p) => p >= 0 && p < 1)).toBe(true);
    expect(t.tokensIn).toBe(10);
    expect(t.tokensOut).toBe(20);
  });

  it('coalesces deltas until the flush runs', async () => {
    const bus = new EventBus<Events>();
    const c = controllable();
    const flushes: (() => void)[] = [];
    const s = new Scheduler({ bus, runner: c.runner, scheduleFlush: (fn) => flushes.push(fn) });
    const deltas: string[] = [];
    bus.on('task:delta', (d) => deltas.push(d.text));
    const t = s.submit('a', 'x', OPTS);
    c.pending.get(t.id)!.text('a');
    c.pending.get(t.id)!.text('b');
    c.pending.get(t.id)!.text('c');
    expect(deltas).toEqual([]);
    expect(flushes).toHaveLength(1);
    flushes[0]();
    expect(deltas).toEqual(['abc']);
  });

  it('stops a running task and frees the agent', async () => {
    const { s, log } = setup();
    const t = s.submit('a', 'x', OPTS);
    s.stop(t.id);
    await tick();
    expect(t.status).toBe('stopped');
    expect(s.isBusy('a')).toBe(false);
    expect(log).toContain('task:stopped:a');
  });

  it('stops a queued task without running it', () => {
    const { s } = setup(1);
    s.submit('a', 'x', OPTS);
    const queued = s.submit('b', 'y', OPTS);
    s.stop(queued.id);
    expect(queued.status).toBe('stopped');
    expect(queued.startedAt).toBeNull();
  });

  it('reports runner errors as task errors', async () => {
    const { s, pending } = setup();
    const t = s.submit('a', 'x', OPTS);
    pending.get(t.id)!.reject(new Error('Rate limited'));
    await tick();
    expect(t.status).toBe('error');
    expect(t.error).toBe('Rate limited');
  });

  it('refuses to start when the guard says no', () => {
    const { s, log } = setup(2, () => 'Daily token limit reached');
    const t = s.submit('a', 'x', OPTS);
    expect(t.status).toBe('error');
    expect(t.error).toMatch(/limit/);
    expect(log).toEqual(['task:error:a']);
  });

  it('chains a pipeline, feeding each output to the next step', async () => {
    const { s, pending, bus } = setup(4);
    const updates: string[] = [];
    bus.on('pipeline:update', (p) => updates.push(p.status));
    const p = s.pipeline(['r', 's', 'w'], 'launch plan', () => OPTS);
    const step0 = s.tasks.get(p.taskIds[0])!;
    pending.get(step0.id)!.text('research notes');
    pending.get(step0.id)!.resolve();
    await tick();
    const step1 = s.tasks.get(p.taskIds[1])!;
    expect(step1.agentId).toBe('s');
    expect(step1.input).toBe('research notes');
    expect(step1.step).toBe(1);
    pending.get(step1.id)!.text('strategy');
    pending.get(step1.id)!.resolve();
    await tick();
    const step2 = s.tasks.get(p.taskIds[2])!;
    expect(step2.input).toBe('strategy');
    pending.get(step2.id)!.resolve();
    await tick();
    expect(p.status).toBe('done');
    expect(updates.at(-1)).toBe('done');
  });

  it('marks a pipeline failed when a step errors and does not continue', async () => {
    const { s, pending } = setup(4);
    const p = s.pipeline(['r', 's'], 'x', () => OPTS);
    pending.get(p.taskIds[0])!.reject(new Error('bad key'));
    await tick();
    expect(p.status).toBe('failed');
    expect(p.taskIds).toHaveLength(1);
  });

  it('stopAll stops running and queued work', async () => {
    const { s } = setup(1);
    const a = s.submit('a', 'x', OPTS);
    const b = s.submit('b', 'y', OPTS);
    s.stopAll();
    await tick();
    expect(a.status).toBe('stopped');
    expect(b.status).toBe('stopped');
    expect(s.running).toBe(0);
  });
});
