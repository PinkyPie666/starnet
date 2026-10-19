// Task scheduler. Owns the queue, per-agent busy state, the global
// concurrency cap and pipeline chaining. It knows nothing about the network or
// the UI: the runner is injected and every state change is announced on the bus.

import type { EventBus } from './bus';
import type { Events, ModelId, Pipeline, RunUsage, Task } from './types';

export interface RunContext {
  task: Task;
  signal: AbortSignal;
  /** Append streamed text. */
  text(chunk: string): void;
  /** Optional exact progress (0..1); otherwise it is estimated from length. */
  progress(p: number): void;
}

export type Runner = (ctx: RunContext) => Promise<RunUsage>;

export interface SchedulerOptions {
  bus: EventBus<Events>;
  runner: (task: Task) => Runner;
  maxConcurrent?: number;
  /** Return an error message to refuse starting a task (for example the spend guard). */
  guard?: (task: Task) => string | null;
  /** Called after a task finishes with the tokens it used. */
  onUsage?: (task: Task, usage: RunUsage) => void;
  now?: () => number;
  makeId?: () => string;
  /** How stream deltas are coalesced before hitting the bus. */
  scheduleFlush?: (fn: () => void) => void;
}

export interface SubmitOptions {
  input?: string | null;
  pipelineId?: string | null;
  step?: number;
  mode: 'demo' | 'live';
  model: ModelId;
}

let counter = 0;
const defaultId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

function defaultFlush(fn: () => void) {
  const hidden = typeof document !== 'undefined' && document.hidden;
  if (!hidden && typeof requestAnimationFrame === 'function') requestAnimationFrame(fn);
  else setTimeout(fn, hidden ? 250 : 16);
}

class AbortedError extends Error {
  constructor() {
    super('stopped');
    this.name = 'AbortError';
  }
}

export class Scheduler {
  readonly tasks = new Map<string, Task>();
  readonly pipelines = new Map<string, Pipeline>();
  private queue: string[] = [];
  private busy = new Set<string>(); // agent ids
  private controllers = new Map<string, AbortController>();
  private pending = new Map<string, string>(); // taskId -> unflushed text
  private flushQueued = false;
  maxConcurrent: number;

  constructor(private opts: SchedulerOptions) {
    this.maxConcurrent = opts.maxConcurrent ?? 6;
  }

  private now() {
    return this.opts.now ? this.opts.now() : Date.now();
  }
  private id() {
    return this.opts.makeId ? this.opts.makeId() : defaultId();
  }

  get running(): number {
    return this.controllers.size;
  }

  isBusy(agentId: string): boolean {
    return this.busy.has(agentId) || this.queue.some((id) => this.tasks.get(id)?.agentId === agentId);
  }

  queued(): Task[] {
    return this.queue.map((id) => this.tasks.get(id)!).filter(Boolean);
  }

  submit(agentId: string, prompt: string, o: SubmitOptions): Task {
    const task: Task = {
      id: this.id(),
      agentId,
      prompt,
      input: o.input ?? null,
      pipelineId: o.pipelineId ?? null,
      step: o.step ?? 0,
      status: 'queued',
      output: '',
      error: null,
      mode: o.mode,
      model: o.model,
      tokensIn: 0,
      tokensOut: 0,
      createdAt: this.now(),
      startedAt: null,
      finishedAt: null,
    };
    this.tasks.set(task.id, task);
    this.queue.push(task.id);
    this.opts.bus.emit('task:queued', task);
    this.pump();
    return task;
  }

  /** Chain agents: each step receives the previous step's output. */
  pipeline(agentIds: string[], prompt: string, o: (agentId: string) => SubmitOptions): Pipeline {
    if (agentIds.length === 0) throw new Error('pipeline needs at least one agent');
    const p: Pipeline = {
      id: this.id(),
      prompt,
      steps: [...agentIds],
      taskIds: [],
      status: 'running',
      createdAt: this.now(),
    };
    this.pipelines.set(p.id, p);
    this.pipelineOpts.set(p.id, o);
    const first = this.submit(agentIds[0], prompt, { ...o(agentIds[0]), pipelineId: p.id, step: 0 });
    p.taskIds.push(first.id);
    this.opts.bus.emit('pipeline:update', p);
    return p;
  }
  private pipelineOpts = new Map<string, (agentId: string) => SubmitOptions>();

  stop(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    if (task.status === 'queued') {
      this.queue = this.queue.filter((id) => id !== taskId);
      this.finish(task, 'stopped', null);
      this.pump();
      return;
    }
    this.controllers.get(taskId)?.abort();
  }

