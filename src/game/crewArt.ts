// Dresses the CC0 base body into an original crew member by palette swap.
// Source sheet: 7 columns (idle + 6 walk) x 4 rows (down, up, left, right),
// 18x36 per frame, colors L (skin light), m (skin mid), D (outline), eyes.

import type { Look } from '../core/types';
import { HAIR_COLORS, SKIN_TONES, UNIFORMS } from './palette';

export const FW = 18;
export const FH = 36;
export const COLS = 7;
export const ROWS = 4; // 0 down, 1 up, 2 left, 3 right
export const EXTRA = 3; // extra frames per sheet: sit-type A, sit-type B, cheer
export const SHEET_W = FW * COLS;
export const SHEET_H = FH * (ROWS + 1);

const OUTLINE = [16, 12, 28];

type RGB = [number, number, number];
const rgb = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

const enum C {
  None,
  L,
  M,
  D,
  EyeDark,
  EyeWhite,
  EyeIris,
}

function classify(r: number, g: number, b: number, a: number): C {
  if (a < 10) return C.None;
  if (r === 0xff && g === 0xe6) return C.L;
  if (r === 0xd6 && g === 0xa1) return C.M;
  if (r === 0x99 && g === 0x6b) return C.D;
  if (r === 0x0f || r === 0x31) return C.EyeDark;
  if (r === 0xff && g === 0xff) return C.EyeWhite;
  return C.EyeIris;
}

/**
 * Paints one look onto `ctx` at (ox, oy) using the base sheet pixels.
 * `trim` is the class accent color.
 */
export function paintCrewSheet(
  base: ImageData,
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  look: Look,
  trim: string,
): void {
  const skin = SKIN_TONES[look.skin % SKIN_TONES.length].map(rgb);
  const hair = HAIR_COLORS[look.hair % HAIR_COLORS.length].map(rgb);
  const uni = UNIFORMS[look.uniform % UNIFORMS.length].map(rgb);
  const trimC = rgb(trim);
  const boot: RGB[] = [rgb('#606080'), rgb('#3a3a5a'), rgb('#202040')];
  const out = ctx.createImageData(SHEET_W, SHEET_H);

  const put = (x: number, y: number, c: RGB | number[]) => {
    if (x < 0 || y < 0 || x >= SHEET_W || y >= SHEET_H) return;
    const i = (y * SHEET_W + x) * 4;
    out.data[i] = c[0];
    out.data[i + 1] = c[1];
    out.data[i + 2] = c[2];
    out.data[i + 3] = 255;
  };
  const src = (x: number, y: number): C => {
    if (x < 0 || y < 0 || x >= base.width || y >= base.height) return C.None;
    const i = (y * base.width + x) * 4;
    return classify(base.data[i], base.data[i + 1], base.data[i + 2], base.data[i + 3]);
  };

  const paintFrame = (row: number, col: number, dstRow: number, dstCol: number, mod?: (x: number, y: number) => [number, number]) => {
    const sx0 = col * FW;
    const sy0 = row * FH;
    // top of the figure
    let top = 0;
    outer: for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) if (src(sx0 + x, sy0 + y) !== C.None) {
      top = y;
      break outer;
    }
    const facing = row; // 0 down, 1 up, 2 left, 3 right
    for (let y = 0; y < FH; y++) {
      for (let x = 0; x < FW; x++) {
        const [mx, my] = mod ? mod(x, y) : [x, y];
        const c = src(sx0 + mx, sy0 + my);
        if (c === C.None) continue;
        const ry = my - top; // row relative to the top of the head
        const dx = dstCol * FW + x;
        const dy = dstRow * FH + y;
        let color: RGB | number[];
        if (c === C.EyeDark) color = [16, 12, 28];
        else if (c === C.EyeWhite) color = [255, 252, 255];
        else if (c === C.EyeIris) color = rgb('#3aa0ff');
        else if (ry <= 9) {
          // head
          const isHair = hairAt(look.hairStyle, facing, mx, ry, c);
          if (c === C.D) color = OUTLINE;
          else if (isHair) color = c === C.L ? hair[0] : hair[1];
          else color = c === C.L ? skin[0] : skin[1];
        } else if (ry <= 20) {
          // torso and arms
          const armCol = mx <= 4 || mx >= 13;
          const isHand = (facing <= 1 && armCol && ry >= 18) || (facing >= 2 && ry >= 18 && ry <= 19 && c !== C.D && (mx <= 6 || mx >= 11));
          if (c === C.D) color = uni[2].map((v) => Math.max(0, v - 16));
          else if (isHand) color = c === C.L ? skin[1] : skin[2];
          else if (ry === 10 && facing <= 1) color = trimC; // collar
          else if (ry === 20 && !armCol) color = trimC; // belt
          else if (facing === 0 && ry === 13 && mx === 11) color = trimC; // badge
          else color = c === C.L ? uni[0] : uni[1];
        } else if (ry <= 28) {
          // legs
          color = c === C.D ? OUTLINE : c === C.L ? uni[1] : uni[2];
        } else {
          color = c === C.D ? OUTLINE : c === C.L ? boot[0] : boot[1];
        }
        put(dx, dy, color);
      }
    }
    // crest hairstyle sticks up above the head
    if (look.hairStyle === 2) {
      const cx = dstCol * FW + (facing === 2 ? 8 : facing === 3 ? 9 : 8);
      const ty = dstRow * FH + top;
      put(cx, ty - 1, hair[0]);
      put(cx + 1, ty - 1, hair[1]);
      put(cx, ty - 2, OUTLINE);
      put(cx + 1, ty - 2, OUTLINE);
      put(cx - 1, ty - 1, OUTLINE);
      put(cx + 2, ty - 1, OUTLINE);
    }
  };

  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) paintFrame(row, col, row, col);

  // extra row: seated typing frames (back view, arms nudged) and a cheer frame
  paintFrame(1, 0, ROWS, 0);
  paintFrame(1, 0, ROWS, 1, (x, y) => {
    // arms raised one pixel: sample one row lower for the arm columns
    if ((x <= 4 || x >= 13) && y >= 11 && y <= 20) return [x, y + 1];
    return [x, y];
  });
  paintFrame(0, 0, ROWS, 2, (x, y) => {
    if ((x <= 4 || x >= 13) && y >= 8 && y <= 20) return [x, y + 3];
    return [x, y];
  });

  ctx.putImageData(out, ox, oy);
}

function hairAt(style: number, facing: number, x: number, ry: number, c: C): boolean {
  if (style === 3) return ry <= 1 && c !== C.D; // shaved: a thin dark top
  const long = style === 1;
  if (facing === 1) return ry <= (long ? 9 : 7); // back of the head
  if (ry <= 2) return true;
  if (facing === 0) {
    if (ry <= 3) return x <= 6 || x >= 11 || ry <= 2;
    if (long && ry <= 9) return x <= 5 || x >= 12;
    return ry <= 5 && (x <= 5 || x >= 12);
  }
  // side views: the back of the head is on the side away from the face
  const back = facing === 2 ? x >= 10 : x <= 7;
  if (ry <= 3) return true;
  return back && ry <= (long ? 9 : 6);
}
