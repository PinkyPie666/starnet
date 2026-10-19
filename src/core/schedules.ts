// Recurring tasks that run while the tab is open ("every morning at 8:00").
// Stored in localStorage; the due check is pure so it is unit-tested.

export type Repeat = { kind: 'daily'; time: string } | { kind: 'hourly'; every: number };

export interface Schedule {
  id: string;
  agentId: string;
  prompt: string;
  input: string | null;
  repeat: Repeat;
  enabled: boolean;
  lastRun: number | null;
  createdAt: number;
}

const KEY = 'starnet.schedules';

/** The next time this schedule should fire, strictly after `after`. */
export function nextRun(s: Schedule, after: number): number {
  if (s.repeat.kind === 'hourly') {
    const step = Math.max(1, s.repeat.every) * 3600_000;
    return (s.lastRun ?? s.createdAt) + step <= after ? after : (s.lastRun ?? s.createdAt) + step;
  }
  const [hh, mm] = s.repeat.time.split(':').map(Number);
  const d = new Date(after);
  d.setHours(hh || 0, mm || 0, 0, 0);
  if (d.getTime() <= after) d.setDate(d.getDate() + 1);
  return d.getTime();
}

/** True when the schedule has a slot between its last run and now. */
export function isDue(s: Schedule, now: number): boolean {
  if (!s.enabled) return false;
  const since = s.lastRun ?? s.createdAt;
  if (s.repeat.kind === 'hourly') return now - since >= Math.max(1, s.repeat.every) * 3600_000;
  return nextRun(s, since) <= now;
}

export function loadSchedules(): Schedule[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Schedule[];
  } catch {
    return [];
  }
}

export function saveSchedules(list: Schedule[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function describeRepeat(r: Repeat): string {
  return r.kind === 'daily' ? `ทุกวัน เวลา ${r.time}` : `ทุก ${r.every} ชั่วโมง`;
}

/** Checks every 30 s and calls `run` for each due schedule. */
export function startScheduleTicker(run: (s: Schedule) => boolean) {
  const tick = () => {
    const list = loadSchedules();
    const now = Date.now();
    let changed = false;
    for (const s of list) {
      if (isDue(s, now) && run(s)) {
        s.lastRun = now;
        changed = true;
      }
    }
    if (changed) saveSchedules(list);
  };
  setTimeout(tick, 5000);
  setInterval(tick, 30_000);
}
