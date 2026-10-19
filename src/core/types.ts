export type ClassId = 'researcher' | 'strategist' | 'coder' | 'copywriter' | 'reviewer' | 'ops';

export type AgentStatus = 'IDLE' | 'WORKING' | 'DONE' | 'ERROR';

export type ModelId = 'claude-haiku-4-5-20251001' | 'claude-sonnet-5-5' | 'claude-haiku-5-5';

export interface Look {
  body: 'a' | 'b';
  skin: number; // index into SKIN_TONES
  hair: number; // index into HAIR_COLORS
  hairStyle: number; // 0 short, 1 long, 2 crest, 3 shaved
  uniform: number; // index into UNIFORMS
}

export interface Agent {
  id: string;
  name: string;
  cls: ClassId;
  level: number;
  xp: number;
  model: ModelId;
  look: Look;
  status: AgentStatus;
  progress: number; // 0..1
  taskId: string | null;
  lastError: string | null;
  createdAt: number;
}

export type TaskStatus = 'queued' | 'running' | 'done' | 'stopped' | 'error';

export interface Task {
  id: string;
  agentId: string;
  prompt: string;
  input: string | null; // upstream output in a pipeline
  pipelineId: string | null;
  step: number;
  status: TaskStatus;
  output: string;
  error: string | null;
  mode: 'demo' | 'live';
  model: ModelId;
  tokensIn: number;
  tokensOut: number;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
}

export interface Result {
  id: string;
  taskId: string;
  agentId: string;
  agentName: string;
  cls: ClassId;
  title: string;
  content: string;
  pipelineId: string | null;
  mode: 'demo' | 'live';
  createdAt: number;
  read: boolean;
}

export interface Pipeline {
  id: string;
  prompt: string;
  steps: string[]; // agent ids in order
  taskIds: string[];
  status: 'running' | 'done' | 'failed' | 'stopped';
  createdAt: number;
}

export interface Settings {
  mode: 'demo' | 'live';
  dailyTokenLimit: number;
  maxOutputTokens: number;
  crt: boolean;
  autopilot: boolean;
}

export interface RunUsage {
  input: number;
  output: number;
}

export interface Events extends Record<string, unknown> {
  'agent:add': Agent;
  'agent:update': Agent;
  'agent:remove': { id: string };
  'task:queued': Task;
  'task:start': Task;
  'task:delta': { taskId: string; agentId: string; text: string };
  'task:progress': { taskId: string; agentId: string; progress: number };
  'task:done': Task;
  'task:error': Task;
  'task:stopped': Task;
  'result:add': Result;
  'result:update': Result;
  'pipeline:update': Pipeline;
  'spend:update': { used: number; limit: number };
  'settings:update': Settings;
  'ui:select': { agentId: string | null };
  'ui:open': { panel: PanelId; arg?: string };
  'world:delivered': { agentId: string; resultId: string };
  'world:ready': undefined;
  'toast': { kind: 'info' | 'ok' | 'warn' | 'error'; text: string };
}

export type PanelId = 'task' | 'outbox' | 'recruit' | 'pipeline' | 'settings' | 'result' | 'agent' | 'help';
