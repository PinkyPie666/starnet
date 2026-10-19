// Tiny DOM helpers: h() builds elements, avatar() paints crew portraits.

import type { Look } from '../core/types';
import { FW, paintCrewSheet } from '../game/crewArt';
import { icon } from './icons';

type Child = Node | string | null | undefined | false;
type Attrs = Record<string, any> & { class?: string; on?: Record<string, (e: any) => void> };

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'on') for (const [ev, fn] of Object.entries(v as Record<string, any>)) el.addEventListener(ev, fn);
      else if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k in el && typeof v !== 'string') (el as any)[k] = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

export function btn(label: string, opts: { icon?: string; kind?: 'primary' | 'ghost' | 'danger' | 'amber'; title?: string; onClick?: (e: MouseEvent) => void; small?: boolean; iconOnly?: boolean } = {}) {
  const b = h(
    'button',
    {
      class: `btn ${opts.kind ?? ''} ${opts.small ? 'sm' : ''} ${opts.iconOnly ? 'icon-only' : ''}`,
      type: 'button',
      title: opts.title ?? (opts.iconOnly ? label : undefined),
      'aria-label': opts.iconOnly ? label : undefined,
      on: opts.onClick ? { click: opts.onClick } : undefined,
    },
    opts.icon ? icon(opts.icon, opts.small ? 14 : 16) : null,
    opts.iconOnly ? null : h('span', null, label),
  );
  return b;
}

// --- crew portraits --------------------------------------------------------

let bases: Promise<[ImageData, ImageData]> | null = null;
function loadBases() {
  bases ??= Promise.all(['assets/crew-base-a.png', 'assets/crew-base-b.png'].map(loadImageData)) as Promise<[ImageData, ImageData]>;
  return bases;
}
function loadImageData(src: string): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, c.width, c.height));
    };
    img.onerror = reject;
    img.src = src;
  });
}

const cache = new Map<string, Promise<string>>();

/** Data URL of a front-facing portrait (head and shoulders) for a look. */
export function portrait(look: Look, trim: string): Promise<string> {
  const key = JSON.stringify(look) + trim;
  let p = cache.get(key);
  if (!p) {
    p = loadBases().then(([a, b]) => {
      const sheet = document.createElement('canvas');
      sheet.width = FW * 7;
      sheet.height = 36 * 5;
      const sctx = sheet.getContext('2d')!;
      paintCrewSheet(look.body === 'b' ? b : a, sctx, 0, 0, look, trim);
      const out = document.createElement('canvas');
      out.width = 18;
      out.height = 22;
      const octx = out.getContext('2d')!;
      octx.drawImage(sheet, 0, 0, 18, 22, 0, 0, 18, 22);
      return out.toDataURL();
    });
    cache.set(key, p);
  }
  return p;
}

/** Full-body sprite (idle, facing down) for previews. */
export function fullBody(look: Look, trim: string, frame = 0, row = 0): Promise<string> {
  return loadBases().then(([a, b]) => {
    const sheet = document.createElement('canvas');
    sheet.width = FW * 7;
    sheet.height = 36 * 5;
    paintCrewSheet(look.body === 'b' ? b : a, sheet.getContext('2d')!, 0, 0, look, trim);
    const out = document.createElement('canvas');
    out.width = 18;
    out.height = 36;
    out.getContext('2d')!.drawImage(sheet, frame * 18, row * 36, 18, 36, 0, 0, 18, 36);
    return out.toDataURL();
  });
}

export function avatarImg(look: Look, trim: string, cls = 'avatar'): HTMLImageElement {
  const img = h('img', { class: cls, alt: '', width: 36, height: 44 });
  void portrait(look, trim).then((src) => (img.src = src));
  return img;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function timeAgo(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export function fmtTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
}
