// App state: crew, results, pipelines and settings, persisted to IndexedDB.
// The store reacts to scheduler events on the bus and keeps agents in sync.

import { EventBus } from './bus';
import { dbGet, dbSet } from './db';
import type { Agent, ClassId, Events, Look, ModelId, Pipeline, Result, Settings, Task } from './types';
import { CLASSES, DEFAULT_MODEL, xpForLevel } from '../agents/classes';

export const bus = new EventBus<Events>();

const SAVE_KEY = 'state.v1';

export const DEFAULT_SETTINGS: Settings = {
  mode: 'demo',
  dailyTokenLimit: 200_000,
  maxOutputTokens: 2048,
  crt: true,
  autopilot: true,
};

interface Saved {
  agents: Agent[];
  results: Result[];
  pipelines: Pipeline[];
  tasks: Task[];
  settings: Settings;
}

export const state = {
  agents: [] as Agent[],
  results: [] as Result[],
  pipelines: [] as Pipeline[],
  tasks: [] as Task[], // recent history, newest last
  settings: { ...DEFAULT_SETTINGS },
  loaded: false,
};

let uid = 0;
export const newId = (p: string) => `${p}-${Date.now().toString(36)}${(uid++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

const STARTERS: { name: string; cls: ClassId; look: Look }[] = [
  { name: 'NOVA', cls: 'researcher', look: { body: 'b', skin: 1, hair: 4, hairStyle: 1, uniform: 0 } },
  { name: 'ROOK', cls: 'strategist', look: { body: 'a', skin: 3, hair: 0, hairStyle: 0, uniform: 1 } },
  { name: 'BYTE', cls: 'coder', look: { body: 'a', skin: 0, hair: 2, hairStyle: 2, uniform: 2 } },
  { name: 'LYRA', cls: 'copywriter', look: { body: 'b', skin: 2, hair: 5, hairStyle: 1, uniform: 3 } },
  { name: 'VEX', cls: 'reviewer', look: { body: 'a', skin: 4, hair: 1, hairStyle: 3, uniform: 4 } },
  { name: 'HEX', cls: 'ops', look: { body: 'b', skin: 1, hair: 3, hairStyle: 0, uniform: 5 } },
];

export function makeAgent(name: string, cls: ClassId, look: Look, model: ModelId = DEFAULT_MODEL): Agent {
  return {
    id: newId('ag'),
    name: name.toUpperCase().slice(0, 12),
    cls,
    level: 1,
    xp: 0,
    model,
    look,
    status: 'IDLE',
    progress: 0,
    taskId: null,
    lastError: null,
    createdAt: Date.now(),
  };
}

export function starterCrew(): Agent[] {
  return STARTERS.map((s) => makeAgent(s.name, s.cls, s.look));
}

export function getAgent(id: string): Agent | undefined {
  return state.agents.find((a) => a.id === id);
}

export function updateAgent(id: string, patch: Partial<Agent>): Agent | undefined {
  const a = getAgent(id);
  if (!a) return;
  Object.assign(a, patch);
  bus.emit('agent:update', a);
  save();
  return a;
}

export function addAgent(a: Agent): void {
  state.agents.push(a);
  bus.emit('agent:add', a);
  save();
}

export function removeAgent(id: string): void {
  state.agents = state.agents.filter((a) => a.id !== id);
  bus.emit('agent:remove', { id });
  save();
}

export function updateSettings(patch: Partial<Settings>): void {
  Object.assign(state.settings, patch);
  bus.emit('settings:update', state.settings);
  save();
}

export function markRead(resultId: string): void {
  const r = state.results.find((x) => x.id === resultId);
  if (r && !r.read) {
    r.read = true;
    bus.emit('result:update', r);
    save();
  }
}

export function deleteResult(resultId: string): void {
  state.results = state.results.filter((r) => r.id !== resultId);
  save();
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
export function save(): void {
  if (!state.loaded) return;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const data: Saved = {
      agents: state.agents.map((a) => ({ ...a })),
      results: state.results.slice(-200),
      pipelines: state.pipelines.slice(-50),
      tasks: state.tasks.slice(-100).map((t) => ({ ...t })),
      settings: state.settings,
    };
    void dbSet(SAVE_KEY, data);
  }, 400);
}

export async function load(): Promise<void> {
  const saved = await dbGet<Saved>(SAVE_KEY);
  if (saved && Array.isArray(saved.agents) && saved.agents.length) {
    state.agents = saved.agents.map((a) => ({
      ...a,
      // anything mid-flight when the tab closed is gone; reset to a clean state
      status: a.status === 'WORKING' ? 'IDLE' : a.status === 'DONE' ? 'IDLE' : a.status,
      progress: a.status === 'WORKING' ? 0 : a.progress,
      taskId: null,
    }));
    state.results = saved.results ?? [];
    state.pipelines = (saved.pipelines ?? []).map((p) => (p.status === 'running' ? { ...p, status: 'stopped' } : p));
    state.tasks = (saved.tasks ?? []).map((t) =>
      t.status === 'running' || t.status === 'queued' ? { ...t, status: 'stopped', error: 'Interrupted by page reload' } : t,
    );
    state.settings = { ...DEFAULT_SETTINGS, ...saved.settings };
  } else {
    state.agents = starterCrew();
  }
  state.loaded = true;
  save();
}

function rememberTask(t: Task) {
  const i = state.tasks.findIndex((x) => x.id === t.id);
  if (i >= 0) state.tasks[i] = t;
  else state.tasks.push(t);
  if (state.tasks.length > 150) state.tasks.splice(0, state.tasks.length - 150);
}

function titleFor(t: Task): string {
  const firstHeading = t.output.match(/^#\s+(.+)$/m)?.[1];
  const base = firstHeading ?? t.prompt;
  const clean = base.replace(/[*_`#>]/g, '').trim();
  return clean.length > 60 ? clean.slice(0, 57) + '...' : clean || 'Untitled';
}

