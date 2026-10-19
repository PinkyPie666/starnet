// Wires the scheduler to the store, the demo/live runners and the spend guard.

import { Scheduler } from './core/scheduler';
import { bus, getAgent, state } from './core/store';
import type { Task } from './core/types';
import { demoRunner } from './agents/demo';
import { liveRunner } from './agents/live';
import { addUsage, canSpend, usedToday } from './agents/spend';

// tokens reserved by live tasks that are still running
const reserved = new Map<string, number>();

export const scheduler = new Scheduler({
  bus,
  maxConcurrent: 6,
  runner: (task: Task) => {
    const agent = getAgent(task.agentId);
    const cls = agent?.cls ?? 'researcher';
    return task.mode === 'live' ? liveRunner(cls, state.settings.maxOutputTokens) : demoRunner(cls);
  },
  guard: (task) => {
    if (task.mode !== 'live') return null;
    const estimateIn = Math.ceil((task.prompt.length + (task.input?.length ?? 0)) / 3.5) + 600;
    const projected = estimateIn + state.settings.maxOutputTokens;
    const inFlight = [...reserved.values()].reduce((a, b) => a + b, 0);
    if (!canSpend(state.settings.dailyTokenLimit, projected + inFlight)) {
      return `ถึงเพดานโทเคนรายวันแล้ว (ใช้ไป ${usedToday().toLocaleString()} จาก ${state.settings.dailyTokenLimit.toLocaleString()}) เพิ่มเพดานได้ในหน้าตั้งค่า หรือรอพรุ่งนี้`;
    }
    reserved.set(task.id, projected);
    return null;
  },
  onUsage: (task, usage) => {
    if (task.mode !== 'live') return;
    const used = addUsage(usage.input + usage.output);
    bus.emit('spend:update', { used, limit: state.settings.dailyTokenLimit });
  },
});

for (const evt of ['task:done', 'task:error', 'task:stopped'] as const) {
  bus.on(evt, (t) => reserved.delete(t.id));
}

export function assignTask(agentId: string, prompt: string, input: string | null = null): Task | null {
  const agent = getAgent(agentId);
  if (!agent || !prompt.trim()) return null;
  if (scheduler.isBusy(agentId)) {
    bus.emit('toast', { kind: 'warn', text: `${agent.name} ยังทำงานอื่นอยู่ งานนี้จะต่อคิวไว้ก่อน` });
  }
  return scheduler.submit(agentId, prompt.trim(), { mode: state.settings.mode, model: agent.model, input });
}

export function runPipeline(agentIds: string[], prompt: string) {
  return scheduler.pipeline(agentIds, prompt.trim(), (id) => ({ mode: state.settings.mode, model: getAgent(id)?.model ?? 'claude-haiku-4-5-20251001' }));
}

export function stopAgent(agentId: string) {
  scheduler.stopAgent(agentId);
}

export function stopAll() {
  scheduler.stopAll();
}
