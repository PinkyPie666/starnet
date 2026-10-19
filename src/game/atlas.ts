// Builds the single runtime atlas: CC0 tiles + procedural props + crew sheets.
// All procedural art is painted pixel by pixel from the master palette.

import type { Look } from '../core/types';
import { P } from './palette';
import { COLS, FH, FW, ROWS, SHEET_H, SHEET_W, paintCrewSheet } from './crewArt';

export const ATLAS_W = 1024;
export const ATLAS_H = 1024;
const CREW_Y = 304;
const CREW_COLS = 7;
const CREW_ROWS = 4;
export const MAX_CREW_SLOTS = CREW_COLS * CREW_ROWS;

export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Draw = (g: Pen) => void;

/** Pixel pen bound to an origin. */
export class Pen {
  constructor(
    private ctx: CanvasRenderingContext2D,
    public ox: number,
    public oy: number,
  ) {}
  r(x: number, y: number, w: number, h: number, c: string) {
    this.ctx.fillStyle = c;
    this.ctx.fillRect(this.ox + x, this.oy + y, w, h);
  }
  p(x: number, y: number, c: string) {
    this.r(x, y, 1, 1, c);
  }
  /** filled rect with a 1px outline */
  box(x: number, y: number, w: number, h: number, fill: string, line: string = P.black) {
    this.r(x, y, w, h, line);
    this.r(x + 1, y + 1, w - 2, h - 2, fill);
  }
  hline(x: number, y: number, w: number, c: string) {
    this.r(x, y, w, 1, c);
  }
  vline(x: number, y: number, h: number, c: string) {
    this.r(x, y, 1, h, c);
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: string, fill = true) {
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
        if (fill ? d <= 1 : d <= 1 && d > 1 - 2.2 / Math.min(rx, ry)) this.p(cx + x, cy + y, c);
      }
    }
  }
  clear(x: number, y: number, w: number, h: number) {
    this.ctx.clearRect(this.ox + x, this.oy + y, w, h);
  }
}

export class AtlasBuilder {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  frames: Record<string, Frame> = {};
  private shelfX = 240;
  private shelfY = 0;
  private shelfH = 0;
  private crewSlots: (string | null)[] = new Array(MAX_CREW_SLOTS).fill(null);

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = ATLAS_W;
    this.canvas.height = ATLAS_H;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
    this.ctx.imageSmoothingEnabled = false;
  }

  addTileset(img: CanvasImageSource, w: number, h: number, size = 16) {
    this.ctx.drawImage(img, 0, 0);
    const cols = w / size;
    for (let i = 0; i < cols * (h / size); i++) {
      this.frames[`t${i}`] = { x: (i % cols) * size, y: Math.floor(i / cols) * size, w: size, h: size };
    }
  }

  /** Shelf-pack a procedural sprite. */
  add(name: string, w: number, h: number, draw: Draw): Frame {
    if (this.shelfX + w > ATLAS_W) {
      this.shelfX = this.shelfY + this.shelfH >= 176 ? 0 : 240;
      this.shelfY += this.shelfH + 1;
      this.shelfH = 0;
    }
    if (this.shelfY < 176 && this.shelfX < 240) this.shelfX = 240;
    const f = { x: this.shelfX, y: this.shelfY, w, h };
    if (f.y + h > CREW_Y) throw new Error(`atlas full while adding ${name}`);
    draw(new Pen(this.ctx, f.x, f.y));
    this.frames[name] = f;
    this.shelfX += w + 1;
    this.shelfH = Math.max(this.shelfH, h);
    return f;
  }

  /** Paints a crew sheet into a free slot and registers its frames. Returns the frame prefix. */
  addCrew(key: string, base: ImageData, look: Look, trim: string): string | null {
    let slot = this.crewSlots.indexOf(key);
    if (slot < 0) slot = this.crewSlots.indexOf(null);
    if (slot < 0) return null;
    this.crewSlots[slot] = key;
    const ox = (slot % CREW_COLS) * SHEET_W;
    const oy = CREW_Y + Math.floor(slot / CREW_COLS) * SHEET_H;
    this.ctx.clearRect(ox, oy, SHEET_W, SHEET_H);
    paintCrewSheet(base, this.ctx, ox, oy, look, trim);
    for (let r = 0; r <= ROWS; r++)
      for (let c = 0; c < COLS; c++) this.frames[`${key}_${r}_${c}`] = { x: ox + c * FW, y: oy + r * FH, w: FW, h: FH };
    return key;
  }

  freeCrew(key: string) {
    const slot = this.crewSlots.indexOf(key);
    if (slot >= 0) this.crewSlots[slot] = null;
  }
}