// --- wire scheduler events into agent state -------------------------------

const idleTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleIdle(agentId: string, ms: number) {
  clearTimeout(idleTimers.get(agentId));
  idleTimers.set(
    agentId,
    setTimeout(() => {
      const a = getAgent(agentId);
      if (a && (a.status === 'DONE' || a.status === 'ERROR')) updateAgent(agentId, { status: 'IDLE', progress: 0 });
    }, ms),
  );
}

bus.on('task:queued', (t) => {
  rememberTask(t);
});

bus.on('task:start', (t) => {
  rememberTask(t);
  clearTimeout(idleTimers.get(t.agentId));
  updateAgent(t.agentId, { status: 'WORKING', progress: 0, taskId: t.id, lastError: null });
});

bus.on('task:progress', ({ agentId, progress }) => {
  const a = getAgent(agentId);
  if (a && a.status === 'WORKING') {
    a.progress = progress;
    bus.emit('agent:update', a);
  }
});

bus.on('task:done', (t) => {
  rememberTask(t);
  const a = getAgent(t.agentId);
  if (!a) return;
  // XP: a flat bonus plus a little per output token, capped per task
  let xp = a.xp + 30 + Math.min(70, Math.round(t.tokensOut / 20));
  let level = a.level;
  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level++;
    bus.emit('toast', { kind: 'ok', text: `${a.name} reached level ${level}` });
  }
  updateAgent(a.id, { status: 'DONE', progress: 1, xp, level, taskId: null });
  const result: Result = {
    id: newId('res'),
    taskId: t.id,
    agentId: a.id,
    agentName: a.name,
    cls: a.cls,
    title: titleFor(t),
    content: t.output,
    pipelineId: t.pipelineId,
    mode: t.mode,
    createdAt: Date.now(),
    read: false,
  };
  state.results.push(result);
  bus.emit('result:add', result);
  save();
  scheduleIdle(a.id, 15000);
});

bus.on('world:delivered', ({ agentId }) => scheduleIdle(agentId, 600));

bus.on('task:error', (t) => {
  rememberTask(t);
  const a = getAgent(t.agentId);
  if (!a) return;
  updateAgent(a.id, { status: 'ERROR', lastError: t.error, taskId: null });
  bus.emit('toast', { kind: 'error', text: `${a.name}: ${t.error}` });
  scheduleIdle(a.id, 20000);
});

bus.on('task:stopped', (t) => {
  rememberTask(t);
  const a = getAgent(t.agentId);
  if (!a) return;
  updateAgent(a.id, { status: 'IDLE', progress: 0, taskId: null });
});

bus.on('pipeline:update', (p) => {
  const i = state.pipelines.findIndex((x) => x.id === p.id);
  if (i >= 0) state.pipelines[i] = { ...p };
  else state.pipelines.push({ ...p });
  save();
});

export function classOf(a: Agent) {
  return CLASSES[a.cls];
}
