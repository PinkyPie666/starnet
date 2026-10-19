// Thai UI labels and the Thai-capable font faces.
// The pixel fonts (Press Start 2P, VT323) have no Thai glyphs, so Thai text
// falls through to Chakra Petch, sized to sit next to the pixel fonts.

import type { AgentStatus } from '../core/types';
import thai400 from '@fontsource/chakra-petch/files/chakra-petch-thai-400-normal.woff2?url';
import thai600 from '@fontsource/chakra-petch/files/chakra-petch-thai-600-normal.woff2?url';

export const STATUS_TH: Record<AgentStatus, string> = {
  WORKING: 'กำลังทำงาน',
  IDLE: 'ว่าง',
  DONE: 'เสร็จแล้ว',
  ERROR: 'ผิดพลาด',
};

export function installThaiFonts() {
  const range = 'U+0E01-0E5B, U+200C-200D, U+25CC';
  const css = `
@font-face { font-family: 'ThaiBody'; src: url(${thai400}) format('woff2'); font-weight: 400; font-display: swap; unicode-range: ${range}; size-adjust: 82%; }
@font-face { font-family: 'ThaiHead'; src: url(${thai600}) format('woff2'); font-weight: 400; font-display: swap; unicode-range: ${range}; size-adjust: 150%; }
@font-face { font-family: 'ThaiRead'; src: url(${thai400}) format('woff2'); font-weight: 400; font-display: swap; unicode-range: ${range}; size-adjust: 86%; }
`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
}

export function timeAgoTh(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s} วินาทีที่แล้ว`;
  if (s < 3600) return `${Math.round(s / 60)} นาทีที่แล้ว`;
  if (s < 86400) return `${Math.round(s / 3600)} ชั่วโมงที่แล้ว`;
  return new Date(ts).toLocaleDateString('th-TH');
}