// ---------------------------------------------------------------------------
// Procedural props
// ---------------------------------------------------------------------------

export function paintProps(a: AtlasBuilder) {
  // Desk with a CRT-style monitor facing the viewer (agent sits below it).
  a.add('desk', 32, 24, (g) => {
    g.r(3, 17, 2, 7, P.black);
    g.r(27, 17, 2, 7, P.black);
    g.r(3, 17, 1, 6, P.steel0);
    g.r(27, 17, 1, 6, P.steel0);
    g.box(0, 8, 32, 11, P.steel2);
    g.hline(1, 9, 30, P.steel3);
    g.r(1, 15, 30, 3, P.steel0);
    g.hline(1, 15, 30, P.steel1);
    // keyboard
    g.box(9, 11, 14, 4, P.ink);
    for (let x = 10; x < 22; x += 2) g.p(x, 12, P.steel3);
    for (let x = 11; x < 22; x += 2) g.p(x, 13, P.steel2);
    // mug
    g.box(25, 9, 4, 4, P.white);
    g.p(26, 10, P.amber1);
    // monitor
    g.r(14, 9, 4, 2, P.black);
    g.r(15, 9, 2, 1, P.steel0);
    g.box(8, 0, 16, 10, P.ink);
    g.hline(9, 1, 14, P.steel1);
    g.r(10, 2, 12, 6, P.teal0);
    g.p(22, 8, P.teal3);
  });
  const screen = (name: string, bg: string, fg: string, fg2: string, phase: number, mode: 'code' | 'err' | 'ok') =>
    a.add(name, 12, 6, (g) => {
      g.r(0, 0, 12, 6, bg);
      if (mode === 'code') {
        const lens = [7, 4, 9, 5, 8, 3, 10, 6];
        for (let row = 0; row < 3; row++) {
          const L = lens[(row + phase) % lens.length];
          const indent = (row + phase) % 3 === 1 ? 2 : 1;
          g.hline(indent, 1 + row * 2 - (row === 2 ? 1 : 0), Math.min(L, 11 - indent), row === 1 ? fg2 : fg);
        }
        if (phase % 2 === 0) g.p(10, 4, P.white);
      } else if (mode === 'err') {
        g.r(5, 1, 2, 2, fg);
        g.r(5, 4, 2, 1, fg);
      } else {
        g.p(3, 3, fg);
        g.p(4, 4, fg);
        g.p(5, 3, fg);
        g.p(6, 2, fg);
        g.p(7, 1, fg);
      }
    });
  for (let i = 0; i < 4; i++) screen(`scr${i}`, P.teal1, P.glow, P.teal3, i, 'code');
  screen('scr_err', '#401018', P.red, P.red, 0, 'err');
  screen('scr_ok', P.amber0, P.amber3, P.amber3, 0, 'ok');
  screen('scr_idle', P.teal0, P.teal2, P.teal2, 0, 'code');

  // Office chair seen from behind
  a.add('chair', 16, 15, (g) => {
    g.r(7, 12, 2, 3, P.black);
    g.box(1, 8, 14, 5, P.steel0);
    g.box(3, 0, 10, 10, P.ink2);
    g.hline(4, 1, 8, P.blue0);
    g.vline(4, 2, 6, P.blue0);
    g.hline(4, 8, 8, P.ink);
  });

  // Soft glow, tinted and added in the scene
  a.add('glow', 32, 32, (g) => {
    for (let r = 15; r >= 2; r--) {
      const alpha = Math.pow(1 - r / 16, 2) * 0.55;
      g.ellipse(16, 16, r, r, `rgba(255,255,255,${alpha.toFixed(3)})`);
    }
  });

  // Pool table (sci-fi teal felt)
  a.add('pool', 48, 30, (g) => {
    g.r(3, 24, 3, 6, P.black);
    g.r(42, 24, 3, 6, P.black);
    g.box(0, 0, 48, 26, P.steel0);
    g.hline(1, 1, 46, P.steel2);
    g.box(3, 3, 42, 20, P.teal2, P.teal0);
    g.r(4, 17, 40, 5, P.teal1);
    for (const [x, y] of [[3, 3], [22, 3], [42, 3], [3, 20], [22, 20], [42, 20]]) g.box(x, y, 3, 3, P.black, P.black);
    const balls: [number, number, string][] = [
      [12, 11, P.white],
      [30, 9, P.amber3],
      [32, 12, P.red],
      [34, 10, P.elec],
      [33, 15, P.pink],
      [36, 13, P.black],
    ];
    for (const [x, y, c] of balls) {
      g.r(x, y, 2, 2, c);
      g.p(x, y, P.white);
    }
    g.hline(14, 12, 14, P.amber2); // cue
    g.hline(14, 13, 5, P.amber1);
  });

  // Sofa facing the viewer
  a.add('sofa', 48, 22, (g) => {
    g.r(3, 19, 2, 3, P.black);
    g.r(43, 19, 2, 3, P.black);
    g.box(2, 0, 44, 11, P.blue0);
    g.hline(3, 1, 42, P.blue1);
    for (const x of [3, 17, 31]) {
      g.box(x, 9, 14, 9, P.ink2);
      g.hline(x + 1, 10, 12, P.blue0);
    }
    g.box(0, 4, 5, 16, P.blue0);
    g.box(43, 4, 5, 16, P.blue0);
    g.vline(1, 5, 2, P.blue1);
    g.vline(44, 5, 2, P.blue1);
    g.hline(1, 18, 46, P.ink);
  });

  // Fish tank on a stand; fish are separate animated sprites
  a.add('tank', 32, 32, (g) => {
    g.box(0, 22, 32, 10, P.steel0);
    g.hline(1, 23, 30, P.steel2);
    g.r(4, 26, 24, 3, P.ink);
    g.box(1, 2, 30, 21, P.blue0, P.steel3);
    g.r(2, 3, 28, 6, '#4f6f92');
    g.r(2, 14, 28, 5, P.ink2);
    g.r(2, 19, 28, 3, P.amber1);
    g.hline(2, 19, 28, P.amber2);
    for (const [x, h] of [[5, 8], [7, 5], [24, 9], [26, 6], [15, 4]]) {
      for (let y = 0; y < h; y++) g.p(x + (y % 3 === 1 ? 1 : 0), 18 - y, y % 2 ? P.teal3 : P.teal2);
    }
    g.box(0, 0, 32, 3, P.steel2);
    g.p(29, 1, P.glow);
    g.vline(3, 4, 3, P.blue1);
  });
  a.add('fishA', 5, 3, (g) => {
    g.r(1, 0, 3, 3, P.amber3);
    g.p(0, 1, P.amber2);
    g.p(3, 1, P.black);
    g.p(4, 0, P.amber2);
    g.p(4, 2, P.amber2);
  });
  a.add('fishB', 5, 3, (g) => {
    g.r(1, 0, 3, 3, P.pink);
    g.p(3, 1, P.black);
    g.p(0, 0, P.pink);
    g.p(0, 2, P.pink);
  });

  // Coffee machine
  a.add('coffee', 16, 26, (g) => {
    g.box(1, 2, 14, 24, P.steel2);
    g.box(0, 0, 16, 5, P.steel3);
    g.box(3, 6, 10, 5, P.ink);
    g.p(5, 8, P.amber3);
    g.p(7, 8, P.glow);
    g.r(4, 13, 8, 7, P.black);
    g.box(6, 16, 4, 4, P.white);
    g.hline(2, 23, 12, P.steel0);
  });

  // Hydroponic plant pod (teal leaves to stay in palette)
  a.add('plant', 16, 24, (g) => {
    g.box(3, 15, 10, 9, P.steel2);
    g.hline(4, 16, 8, P.steel3);
    g.r(5, 19, 6, 2, P.ink);
    g.p(7, 19, P.glow);
    const leaves: [number, number][] = [
      [7, 2], [6, 3], [8, 3], [5, 5], [7, 5], [9, 5], [4, 7], [6, 7], [8, 7], [10, 7], [3, 9], [5, 9], [7, 9], [9, 9], [11, 9],
      [4, 11], [6, 11], [8, 11], [10, 11], [5, 13], [7, 13], [9, 13], [2, 6], [12, 6], [1, 10], [13, 10],
    ];
    for (const [x, y] of leaves) {
      g.r(x, y, 2, 2, P.teal2);
      g.p(x, y, P.teal3);
    }
    g.p(7, 2, P.glow);
    g.p(11, 9, P.glow);
  });

  // Server rack with blinking light overlays
  a.add('rack', 16, 30, (g) => {
    g.box(0, 0, 16, 30, P.ink);
    for (let y = 3; y < 26; y += 4) {
      g.r(2, y, 12, 3, P.steel0);
      g.hline(2, y, 12, P.steel1);
    }
    g.r(2, 27, 12, 2, P.black);
  });
  for (let f = 0; f < 2; f++) {
    a.add(`rackL${f}`, 16, 30, (g) => {
      const cols = [P.glow, P.amber3, P.elec, P.glow, P.red, P.glow];
      for (let i = 0; i < 6; i++) {
        const y = 4 + i * 4;
        if ((i + f) % 2 === 0) g.p(3, y, cols[i]);
        if ((i + f) % 3 !== 0) g.p(5, y, cols[(i + 2) % 6]);
        g.p(12, y, (i + f) % 2 ? P.glow : P.teal2);
      }
    });
  }

  // Conveyor belt, 4 animation frames (horizontal)
  for (let f = 0; f < 4; f++) {
    a.add(`conv${f}`, 16, 16, (g) => {
      g.r(0, 0, 16, 16, P.black);
      g.r(0, 1, 16, 2, P.steel3);
      g.r(0, 3, 16, 1, P.steel2);
      g.r(0, 4, 16, 8, P.ink);
      for (let x = -4; x < 20; x += 4) {
        const xx = x + f;
        for (let y = 0; y < 8; y++) {
          const px = xx + Math.floor(y / 4);
          if (px >= 0 && px < 16) g.p(px, 4 + y, P.steel0);
        }
      }
      g.r(0, 12, 16, 1, P.steel2);
      g.r(0, 13, 16, 2, P.steel3);
      g.hline(0, 14, 16, P.steel2);
      g.p((f * 4 + 2) % 16, 13, P.amber2);
    });
  }

  // Factory station machine
  a.add('machine', 32, 32, (g) => {
    g.box(0, 6, 32, 26, P.steel2);
    g.hline(1, 7, 30, P.steel3);
    g.box(2, 0, 28, 8, P.steel0);
    g.r(6, 2, 20, 3, P.black);
    g.hline(7, 3, 18, P.amber1);
    g.box(9, 10, 14, 10, P.ink);
    g.r(3, 24, 26, 6, P.steel0);
    for (let x = 4; x < 28; x += 3) g.vline(x, 25, 4, P.ink);
    g.p(4, 12, P.glow);
    g.p(4, 15, P.amber3);
    g.p(27, 12, P.red);
    g.p(27, 15, P.glow);
  });

  // Data crate carried around and sent down the conveyor
  a.add('crate', 9, 8, (g) => {
    g.box(0, 0, 9, 8, P.amber2);
    g.hline(1, 1, 7, P.amber3);
    g.r(1, 4, 7, 1, P.amber1);
    g.p(4, 2, P.glow);
    g.r(1, 6, 7, 1, P.amber1);
  });

  // Outbox delivery chute
  a.add('outbox', 32, 32, (g) => {
    g.box(0, 4, 32, 28, P.steel2);
    g.hline(1, 5, 30, P.steel3);
    g.box(3, 0, 26, 8, P.ink);
    g.box(5, 12, 22, 12, P.black, P.black);
    for (let x = 5; x < 27; x++) {
      const on = Math.floor((x - 5) / 2) % 2 === 0;
      g.p(x, 11, on ? P.amber3 : P.black);
      g.p(x, 24, on ? P.amber3 : P.black);
    }
    g.r(7, 14, 18, 2, P.ink);
    g.r(3, 27, 26, 3, P.steel0);
    g.p(5, 28, P.glow);
    g.p(26, 28, P.amber3);
  });

  // Recruitment summon pad
  a.add('pad', 48, 26, (g) => {
    g.ellipse(24, 13, 23, 12, P.black);
    g.ellipse(24, 13, 22, 11, P.steel2);
    g.ellipse(24, 13, 19, 9, P.steel0);
    g.ellipse(24, 13, 16, 7, P.teal1);
    g.ellipse(24, 13, 16, 7, P.teal3, false);
    g.ellipse(24, 13, 9, 4, P.teal2);
    g.ellipse(24, 13, 9, 4, P.glow, false);
    for (const [x, y] of [[4, 13], [44, 13], [24, 2], [24, 24], [10, 5], [38, 5], [10, 21], [38, 21]]) g.p(x, y, P.amber3);
  });

  // Holo terminal next to the pad
  a.add('holo', 16, 28, (g) => {
    g.box(3, 14, 10, 14, P.steel2);
    g.hline(4, 15, 8, P.steel3);
    g.box(1, 0, 14, 12, P.teal1, P.teal3);
    for (let y = 2; y < 11; y += 2) g.hline(3, y, 4 + ((y * 3) % 7), P.glow);
    g.r(6, 18, 4, 3, P.ink);
    g.p(7, 19, P.amber3);
  });

  // Floor overlays
  a.add('carpet0', 16, 16, (g) => {
    g.r(0, 0, 16, 16, P.ink2);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + y) % 8 === 0 || (x - y + 16) % 8 === 0) g.p(x, y, P.ink);
    g.p(4, 4, P.blue0);
    g.p(12, 12, P.blue0);
  });
  a.add('carpetEdge', 16, 16, (g) => {
    g.r(0, 0, 16, 16, P.ink2);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + y) % 8 === 0 || (x - y + 16) % 8 === 0) g.p(x, y, P.ink);
    g.hline(0, 0, 16, P.amber1);
    g.hline(0, 1, 16, P.amber2);
  });

  // Small UI-ish sprites
  a.add('shadow', 14, 5, (g) => g.ellipse(7, 2, 6, 2, 'rgba(0,0,0,0.45)'));
  a.add('bang', 7, 11, (g) => {
    g.box(0, 0, 7, 11, P.red, P.black);
    g.r(3, 2, 1, 4, P.white);
    g.r(3, 8, 1, 1, P.white);
  });
  a.add('dot', 3, 3, (g) => g.r(0, 0, 3, 3, P.white));
  a.add('px', 2, 2, (g) => g.r(0, 0, 2, 2, P.white));
  a.add('barBg', 20, 4, (g) => {
    g.box(0, 0, 20, 4, P.ink, P.black);
  });
  a.add('barFill', 1, 2, (g) => g.r(0, 0, 1, 2, P.white));
  a.add('ring', 22, 10, (g) => g.ellipse(11, 5, 10, 4, P.white, false));
}

