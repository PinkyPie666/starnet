// Daily token guard for Live mode. Counts input + output tokens per local day.
// Kept in localStorage so it survives reloads; it is a convenience guard, not a
// billing system, so a cleared browser simply starts a fresh day.

const KEY = 'starnet.spend';

interface SpendRecord {
  day: string;
  used: number;
}

export function today(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function read(): SpendRecord {
  try {
    const raw = localStorage.getItem(KEY);
    const rec = raw ? (JSON.parse(raw) as SpendRecord) : null;
    if (rec && rec.day === today()) return rec;
  } catch {
    /* storage unavailable */
  }
  return { day: today(), used: 0 };
}

let mem: SpendRecord | null = null;

export function usedToday(): number {
  mem = read();
  return mem.used;
}

export function addUsage(tokens: number): number {
  const rec = read();
  rec.used += Math.max(0, Math.round(tokens));
  mem = rec;
  try {
    localStorage.setItem(KEY, JSON.stringify(rec));
  } catch {
    /* ignore */
  }
  return rec.used;
}

export function resetSpend(): void {
  mem = { day: today(), used: 0 };
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Reserve-style check: refuse to start when the projected worst case would exceed the limit. */
export function canSpend(limit: number, projected: number): boolean {
  return usedToday() + projected <= limit;
}