  stopAgent(agentId: string): void {
    for (const t of this.tasks.values()) {
      if (t.agentId === agentId && (t.status === 'running' || t.status === 'queued')) this.stop(t.id);
    }
  }

  stopAll(): void {
    for (const t of [...this.tasks.values()]) {
      if (t.status === 'running' || t.status === 'queued') this.stop(t.id);
    }
  }

  private pump(): void {
    if (this.running >= this.maxConcurrent) return;
    for (let i = 0; i < this.queue.length && this.running < this.maxConcurrent; ) {
      const task = this.tasks.get(this.queue[i])!;
      if (this.busy.has(task.agentId)) {
        i++;
        continue;
      }
      this.queue.splice(i, 1);
      this.start(task);
    }
  }

  private start(task: Task): void {
    const refusal = this.opts.guard?.(task) ?? null;
    if (refusal) {
      this.finish(task, 'error', refusal);
      return;
    }
    const ac = new AbortController();
    this.controllers.set(task.id, ac);
    this.busy.add(task.agentId);
    task.status = 'running';
    task.startedAt = this.now();
    this.opts.bus.emit('task:start', task);

    let exact = -1;
    this.progressOf.set(task.id, () => (exact >= 0 ? exact : 1 - Math.exp(-task.output.length / 1800)));
    const ctx: RunContext = {
      task,
      signal: ac.signal,
      text: (chunk) => {
        if (ac.signal.aborted || !chunk) return;
        task.output += chunk;
        this.pending.set(task.id, (this.pending.get(task.id) ?? '') + chunk);
        this.queueFlush();
      },
      progress: (p) => {
        exact = Math.max(0, Math.min(1, p));
      },
    };

    let run: Promise<RunUsage>;
    try {
      run = this.opts.runner(task)(ctx);
    } catch (err) {
      run = Promise.reject(err);
    }
    run.then(
      (usage) => {
        if (ac.signal.aborted) throw new AbortedError();
        task.tokensIn = usage.input;
        task.tokensOut = usage.output;
        this.opts.onUsage?.(task, usage);
        this.flushNow();
        this.finish(task, 'done', null);
      },
    ).catch((err: unknown) => {
      this.flushNow();
      if (ac.signal.aborted || (err as Error)?.name === 'AbortError') this.finish(task, 'stopped', null);
      else this.finish(task, 'error', describeError(err));
    });
  }

  private progressOf = new Map<string, () => number>();
  private queueFlush() {
    if (this.flushQueued) return;
    this.flushQueued = true;
    (this.opts.scheduleFlush ?? defaultFlush)(() => this.flushNow());
  }

  private flushNow() {
    this.flushQueued = false;
    for (const [taskId, text] of this.pending) {
      const task = this.tasks.get(taskId);
      if (!task) continue;
      this.opts.bus.emit('task:delta', { taskId, agentId: task.agentId, text });
      const p = this.progressOf.get(taskId)?.() ?? 0;
      this.opts.bus.emit('task:progress', { taskId, agentId: task.agentId, progress: Math.min(0.97, p) });
    }
    this.pending.clear();
  }

  private finish(task: Task, status: 'done' | 'stopped' | 'error', error: string | null) {
    task.status = status;
    task.error = error;
    task.finishedAt = this.now();
    this.controllers.delete(task.id);
    this.busy.delete(task.agentId);
    this.pending.delete(task.id);
    this.progressOf.delete(task.id);
    const evt = status === 'done' ? 'task:done' : status === 'error' ? 'task:error' : 'task:stopped';
    this.opts.bus.emit(evt, task);
    if (task.pipelineId) this.advancePipeline(task);
    this.pump();
  }

  private advancePipeline(task: Task) {
    const p = this.pipelines.get(task.pipelineId!);
    if (!p || p.status !== 'running') return;
    if (task.status !== 'done') {
      p.status = task.status === 'stopped' ? 'stopped' : 'failed';
      this.opts.bus.emit('pipeline:update', p);
      return;
    }
    const nextStep = task.step + 1;
    if (nextStep >= p.steps.length) {
      p.status = 'done';
      this.opts.bus.emit('pipeline:update', p);
      return;
    }
    const agentId = p.steps[nextStep];
    const o = this.pipelineOpts.get(p.id)!;
    const next = this.submit(agentId, p.prompt, { ...o(agentId), input: task.output, pipelineId: p.id, step: nextStep });
    p.taskIds.push(next.id);
    this.opts.bus.emit('pipeline:update', p);
  }
}

export function describeError(err: unknown): string {
  if (err instanceof Error) return err.message || err.name;
  if (typeof err === 'string') return err;
  return 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
}