// ---------------------------------------------------------------------------
// Bitmap font: 3x5 glyphs with a baked 1px outline (cell 5x7)
// ---------------------------------------------------------------------------

export const FONT_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,:-/!?+%\'()<>#_';
const G: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110',
  '4': '101101111001001', '5': '111100110001110', '6': '011100111101111', '7': '111001010010010', '8': '111101111101111',
  '9': '111101111001110', ' ': '000000000000000', '.': '000000000000010', ',': '000000000010100', ':': '000010000010000',
  '-': '000000111000000', '/': '001001010100100', '!': '010010010000010', '?': '110001010000010', '+': '000010111010000',
  '%': '101001010100101', "'": '010010000000000', '(': '001010010010001', ')': '100010010010100', '<': '001010100010001',
  '>': '100010001010100', '#': '101111101111101', _: '000000000000111',
};
export const FONT_CELL_W = 5;
export const FONT_CELL_H = 7;
export const FONT_PER_ROW = 16;

export function buildFontCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = FONT_CELL_W * FONT_PER_ROW;
  c.height = FONT_CELL_H * Math.ceil(FONT_CHARS.length / FONT_PER_ROW);
  const ctx = c.getContext('2d')!;
  [...FONT_CHARS].forEach((ch, i) => {
    const ox = (i % FONT_PER_ROW) * FONT_CELL_W;
    const oy = Math.floor(i / FONT_PER_ROW) * FONT_CELL_H;
    const bits = G[ch];
    const on = (x: number, y: number) => x >= 0 && y >= 0 && x < 3 && y < 5 && bits[y * 3 + x] === '1';
    for (let y = -1; y <= 5; y++)
      for (let x = -1; x <= 3; x++) {
        if (on(x, y)) {
          ctx.fillStyle = '#fffcff';
          ctx.fillRect(ox + 1 + x, oy + 1 + y, 1, 1);
        } else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) {
          ctx.fillStyle = '#100c1c';
          ctx.fillRect(ox + 1 + x, oy + 1 + y, 1, 1);
        }
      }
  });
  return c;
}

