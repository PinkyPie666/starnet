// 4-directional A* on a tile grid with a binary heap open set.

export interface Pt {
  x: number;
  y: number;
}

export function findPath(
  w: number,
  h: number,
  passable: (x: number, y: number) => boolean,
  from: Pt,
  to: Pt,
  maxNodes = 4000,
): Pt[] | null {
  if (from.x === to.x && from.y === to.y) return [];
  if (!passable(to.x, to.y)) return null;
  const N = w * h;
  const g = new Float32Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const heap: number[] = [];
  const f = new Float32Array(N);
  const hfn = (i: number) => Math.abs((i % w) - to.x) + Math.abs(((i / w) | 0) - to.y);
  const push = (i: number) => {
    heap.push(i);
    let c = heap.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (f[heap[p]] <= f[heap[c]]) break;
      [heap[p], heap[c]] = [heap[c], heap[p]];
      c = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let c = 0;
      for (;;) {
        const l = c * 2 + 1;
        const r = l + 1;
        let m = c;
        if (l < heap.length && f[heap[l]] < f[heap[m]]) m = l;
        if (r < heap.length && f[heap[r]] < f[heap[m]]) m = r;
        if (m === c) break;
        [heap[m], heap[c]] = [heap[c], heap[m]];
        c = m;
      }
    }
    return top;
  };

  const start = from.y * w + from.x;
  const goal = to.y * w + to.x;
  g[start] = 0;
  f[start] = hfn(start);
  push(start);
  let expanded = 0;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  while (heap.length) {
    const cur = pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (++expanded > maxNodes) return null;
    const cx = cur % w;
    const cy = (cur / w) | 0;
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (closed[ni] || (ni !== goal && !passable(nx, ny))) continue;
      // tiny penalty for turning keeps paths straight and natural
      const prev = came[cur];
      const turn = prev >= 0 && (prev % w === cx) !== (dx === 0) ? 0.001 : 0;
      const ng = g[cur] + 1 + turn;
      if (ng < g[ni]) {
        g[ni] = ng;
        f[ni] = ng + hfn(ni);
        came[ni] = cur;
        push(ni);
      }
    }
  }
  if (came[goal] < 0) return null;
  const path: Pt[] = [];
  for (let c = goal; c !== start; c = came[c]) path.push({ x: c % w, y: (c / w) | 0 });
  return path.reverse();
}

/** Nearest passable tile to (x, y) by breadth-first search. */
export function nearestPassable(w: number, h: number, passable: (x: number, y: number) => boolean, p: Pt): Pt | null {
  if (passable(p.x, p.y)) return p;
  const seen = new Uint8Array(w * h);
  const q: Pt[] = [p];
  seen[p.y * w + p.x] = 1;
  while (q.length) {
    const c = q.shift()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const n = { x: c.x + dx, y: c.y + dy };
      if (n.x < 0 || n.y < 0 || n.x >= w || n.y >= h || seen[n.y * w + n.x]) continue;
      if (passable(n.x, n.y)) return n;
      seen[n.y * w + n.x] = 1;
      q.push(n);
    }
  }
  return null;
}
