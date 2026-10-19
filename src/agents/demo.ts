// Demo mode: scripted agents that stream plausible Thai output with no network.
// The text is a showcase of each class's style, not an answer to the prompt.

import type { Runner } from '../core/scheduler';
import type { ClassId, Task } from '../core/types';
import { getLang } from '../ui/i18n';
import { SCRIPTS_EN } from './demo-en';

function topicOf(prompt: string): string {
  const t = prompt.replace(/\s+/g, ' ').trim().replace(/[.?!]+$/, '');
  return t.length > 70 ? t.slice(0, 67) + '...' : t || 'งานที่ได้รับ';
}

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const NOTE = '> นี่คือผลงานจำลองจากโหมดตัวอย่าง เพื่อให้เห็นว่าลูกเรือคนนี้ทำงานแบบไหน ถ้าอยากได้คำตอบจริงตามโจทย์ ให้ใส่ API key ในหน้าตั้งค่าแล้วเลือก ใช้งานจริง\n\n';

const upstreamNote = (input: string | null) => (input ? `> ต่อยอดจากงานของลูกเรือคนก่อน (${input.length.toLocaleString()} ตัวอักษร)\n\n` : '');

const SCRIPTS: Record<ClassId, (topic: string, seed: number, input: string | null) => string> = {
  researcher: (topic, seed, input) => `# สรุปข้อมูล: ${topic}

${NOTE}${upstreamNote(input)}**คำถาม** ต้องรู้อะไรบ้างเกี่ยวกับเรื่องนี้ เพื่อตัดสินใจได้ภายในสัปดาห์นี้

## สิ่งที่พบ
- **ความต้องการมีจริง แต่ไม่เท่ากันทุกกลุ่ม** (ความมั่นใจ: กลาง) กลุ่มที่สนใจมากที่สุดคือ${pick(['ทีมเล็ก 2-5 คน', 'ฟรีแลนซ์', 'เจ้าของร้านออนไลน์'], seed)} ที่ใช้เครื่องมือหลายตัวอยู่แล้ว
- **อุปสรรคใหญ่คือการเปลี่ยนนิสัย** (ความมั่นใจ: สูง) คนจะไม่ย้ายมาใช้ ถ้าวันแรกยังไม่เห็นว่าประหยัดเวลาได้จริง
- **ราคาที่คนคุ้นเคยค่อนข้างต่ำ** (ความมั่นใจ: กลาง) เครื่องมือคล้ายกันอยู่ราว 250-700 บาทต่อคนต่อเดือน
- **ความน่าเชื่อถือสำคัญกว่าจำนวนฟีเจอร์** (ความมั่นใจ: กลาง) นโยบายข้อมูลที่อ่านเข้าใจง่ายช่วยได้มาก

## ภาพรวมทางเลือก
| แนวทาง | จุดแข็ง | จุดอ่อน |
|---|---|---|
| ครบในที่เดียว | จ่ายบิลเดียว | เรียนรู้นาน ฟีเจอร์ไม่ลึก |
| ทำเรื่องเดียวให้ดี | อธิบายง่าย เห็นผลเร็ว | ต้องเชื่อมกับเครื่องมืออื่น |
| โอเพนซอร์ส | น่าเชื่อถือ ปรับแต่งได้ | ภาระดูแลสูง |

## สิ่งที่ยังไม่รู้
1. กลุ่มไหนยอมจ่ายเงินเร็วที่สุด ทดลองได้ด้วยหน้าเว็บสองแบบภายในสองสัปดาห์
2. คนกังวลแค่ไหนกับการใช้งานผ่านเบราว์เซอร์แทนแอปในเครื่อง

## ข้อเสนอสำหรับคนถัดไป
- เปิดตัวด้วยงานเดียวที่ช่วยประหยัดเวลาได้ตั้งแต่วันแรก
- เขียนนโยบายข้อมูลเป็นภาษาคนก่อนเปิดตัว
- ตั้งราคาไม่เกิน 500 บาทจนกว่าจะมีข้อมูลการใช้งานต่อเนื่อง
`,
  strategist: (topic, seed, input) => `# แผนงาน: ${topic}

${NOTE}${upstreamNote(input)}**เป้าหมาย** มีผู้ใช้ประจำ ${pick(['500', '1,000', '300'], seed)} คนต่อสัปดาห์ภายใน 30 วัน ด้วยทีม 2 คน และไม่ใช้งบโฆษณา

## ทางเลือก
1. **เริ่มจากชุมชน** เดิมพันว่ากลุ่มเฉพาะจะบอกต่อ ต้นทุนต่ำ แต่ช้า ถ้าสัปดาห์แรกได้ไม่ถึง 50 คนแปลว่าทางนี้ไม่เวิร์ก
2. **เปิดตัวแบบจัดเต็มวันเดียว** ได้กระแสเร็ว แต่เสี่ยงว่าคนมาแล้วไม่กลับมา
3. **จับมือพาร์ตเนอร์** เข้าถึงฐานลูกค้าเดิมของคนอื่น แต่ต้องพึ่งเขา

**แนะนำทางที่ 1 แล้วเสริมด้วยการเปิดตัวในสัปดาห์ที่ 3** เพราะผลสะสมได้ และทีมไม่กระจายแรง

## ขั้นตอน
| สัปดาห์ | ผู้รับผิดชอบ | สิ่งที่ทำ | ตัววัดผล |
|---|---|---|---|
| 1 | ผู้ก่อตั้ง | คุยกับผู้ใช้ 20 คน แก้ปัญหาที่เจอบ่อย 3 อันดับแรก | 10 คนกลับมาใช้ซ้ำ |
| 2 | นักพัฒนา | ทำขั้นตอนเริ่มใช้งานและปุ่มแชร์ | 30% กลับมาใช้ในวันที่ 7 |
| 3 | ทั้งทีม | โพสต์เปิดตัว คลิปเดโม 30 วินาที ไลฟ์ตอบคำถาม | สมัคร 300 คน |
| 4 | ผู้ก่อตั้ง | ทุ่มกับช่องทางที่ได้ผลที่สุด | ผู้ใช้ประจำ 500 คน |

## ความเสี่ยงและวิธีรับมือ
- **เปิดตัวแล้วเงียบ:** แผนชุมชนยังเดินต่อ การเปิดตัวเป็นแค่โบนัส
- **ตอบลูกค้าไม่ทัน:** เตรียมคำตอบสำเร็จรูปและหน้าถามตอบภายในสัปดาห์ที่ 2

## สามสิ่งที่ทำได้เลยสัปดาห์นี้
1. นัดคุยกับคนในรายชื่อรอใช้
2. อัดคลิปเดโม 30 วินาที
3. ร่างโพสต์เปิดตัว
`,
  coder: (topic, _seed, input) => `# โค้ด: ${topic}

${NOTE}${upstreamNote(input)}แนวทาง: โมดูล TypeScript ขนาดเล็ก ไม่ต้องติดตั้งไลบรารีเพิ่ม มี type ชัดเจนและมีเทสต์ ใช้ได้กับ Node 20 ขึ้นไปและเบราว์เซอร์รุ่นใหม่

\`\`\`ts
export interface DebounceOptions {
  leading?: boolean;
  trailing?: boolean;
}

export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  wait: number,
  { leading = false, trailing = true }: DebounceOptions = {},
) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: A | null = null;

  const debounced = (...args: A) => {
    const callNow = leading && timer === null;
    lastArgs = args;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (trailing && lastArgs && !callNow) fn(...lastArgs);
      lastArgs = null;
    }, wait);
    if (callNow) fn(...args);
  };

  debounced.cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    lastArgs = null;
  };

  return debounced;
}
\`\`\`

## เทสต์
\`\`\`ts
import { describe, it, expect, vi } from 'vitest';
import { debounce } from './debounce';

describe('debounce', () => {
  it('เรียกครั้งเดียวหลังรอครบเวลา', () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    const d = debounce(spy, 100);
    d(1); d(2); d(3);
    vi.advanceTimersByTime(100);
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(3);
  });
});
\`\`\`

## หมายเหตุ
- ทำงานแบบ O(1) ต่อการเรียกหนึ่งครั้ง และ \`cancel()\` ยกเลิกงานที่ค้างอยู่ได้
- ถ้ามีเวลาเพิ่ม: เพิ่ม \`flush()\` และตัวเลือก \`maxWait\`
`,
  copywriter: (topic, seed, input) => `# ข้อความ: ${topic}

${NOTE}${upstreamNote(input)}**กลุ่มเป้าหมาย:** คนทำงานยุ่งๆ ที่อยากได้ผลลัพธ์โดยไม่ต้องคอยเฝ้า **น้ำเสียง:** สบายๆ ชัดเจน มีความขี้เล่นนิดๆ

## หัวข้อหลัก
**${pick(['ทีม AI ของคุณ ทำงานให้ดูสดๆ', 'ส่งงานไป แล้วนั่งดูมันเสร็จ', 'ห้องบัญชาการสำหรับงานที่คุณมอบหมาย'], seed)}**

สั่งงานปุ๊บ ลูกเรือเดินไปนั่งโต๊ะแล้วเริ่มพิมพ์ทันที เสร็จเมื่อไหร่ก็ถือผลงานมาส่งถึงมือ

[ เริ่มภารกิจแรก ]

## จุดเด่น 3 ข้อ
- **เห็นงานเดินจริง** ทุกคนพิมพ์ให้ดูสด ไม่ต้องจ้องวงกลมหมุนรอ
- **ส่งต่อกันเป็นทอด** ให้นักวิจัยหาข้อมูล ส่งต่อให้นักวางแผน แล้วให้นักเขียนปิดงาน
- **ข้อมูลอยู่ในเครื่องคุณ** ไม่มีเซิร์ฟเวอร์กลาง key ของคุณไม่ไปไหน

## หัวข้อสำรอง
1. สั่งงานแบบผู้บัญชาการสถานีอวกาศ
2. พิมพ์สั่งน้อยลง ได้งานมากขึ้น

**เหตุผล:** หัวข้อหลักบอกทั้งผลลัพธ์และความรู้สึกตอนได้นั่งดูงานเดิน ซึ่งเป็นสิ่งที่ทำให้แตกต่างจากที่อื่น
`,
  reviewer: (topic, _seed, input) => `# ผลตรวจ: ${topic}

${NOTE}${upstreamNote(input)}**สรุป: ใช้ได้ แต่ต้องแก้ก่อน**

## ปัญหาที่พบ
1. **ร้ายแรง - ไม่มีตัวชี้วัดความสำเร็จ** คำว่า "เปิดตัว" ไม่ใช่เป้าหมาย แก้: กำหนดตัวเลขเดียว เช่น มีคนสมัคร 300 คนใน 7 วัน
2. **สำคัญ - วันที่ไม่เหมาะ** เปิดตัววันศุกร์จะเสียคนดูช่วงเสาร์อาทิตย์ แก้: เลือกวันอังคารถึงพฤหัส ช่วงเช้า
3. **สำคัญ - ไม่มีรายชื่อคนรอใช้** เท่ากับเริ่มจากศูนย์ แก้: ทำหน้ารับอีเมลล่วงหน้า 2 สัปดาห์ ให้ได้อย่างน้อย 200 รายชื่อ
4. **เล็กน้อย - ปุ่มชวนกดไม่ชัด** คำว่า "ดูเพิ่มเติม" ทำให้ลังเล แก้: ใช้ "เริ่มใช้ฟรี" หรือ "ลองเดโม"

## สิ่งที่ดีอยู่แล้ว ควรเก็บไว้
- เน้นให้ลองเดโมได้ทันทีโดยไม่ต้องสมัคร เป็นจุดแข็งที่สุด
- รายการจุดเด่นที่สั้น 3 ข้อดีกว่ายาว 10 ข้อ

## ขั้นต่อไป
แก้แผนให้มีตัวเลข วันที่ และรายชื่อรอใช้ แล้วส่งกลับมาให้ตรวจอีกรอบ
`,
  ops: (topic, _seed, input) => `# ขั้นตอนการทำงาน: ${topic}

${NOTE}${upstreamNote(input)}**ขอบเขต:** เว็บแบบ static อัปจาก branch main ใครเข้าเวรก็ทำตามได้ ถือว่าเสร็จเมื่อเวอร์ชันใหม่ขึ้นจริงและตรวจแล้ว

## เช็กลิสต์ก่อนอัป
1. \`git pull && npm ci\` ติดตั้งต้องผ่านโดยไม่มีคำเตือน
2. \`npm test\` ต้องผ่านทั้งหมด **ถ้าไม่ผ่านให้หยุดก่อน**
3. \`npm run build\` ตรวจว่ามีไฟล์ \`dist/index.html\` และขนาดไฟล์ไม่เกินที่กำหนด
4. \`netlify deploy --dir=dist\` เปิดลิงก์ทดลอง คลิกดูหน้าหลักให้ครบ
5. \`netlify deploy --dir=dist --prod\` จดเลข deploy ไว้
6. ตรวจซ้ำ: เปิดเว็บจริงในหน้าต่างไม่ระบุตัวตน ดูว่าไม่มี error ใน console

## วิธีย้อนกลับ
1. หน้า Netlify ไปที่ Deploys เลือกเวอร์ชันก่อนหน้าที่ดี กด Publish deploy
2. แจ้งทีมว่าพังเพราะอะไร ย้อนไปเวอร์ชันไหน และจะทำอะไรต่อ

## ปัญหาที่เจอบ่อย
| อาการ | สังเกตจาก | วิธีแก้ |
|---|---|---|
| หน้าขาว | มี error ตอนโหลด | ย้อนเวอร์ชัน แล้วเช็ก path ของไฟล์ |
| รีเฟรชแล้ว 404 | ลิงก์ย่อยเปิดไม่ได้ | เพิ่มกฎ redirect สำหรับ SPA |
| ยังเห็นของเก่า | ไฟล์ยังเป็นชุดเดิม | ล้างแคชแล้วอัปใหม่ |

## ทำให้อัตโนมัติต่อ
ให้ระบบ CI รันข้อ 1 ถึง 4 ทุกครั้งที่เปิด pull request แล้วแปะลิงก์ทดลองไว้ในคอมเมนต์
`,
};

