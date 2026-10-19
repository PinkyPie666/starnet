import { describe, expect, it } from 'vitest';
import { isDue, type Schedule } from '../src/core/schedules';
import { collectFiles } from '../src/agents/live';

const at = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();
const base = (repeat: Schedule['repeat'], lastRun: number | null, createdAt: number): Schedule => ({
  id: 's',
  agentId: 'a',
  prompt: 'x',
  input: null,
  repeat,
  enabled: true,
  lastRun,
  createdAt,
});

describe('schedules', () => {
  it('daily: waits until the set time, then fires once', () => {
    const s = base({ kind: 'daily', time: '08:00' }, at(2026, 10, 19, 9), at(2026, 10, 19, 9));
    expect(isDue(s, at(2026, 10, 20, 7, 59))).toBe(false);
    expect(isDue(s, at(2026, 10, 20, 8, 0))).toBe(true);
    s.lastRun = at(2026, 10, 20, 8, 0);
    expect(isDue(s, at(2026, 10, 20, 12))).toBe(false);
  });

  it('daily: a missed day runs once when the tab comes back', () => {
    const s = base({ kind: 'daily', time: '08:00' }, at(2026, 10, 17, 8), at(2026, 10, 1, 0));
    expect(isDue(s, at(2026, 10, 20, 15))).toBe(true);
  });

  it('hourly: fires after the interval', () => {
    const s = base({ kind: 'hourly', every: 6 }, at(2026, 10, 19, 0), at(2026, 10, 19, 0));
    expect(isDue(s, at(2026, 10, 19, 5, 59))).toBe(false);
    expect(isDue(s, at(2026, 10, 19, 6))).toBe(true);
  });

  it('disabled schedules never fire', () => {
    const s = base({ kind: 'hourly', every: 1 }, null, 0);
    s.enabled = false;
    expect(isDue(s, Date.now())).toBe(false);
  });
});

describe('collectFiles', () => {
  it('finds sandbox output files in nested tool results, once each', () => {
    const content = [
      { type: 'text', text: 'done' },
      { type: 'bash_code_execution_tool_result', content: { type: 'bash_code_execution_result', content: [{ type: 'bash_code_execution_output', file_id: 'file_1' }] } },
      { type: 'bash_code_execution_tool_result', content: { content: [{ file_id: 'file_1' }, { file_id: 'file_2' }] } },
    ];
    const out: { id: string; name: string }[] = [];
    collectFiles(content, out);
    expect(out.map((f) => f.id)).toEqual(['file_1', 'file_2']);
  });
});
