// Station layout, generated in code. 16 px tiles.

export const TILE = 16;
export const MAP_W = 52;
export const MAP_H = 34;

export const enum Cell {
  Void = 0,
  Wall = 1,
  Floor = 2,
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Room {
  id: 'work' | 'factory' | 'lounge' | 'ops';
  name: string;
  rect: Rect; // floor area
}

export type Facing = 0 | 1 | 2 | 3; // down, up, left, right

export interface Spot {
  x: number; // tile
  y: number;
  face: Facing;
  kind: 'desk' | 'station' | 'sofa' | 'pool' | 'tank' | 'coffee' | 'outbox' | 'pad' | 'stand';
  /** pixel offset applied once the character arrives (e.g. to sit on a sofa) */
  dx?: number;
  dy?: number;
}

export interface Prop {
  frame: string;
  x: number; // pixel position of the sprite's bottom-left corner
  y: number;
  block: Rect | null; // tiles made unwalkable
  depthY?: number; // override depth sort line (pixels)
  id?: string;
}

export const ROOMS: Room[] = [
  { id: 'work', name: 'WORK BAY', rect: { x: 3, y: 4, w: 22, h: 11 } },
  { id: 'factory', name: 'FACTORY', rect: { x: 28, y: 4, w: 21, h: 11 } },
  { id: 'lounge', name: 'LOUNGE', rect: { x: 3, y: 19, w: 22, h: 12 } },
  { id: 'ops', name: 'OPS / OUTBOX', rect: { x: 28, y: 19, w: 21, h: 12 } },
];

const DOORS: Rect[] = [
  { x: 12, y: 15, w: 3, h: 4 }, // work <-> lounge
  { x: 37, y: 15, w: 3, h: 4 }, // factory <-> ops
  { x: 25, y: 9, w: 3, h: 3 }, // work <-> factory
  { x: 25, y: 24, w: 3, h: 3 }, // lounge <-> ops
];

export const DOOR_RECTS = DOORS;

export interface StationMap {
  cells: Uint8Array;
  blocked: Uint8Array;
  props: Prop[];
  desks: { x: number; y: number }[]; // desk tile (left), seat is y+1
  stations: { x: number; y: number }[]; // machine tile (left), worker stands at y+2
  conveyor: { y: number; x0: number; x1: number };
  spots: Spot[];
  outbox: { x: number; y: number };
  pad: { x: number; y: number }; // pixel center
  carpet: Rect;
  decor: { x: number; y: number; w: number; tiles: number[][] }[]; // wall face decorations
}

export function idx(x: number, y: number) {
  return y * MAP_W + x;
}

export function buildMap(): StationMap {
  const cells = new Uint8Array(MAP_W * MAP_H);
  const blocked = new Uint8Array(MAP_W * MAP_H);
  const fill = (r: Rect, v: Cell) => {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) cells[idx(x, y)] = v;
  };
  fill({ x: 1, y: 1, w: 50, h: 32 }, Cell.Wall);
  for (const room of ROOMS) fill(room.rect, Cell.Floor);
  for (const d of DOORS) fill(d, Cell.Floor);

  const props: Prop[] = [];
  const block = (x: number, y: number, w: number, h: number) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) blocked[idx(xx, yy)] = 1;
  };
  const prop = (frame: string, tx: number, ty: number, bottomPx: number, b: Rect | null, extra: Partial<Prop> = {}) => {
    props.push({ frame, x: tx * TILE, y: bottomPx, block: b, ...extra });
    if (b) block(b.x, b.y, b.w, b.h);
  };

  // --- Work Bay: 12 desks in a 4x3 grid ------------------------------------
  const desks: { x: number; y: number }[] = [];
  for (const dy of [5, 8, 11])
    for (const dx of [5, 10, 15, 20]) {
      desks.push({ x: dx, y: dy });
      block(dx, dy, 2, 1);
    }
  prop('rack', 3, 4, 6 * TILE - 2, { x: 3, y: 4, w: 1, h: 1 }, { id: 'rack' });
  prop('rack', 24, 4, 6 * TILE - 2, { x: 24, y: 4, w: 1, h: 1 }, { id: 'rack' });
  prop('plant', 3, 14, 15 * TILE, { x: 3, y: 14, w: 1, h: 1 });
  prop('plant', 24, 14, 15 * TILE, { x: 24, y: 14, w: 1, h: 1 });
  prop('coffee', 24, 8, 9 * TILE + 4, { x: 24, y: 8, w: 1, h: 1 });

  // --- Factory: 4 stations above a conveyor --------------------------------
  const stations: { x: number; y: number }[] = [];
  for (const sx of [30, 35, 40, 45]) {
    stations.push({ x: sx, y: 5 });
    prop('machine', sx, 5, 7 * TILE, { x: sx, y: 5, w: 2, h: 2 });
  }
  const conveyor = { y: 9, x0: 29, x1: 48 };
  block(conveyor.x0, conveyor.y, conveyor.x1 - conveyor.x0 + 1, 1);
  prop('rack', 28, 12, 14 * TILE - 2, { x: 28, y: 12, w: 1, h: 2 }, { id: 'rack' });
  prop('rack', 48, 12, 14 * TILE - 2, { x: 48, y: 12, w: 1, h: 2 }, { id: 'rack' });
  prop('plant', 33, 14, 15 * TILE, { x: 33, y: 14, w: 1, h: 1 });
  prop('crates', 29, 12, 14 * TILE, { x: 29, y: 13, w: 2, h: 1 });
  prop('crates', 43, 13, 15 * TILE, { x: 43, y: 14, w: 2, h: 1 });
  prop('crates', 46, 13, 15 * TILE, { x: 46, y: 14, w: 2, h: 1 });

  // --- Lounge ---------------------------------------------------------------
  const carpet = { x: 4, y: 21, w: 13, h: 9 };
  prop('sofa', 5, 21, 23 * TILE - 4, { x: 5, y: 21, w: 3, h: 1 }, { depthY: 21 * TILE });
  prop('pool', 10, 24, 26 * TILE - 2, { x: 10, y: 24, w: 3, h: 2 });
  prop('tank', 20, 19, 21 * TILE, { x: 20, y: 19, w: 2, h: 2 }, { id: 'tank' });
  prop('coffee', 17, 19, 20 * TILE + 8, { x: 17, y: 19, w: 1, h: 1 });
  prop('plant', 3, 19, 20 * TILE, { x: 3, y: 19, w: 1, h: 1 });
  prop('plant', 24, 30, 31 * TILE, { x: 24, y: 30, w: 1, h: 1 });
  prop('plant', 3, 30, 31 * TILE, { x: 3, y: 30, w: 1, h: 1 });
  prop('sofa', 18, 27, 29 * TILE - 4, { x: 18, y: 27, w: 3, h: 1 }, { depthY: 27 * TILE });

  // --- Ops: outbox + recruitment pad ---------------------------------------
  const outbox = { x: 30, y: 19 };
  prop('outbox', 30, 19, 21 * TILE, { x: 30, y: 19, w: 2, h: 2 }, { id: 'outbox' });
  const pad = { x: 41 * TILE + 8, y: 25 * TILE };
  props.push({ frame: 'pad', x: 41 * TILE + 8 - 24, y: 25 * TILE + 13, block: null, depthY: 0 });
  prop('holo', 37, 23, 25 * TILE, { x: 37, y: 24, w: 1, h: 1 }, { id: 'holo' });
  prop('holo', 45, 23, 25 * TILE, { x: 45, y: 24, w: 1, h: 1 }, { id: 'holo' });
  prop('rack', 48, 19, 21 * TILE - 2, { x: 48, y: 19, w: 1, h: 1 }, { id: 'rack' });
  prop('rack', 47, 19, 21 * TILE - 2, { x: 47, y: 19, w: 1, h: 1 }, { id: 'rack' });
  prop('plant', 28, 30, 31 * TILE, { x: 28, y: 30, w: 1, h: 1 });
  prop('crates', 33, 19, 21 * TILE - 2, { x: 33, y: 20, w: 2, h: 1 });
  prop('console', 40, 19, 20 * TILE + 6, { x: 40, y: 19, w: 2, h: 1 }, { id: 'console' });
  prop('console', 43, 19, 20 * TILE + 6, { x: 43, y: 19, w: 2, h: 1 }, { id: 'console' });
  prop('rack', 28, 27, 29 * TILE - 2, { x: 28, y: 27, w: 1, h: 2 }, { id: 'rack' });
  prop('plant', 48, 30, 31 * TILE, { x: 48, y: 30, w: 1, h: 1 });

  const spots: Spot[] = [
    { x: 5, y: 22, face: 0, kind: 'sofa', dy: -9 },
    { x: 6, y: 22, face: 0, kind: 'sofa', dy: -9 },
    { x: 7, y: 22, face: 0, kind: 'sofa', dy: -9 },
    { x: 18, y: 28, face: 0, kind: 'sofa', dy: -9 },
    { x: 20, y: 28, face: 0, kind: 'sofa', dy: -9 },
    { x: 9, y: 25, face: 3, kind: 'pool' },
    { x: 13, y: 24, face: 2, kind: 'pool' },
    { x: 11, y: 26, face: 1, kind: 'pool' },
    { x: 20, y: 21, face: 1, kind: 'tank' },
    { x: 21, y: 21, face: 1, kind: 'tank' },
    { x: 17, y: 20, face: 1, kind: 'coffee' },
    { x: 24, y: 9, face: 1, kind: 'coffee' },
    { x: 35, y: 27, face: 3, kind: 'stand' },
    { x: 44, y: 21, face: 0, kind: 'stand' },
    { x: 15, y: 22, face: 2, kind: 'stand' },
    { x: 46, y: 28, face: 2, kind: 'stand' },
  ];

  // Wall face decorations: 2x2 tile blocks on the face rows above a floor.
  const decor = [
    { x: 6, y: 2, w: 2, tiles: [[16, 17], [31, 32]] },
    { x: 13, y: 2, w: 2, tiles: [[20, 21], [35, 36]] },
    { x: 18, y: 2, w: 2, tiles: [[16, 17], [31, 32]] },
    { x: 31, y: 2, w: 2, tiles: [[22, 23], [37, 38]] },
    { x: 41, y: 2, w: 2, tiles: [[16, 17], [31, 32]] },
    { x: 6, y: 17, w: 2, tiles: [[20, 21], [35, 36]] },
    { x: 34, y: 17, w: 2, tiles: [[16, 17], [31, 32]] },
    { x: 43, y: 17, w: 2, tiles: [[22, 23], [37, 38]] },
    { x: 20, y: 17, w: 2, tiles: [[16, 17], [31, 32]] },
  ];

  return { cells, blocked, props, desks, stations, conveyor, spots, outbox, pad, carpet, decor };
}

export function walkable(m: StationMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return false;
  const i = idx(x, y);
  return m.cells[i] === Cell.Floor && !m.blocked[i];
}

export function roomAt(x: number, y: number): Room | null {
  for (const r of ROOMS) if (x >= r.rect.x && y >= r.rect.y && x < r.rect.x + r.rect.w && y < r.rect.y + r.rect.h) return r;
  return null;
}