// ---------------------------------------------------------------------------
// Starfield layers (separate textures so they can tile)
// ---------------------------------------------------------------------------

export function buildStarCanvas(size: number, count: number, seed: number, bright: boolean): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  if (!bright) {
    // faint nebula blotches, dithered
    for (let i = 0; i < 5; i++) {
      const cx = rnd() * size;
      const cy = rnd() * size;
      const r = 20 + rnd() * 40;
      const col = i % 2 ? '40,57,98' : '32,96,96';
      for (let y = -r; y < r; y += 2)
        for (let x = -r; x < r; x += 2) {
          const d = Math.sqrt(x * x + y * y) / r;
          if (d < 1 && rnd() > d * 0.9 + 0.25) {
            ctx.fillStyle = `rgba(${col},${(0.25 * (1 - d)).toFixed(2)})`;
            ctx.fillRect(((cx + x) % size + size) % size, ((cy + y) % size + size) % size, 2, 2);
          }
        }
    }
  }
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rnd() * size);
    const y = Math.floor(rnd() * size);
    const t = rnd();
    ctx.fillStyle = bright ? (t > 0.8 ? '#fffcff' : t > 0.5 ? '#6d9ccd' : '#a4aec1') : t > 0.7 ? '#6d9ccd' : '#3d5772';
    ctx.fillRect(x, y, 1, 1);
    if (bright && t > 0.93) {
      ctx.fillStyle = 'rgba(109,156,205,0.6)';
      ctx.fillRect(x - 1, y, 1, 1);
      ctx.fillRect(x + 1, y, 1, 1);
      ctx.fillRect(x, y - 1, 1, 1);
      ctx.fillRect(x, y + 1, 1, 1);
    }
  }
  return c;
}