export function demoScript(cls: ClassId, task: Task): string {
  const topic = topicOf(task.prompt);
  const scripts = getLang() === 'en' ? SCRIPTS_EN : SCRIPTS;
  return scripts[cls](topic, hash(task.prompt + task.id), task.input);
}

// Thai has no spaces between words, so split by word where the browser can.
function chunks(text: string): string[] {
  const Seg = (Intl as any).Segmenter;
  if (Seg) return Array.from(new Seg('th', { granularity: 'word' }).segment(text), (s: any) => s.segment as string);
  return text.match(/[\s\S]{1,3}/g) ?? [text];
}

/** Streams the scripted text in word-sized chunks at a believable speed. */
export function demoRunner(cls: ClassId, speed = 1): Runner {
  return async ({ task, signal, text, progress }) => {
    const full = demoScript(cls, task);
    const tokens = chunks(full);
    const tokensPerSec = (22 + (hash(task.id) % 14)) * speed;
    // a short "thinking" pause before the first token, like a real model
    await sleep(500 + (hash(task.id) % 700), signal);
    let i = 0;
    while (i < tokens.length) {
      if (signal.aborted) throw abortError();
      const burst = 1 + (Math.random() * 3) | 0;
      text(tokens.slice(i, i + burst).join(''));
      i += burst;
      progress(i / tokens.length);
      await sleep((burst / tokensPerSec) * 1000 * (0.6 + Math.random() * 0.8), signal);
    }
    return { input: Math.ceil((task.prompt.length + (task.input?.length ?? 0)) / 4) + 300, output: Math.ceil(full.length / 4) };
  };
}

function abortError() {
  const e = new Error('stopped');
  e.name = 'AbortError';
  return e;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(abortError());
    const t = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(abortError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
