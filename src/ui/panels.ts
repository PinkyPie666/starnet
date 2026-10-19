// Dialogs, loaded on first use: how-to guide, new task, recruitment,
// pipeline, settings and the result viewer.

import { addAgent, bus, deleteResult, getAgent, makeAgent, markRead, state, updateSettings } from '../core/store';
import type { Agent, ClassId, Look, ModelId, PanelId } from '../core/types';
import { CLASSES, CLASS_IDS, DEFAULT_MODEL, MODELS } from '../agents/classes';
import { assignTask, runPipeline, scheduler } from '../app';
import { downloadFile, getApiKey, maskKey, setApiKey, testKey } from '../agents/live';
import { describeRepeat, loadSchedules, saveSchedules, type Repeat } from '../core/schedules';
import { addUsage, resetSpend, usedToday } from '../agents/spend';
import { HAIR_COLORS, SKIN_TONES, UNIFORMS } from '../game/palette';
import { MAX_CREW_SLOTS } from '../game/atlas';
import { avatarImg, btn, fmtTokens, fullBody, h } from './dom';
import { icon } from './icons';
import { renderMarkdown } from './markdown';
import { STATUS_TH } from './th';
import { getLang, tr } from './i18n';

const HAIR_STYLES_TH = ['สั้น', 'ยาว', 'ทรงหงอน', 'โกนเกรียน'];
const UNIFORM_TH = ['น้ำเงินสถานี', 'ทองบัญชาการ', 'เขียววิศวกร', 'ม่วงวิทยาศาสตร์', 'แดงรักษาการณ์', 'เทาปฏิบัติการ'];

let current: HTMLElement | null = null;
let lastFocus: Element | null = null;

function close() {
  current?.remove();
  current = null;
  (lastFocus as HTMLElement | null)?.focus?.();
}

function modal(title: string, ic: string, body: Node[], foot: Node[], wide = false) {
  close();
  lastFocus = document.activeElement;
  const m = h(
    'div',
    { class: `modal panel ${wide ? 'wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'modal-head' }, h('div', { class: 'panel-title' }, icon(ic, 14), title), btn('ปิด', { icon: 'x', iconOnly: true, kind: 'ghost', small: true, onClick: close })),
    h('div', { class: 'modal-body' }, ...body),
    foot.length ? h('div', { class: 'modal-foot' }, ...foot) : null,
  );
  const scrim = h('div', { class: 'scrim', on: { mousedown: (e: MouseEvent) => e.target === scrim && close() } }, m);
  scrim.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  });
  document.body.append(scrim);
  current = scrim;
  const first = m.querySelector<HTMLElement>('textarea, input, select, .modal-body button');
  setTimeout(() => first?.focus(), 30);
  return m;
}

export function open(panel: PanelId, arg?: string) {
  if (panel === 'task') return taskPanel(arg);
  if (panel === 'recruit') return recruitPanel();
  if (panel === 'pipeline') return pipelinePanel();
  if (panel === 'settings') return settingsPanel();
  if (panel === 'help') return helpPanel();
  if (panel === 'schedules') return schedulesPanel();
  if (panel === 'result' && arg) return resultPanel(arg);
}

function modeNotice() {
  return state.settings.mode === 'live'
    ? h(
        'div',
        { class: 'notice' },
        icon('key', 16),
        h('span', null, `โหมดใช้งานจริง: ลูกเรือจะเรียก Claude จริงด้วย key ของคุณ วันนี้ใช้ไป ${fmtTokens(usedToday())} จากเพดาน ${fmtTokens(state.settings.dailyTokenLimit)} โทเคน`),
      )
    : h(
        'div',
        { class: 'notice warn' },
        icon('monitor', 16),
        h('span', null, 'ตอนนี้เป็นโหมดตัวอย่าง: ผลงานเป็นข้อความจำลองเพื่อดูการทำงาน ไม่ได้ตอบโจทย์ของคุณจริง ถ้าอยากได้งานจริง ไปที่ ตั้งค่า แล้วใส่ API key และเลือก ใช้งานจริง'),
        btn('ตั้งค่า', { icon: 'settings', small: true, onClick: () => settingsPanel() }),
      );
}

function agentPicker(selectedId: string | null, onPick: (a: Agent) => void, filter?: (a: Agent) => boolean) {
  const wrap = h('div', { class: 'pick-list' });
  const paint = (sel: string | null) => {
    wrap.replaceChildren(
      ...state.agents.filter(filter ?? (() => true)).map((a) => {
        const cls = CLASSES[a.cls];
        return h(
          'button',
          { class: 'pick', type: 'button', 'aria-pressed': String(a.id === sel), style: { borderColor: a.id === sel ? cls.color : '' }, on: { click: () => (onPick(a), paint(a.id)) } },
          avatarImg(a.look, cls.color),
          h('div', null, h('span', null, a.name), h('small', null, `${cls.title} / ${STATUS_TH[a.status]}`)),
        );
      }),
    );
  };
  paint(selectedId);
  return wrap;
}

// ---------------------------------------------------------------- help -----

const HELP_SEEN = 'starnet.helpSeen';

export function maybeShowHelp() {
  try {
    if (localStorage.getItem(HELP_SEEN)) return;
    localStorage.setItem(HELP_SEEN, '1');
  } catch {
    return;
  }
  helpPanel();
}

function helpPanel() {
  const step = (n: number, title: string, body: string) =>
    h('div', { class: 'help-step' }, h('div', { class: 'help-num' }, String(n)), h('div', null, h('b', null, title), h('p', null, body)));
  modal(
    'วิธีใช้ STARNET',
    'help',
    [
      h(
        'p',
        { class: 'help-lead' },
        'STARNET คือออฟฟิศ AI ในรูปแบบเกม ลูกเรือแต่ละคนคือผู้ช่วย AI ที่ถนัดงานคนละแบบ สั่งงานแล้วเขาจะเดินไปนั่งที่โต๊ะ พิมพ์งานให้ดูสดๆ แล้วเดินถือผลงานมาส่งที่กล่องงานที่เสร็จ',
      ),
      step(1, 'เลือกโหมด', 'โหมดตัวอย่าง (ค่าเริ่มต้น) ใช้ฟรี แต่เป็นข้อความจำลองไว้ดูการทำงานเฉยๆ ถ้าอยากได้งานจริง ให้ใส่ API key ของ Anthropic ในหน้าตั้งค่า แล้วเลือก ใช้งานจริง'),
      step(2, 'สั่งงาน', 'กดปุ่ม สั่งงาน เลือกลูกเรือที่ถนัดงานนั้น พิมพ์สิ่งที่ต้องการเป็นภาษาไทยได้เลย ถ้ามีเอกสารหรือข้อมูลประกอบ ให้วางในช่อง ข้อมูลประกอบ'),
      step(3, 'ดูเขาทำงาน', 'คลิกที่ลูกเรือ (ในแผนที่หรือในรายชื่อด้านซ้าย) จะเห็นข้อความที่เขากำลังเขียนแบบสดๆ กดหยุดได้ทุกเมื่อ'),
      step(4, 'รับงาน', 'งานที่เสร็จจะไปอยู่ใน กล่องงานที่เสร็จ (ปุ่มด้านบนขวา) เปิดอ่าน คัดลอก ดาวน์โหลดเป็นไฟล์ .md หรือส่งต่อให้ลูกเรือคนอื่นทำต่อได้'),
      step(5, 'งานต่อกัน', 'ให้หลายคนทำงานเป็นทอดๆ เช่น นักวิจัยหาข้อมูล แล้วส่งให้นักวางกลยุทธ์ทำแผน แล้วส่งให้นักเขียนคำโฆษณาเขียนโพสต์ ผลงานจะไหลไปบนสายพานในห้องโรงงาน'),
      h(
        'div',
        { class: 'help-classes' },
        h('b', null, 'ลูกเรือแต่ละแบบถนัดอะไร'),
        ...CLASS_IDS.map((id) => {
          const c = CLASSES[id];
          return h('div', { class: 'help-class', style: { '--cls': c.color } as any }, icon(c.icon, 14), h('span', null, h('b', null, c.title), ` ${c.blurb}`));
        }),
      ),
      h(
        'div',
        { class: 'notice' },
        icon('key', 16),
        h(
          'span',
          null,
          'หา API key ได้ที่ console.anthropic.com (เมนู API Keys) ต้องเติมเครดิตก่อนใช้ key จะถูกเก็บไว้ในเบราว์เซอร์เครื่องนี้เท่านั้น และส่งไปที่ api.anthropic.com เท่านั้น ไม่มีเซิร์ฟเวอร์ของเราเกี่ยวข้อง',
        ),
      ),
    ],
    [
      btn('ตั้งค่า API key', { icon: 'key', onClick: () => settingsPanel() }),
      btn('ลองสั่งงานแรก', { icon: 'send', kind: 'primary', onClick: () => taskPanel() }),
    ],
    true,
  );
}

// ---------------------------------------------------------------- task -----

function taskPanel(agentId?: string, preset?: { input: string; from: string }) {
  let chosen = agentId ? getAgent(agentId) : state.agents.find((a) => a.status === 'IDLE') ?? state.agents[0];
  const ta = h('textarea', { placeholder: 'อยากให้ทำอะไร พิมพ์เป็นภาษาไทยได้เลย เช่น เขียนแคปชันขายเสื้อยืด 5 แบบ สำหรับโพสต์ในเฟซบุ๊ก', maxlength: 8000 }) as HTMLTextAreaElement;
  const ctx = h('textarea', { class: 'ctx', placeholder: 'ไม่บังคับ: วางเอกสาร ข้อมูลสินค้า บทความ หรือโค้ดที่อยากให้ใช้ประกอบงาน', maxlength: 60000 }) as HTMLTextAreaElement;
  if (preset) ctx.value = preset.input;
  const rep = h(
    'select',
    null,
    h('option', { value: 'once' }, 'ทำครั้งเดียว'),
    h('option', { value: 'daily' }, 'ทุกวัน ตามเวลาที่ตั้ง'),
    h('option', { value: 'hourly' }, 'ทุกๆ กี่ชั่วโมง'),
  ) as HTMLSelectElement;
  const at = h('input', { type: 'time', value: '08:00' }) as HTMLInputElement;
  const every = h('input', { type: 'number', min: 1, max: 168, value: 6 }) as HTMLInputElement;
  rep.addEventListener('change', () => {
    (at.parentElement as HTMLElement).style.display = rep.value === 'daily' ? '' : 'none';
    (every.parentElement as HTMLElement).style.display = rep.value === 'hourly' ? '' : 'none';
  });
  const sample = btn('ใช้ตัวอย่าง', {
    icon: 'reset',
    small: true,
    kind: 'ghost',
    onClick: () => {
      if (chosen) ta.value = tr(CLASSES[chosen.cls].samplePrompt);
    },
  });
  const who = h('div', { class: 'field-note' });
  const paintWho = () => {
    if (!chosen) return;
    const busy = scheduler.isBusy(chosen.id);
    who.textContent = `${chosen.name} (${CLASSES[chosen.cls].title}) ${busy ? 'ยังทำงานอื่นอยู่ งานนี้จะต่อคิวไว้' : 'จะเดินไปที่โต๊ะแล้วเริ่มทำงานทันที'}`;
  };
  paintWho();
  const go = btn('ส่งงาน', {
    icon: 'send',
    kind: 'primary',
    onClick: () => {
      if (!chosen || !ta.value.trim()) {
        ta.focus();
        return;
      }
      const input = ctx.value.trim() || null;
      const repeat: Repeat | null =
        rep.value === 'daily' ? { kind: 'daily', time: at.value || '08:00' } : rep.value === 'hourly' ? { kind: 'hourly', every: Math.max(1, +every.value || 1) } : null;
      if (repeat) {
        const list = loadSchedules();
        list.push({ id: `sch-${Date.now().toString(36)}`, agentId: chosen.id, prompt: ta.value.trim(), input, repeat, enabled: true, lastRun: Date.now(), createdAt: Date.now() });
        saveSchedules(list);
        bus.emit('toast', { kind: 'ok', text: `ตั้งเวลาแล้ว: ${describeRepeat(repeat)} (ทำงานเมื่อเปิดหน้านี้ค้างไว้)` });
      }
      assignTask(chosen.id, ta.value, input);
      bus.emit('ui:select', { agentId: chosen.id });
      close();
    },
  });
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) go.click();
  });
  modal(
    preset ? `ส่งต่องานจาก ${preset.from}` : 'สั่งงานใหม่',
    'send',
    [
      modeNotice(),
      h('div', { class: 'field' }, 'เลือกลูกเรือ', agentPicker(chosen?.id ?? null, (a) => ((chosen = a), paintWho()))),
      who,
      h('label', { class: 'field' }, 'งานที่ต้องการ', ta),
      h('div', { class: 'row' }, sample, h('span', { class: 'field-note' }, 'กด Ctrl+Enter เพื่อส่ง')),
      h('label', { class: 'field' }, preset ? 'ผลงานที่ส่งต่อมา (แก้ได้)' : 'ข้อมูลประกอบ', ctx),
      h(
        'div',
        { class: 'row' },
        h('label', { class: 'field grow' }, 'ทำซ้ำ', rep),
        h('label', { class: 'field', style: { display: 'none' } }, 'เวลา', at),
        h('label', { class: 'field', style: { display: 'none' } }, 'ทุกกี่ชั่วโมง', every),
      ),
    ],
    [btn('ยกเลิก', { kind: 'ghost', onClick: close }), go],
    true,
  );
  if (preset) setTimeout(() => ta.focus(), 40);
}

// ------------------------------------------------------------- recruit -----

const NAMES = ['ORION', 'VEGA', 'KITE', 'ECHO', 'ZED', 'MIRA', 'SOL', 'IONA', 'RHO', 'CYAN', 'JUNO', 'PAX', 'TESS', 'AXEL', 'NYX', 'BOLT', 'KAI', 'LUX'];

function recruitPanel() {
  if (state.agents.length >= MAX_CREW_SLOTS) {
    bus.emit('toast', { kind: 'warn', text: `สถานีเต็มแล้ว (สูงสุด ${MAX_CREW_SLOTS} คน)` });
    return;
  }
  let cls: ClassId = 'researcher';
  let model: ModelId = DEFAULT_MODEL;
  const look: Look = { body: Math.random() < 0.5 ? 'a' : 'b', skin: (Math.random() * SKIN_TONES.length) | 0, hair: (Math.random() * HAIR_COLORS.length) | 0, hairStyle: (Math.random() * 4) | 0, uniform: (Math.random() * UNIFORMS.length) | 0 };
  const used = new Set(state.agents.map((a) => a.name));
  const name = h('input', { type: 'text', maxlength: 12, value: NAMES.find((n) => !used.has(n)) ?? `UNIT${state.agents.length + 1}`, 'aria-label': 'ชื่อเรียก' }) as HTMLInputElement;
  name.addEventListener('input', () => (name.value = name.value.toUpperCase().replace(/[^A-Z0-9 \-]/g, '')));
  const preview = h('img', { alt: 'ตัวอย่างลูกเรือ', class: 'pixel' }) as HTMLImageElement;
  const podTag = h('div', { class: 'pod-tag' });
  let frame = 0;
  let row = 0;
  const repaint = () => {
    void fullBody(look, CLASSES[cls].color, frame, row).then((src) => (preview.src = src));
    podTag.textContent = `${CLASSES[cls].tag} / ${UNIFORM_TH[look.uniform]}`;
  };
  const spin = setInterval(() => {
    if (!document.body.contains(preview)) return clearInterval(spin);
    frame = (frame + 1) % 7;
    if (frame === 0) row = (row + 1) % 4;
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) repaint();
  }, 160);

  const classGrid = h('div', { class: 'choice-grid' });
  const paintClasses = () =>
    classGrid.replaceChildren(
      ...CLASS_IDS.map((id) => {
        const c = CLASSES[id];
        return h(
          'button',
          { class: 'choice', type: 'button', 'aria-pressed': String(id === cls), style: { '--cls': c.color } as any, on: { click: () => ((cls = id), paintClasses(), repaint()) } },
          h('b', null, icon(c.icon, 14), c.title),
          c.blurb,
        );
      }),
    );
  paintClasses();

  const swatchRow = (label: string, colors: string[], get: () => number, set: (i: number) => void) => {
    const row = h('div', { class: 'swatches', role: 'group', 'aria-label': label });
    const paint = () =>
      row.replaceChildren(
        ...colors.map((c, i) =>
          h('button', { class: 'swatch', type: 'button', title: `${label} ${i + 1}`, 'aria-label': `${label} ${i + 1}`, 'aria-pressed': String(get() === i), style: { background: c }, on: { click: () => (set(i), paint(), repaint()) } }),
        ),
      );
    paint();
    return h('div', { class: 'field' }, label, row);
  };
  const styleSel = h(
    'select',
    { on: { change: (e: Event) => ((look.hairStyle = +(e.target as HTMLSelectElement).value), repaint()) } },
    ...HAIR_STYLES_TH.map((s, i) => h('option', { value: i, selected: i === look.hairStyle }, s)),
  );
  const bodySel = h(
    'select',
    { on: { change: (e: Event) => ((look.body = (e.target as HTMLSelectElement).value as 'a' | 'b'), repaint()) } },
    h('option', { value: 'a', selected: look.body === 'a' }, 'รูปร่าง A'),
    h('option', { value: 'b', selected: look.body === 'b' }, 'รูปร่าง B'),
  );
  const modelSel = h(
    'select',
    { on: { change: (e: Event) => (model = (e.target as HTMLSelectElement).value as ModelId) } },
    ...MODELS.map((m) => h('option', { value: m.id, selected: m.id === model }, `${m.label} (${m.note})`)),
  );
  repaint();

  modal(
    'ห้องรับลูกเรือใหม่',
    'user-plus',
    [
      h(
        'div',
        { class: 'recruit-grid' },
        h('div', { class: 'preview-pod' }, preview, podTag),
        h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
          h('label', { class: 'field' }, 'ชื่อเรียก (ภาษาอังกฤษ/ตัวเลข)', name),
          h('div', { class: 'row' }, h('label', { class: 'field grow' }, 'ทรงผม', styleSel), h('label', { class: 'field grow' }, 'รูปร่าง', bodySel)),
          swatchRow('ชุด', UNIFORMS.map((u) => u[0]), () => look.uniform, (i) => (look.uniform = i)),
          swatchRow('สีผิว', SKIN_TONES.map((s) => s[0]), () => look.skin, (i) => (look.skin = i)),
          swatchRow('สีผม', HAIR_COLORS.map((s) => s[0]), () => look.hair, (i) => (look.hair = i)),
        ),
      ),
      h('div', { class: 'field' }, 'ความถนัด', classGrid),
      h('label', { class: 'field' }, 'โมเดล (ใช้ในโหมดใช้งานจริง)', modelSel),
    ],
    [
      btn('ยกเลิก', { kind: 'ghost', onClick: close }),
      btn('เรียกตัว', {
        icon: 'user-plus',
        kind: 'amber',
        onClick: () => {
          const n = name.value.trim() || 'RECRUIT';
          const a = makeAgent(n, cls, { ...look }, model);
          addAgent(a);
          bus.emit('toast', { kind: 'ok', text: `${a.name} (${CLASSES[cls].title}) เข้าร่วมทีมแล้ว` });
          close();
          setTimeout(() => bus.emit('ui:select', { agentId: a.id }), 300);
        },
      }),
    ],
    true,
  );
}

// ------------------------------------------------------------ pipeline -----

function pipelinePanel() {
  const chain: Agent[] = [];
  const byClass = (c: ClassId) => state.agents.find((a) => a.cls === c && !chain.includes(a));
  for (const c of ['researcher', 'strategist', 'copywriter'] as ClassId[]) {
    const a = byClass(c);
    if (a) chain.push(a);
  }
  const chainEl = h('div', { class: 'chain' });
  const MAX = 4;
  const ta = h('textarea', { placeholder: 'โจทย์ของทั้งทีม เช่น ทำแผนเปิดตัวร้านกาแฟเปิดใหม่ในเชียงใหม่ พร้อมโพสต์ประกาศ' }) as HTMLTextAreaElement;
  ta.value = tr('ทำแผนเปิดตัวร้านกาแฟเปิดใหม่ในเชียงใหม่ แล้วเขียนโพสต์เฟซบุ๊กประกาศเปิดร้าน');
  const go = btn('เริ่มงานต่อกัน', {
    icon: 'workflow',
    kind: 'primary',
    onClick: () => {
      if (chain.length < 2 || !ta.value.trim()) return;
      runPipeline(
        chain.map((a) => a.id),
        ta.value,
      );
      bus.emit('toast', { kind: 'info', text: `เริ่มงานต่อกัน: ${chain.map((a) => a.name).join(' > ')}` });
      close();
    },
  });
  const paintChain = () => {
    const parts: Node[] = [];
    chain.forEach((a, i) => {
      if (i) parts.push(h('div', { class: 'chain-arrow' }, icon('arrow-right', 18)));
      const cls = CLASSES[a.cls];
      parts.push(
        h(
          'div',
          { class: 'chain-step', style: { '--cls': cls.color } as any },
          `${i + 1}. ${a.name}`,
          h('span', { class: 'tag' }, cls.tag),
          btn('เอาออก', { icon: 'x', iconOnly: true, small: true, kind: 'ghost', onClick: () => (chain.splice(i, 1), paintChain(), paintPicker()) }),
        ),
      );
    });
    if (!chain.length) parts.push(h('div', { class: 'field-note' }, 'เลือกลูกเรือด้านล่างตามลำดับที่ต้องการ'));
    chainEl.replaceChildren(...parts);
    go.disabled = chain.length < 2;
  };
  const pickerHost = h('div');
  const paintPicker = () =>
    pickerHost.replaceChildren(
      agentPicker(
        null,
        (a) => {
          if (chain.length < MAX && !chain.includes(a)) chain.push(a);
          paintChain();
          paintPicker();
        },
        (a) => !chain.includes(a),
      ),
    );
  paintChain();
  paintPicker();
  modal(
    'งานต่อกัน (หลายคนทำเป็นทอด)',
    'workflow',
    [
      modeNotice(),
      h('div', { class: 'field-note' }, 'เลือกได้สูงสุด 4 คน คนแรกทำก่อน แล้วผลงานจะวิ่งไปบนสายพานในห้องโรงงานให้คนถัดไปทำต่อ คนสุดท้ายจะเอางานไปส่งที่กล่องงานที่เสร็จ'),
      h('div', { class: 'field' }, 'ลำดับการทำงาน', chainEl),
      h('div', { class: 'field' }, 'เพิ่มลูกเรือ', pickerHost),
      h('label', { class: 'field' }, 'โจทย์', ta),
    ],
    [btn('ยกเลิก', { kind: 'ghost', onClick: close }), go],
    true,
  );
}

// ------------------------------------------------------------ settings -----

function settingsPanel() {
  const s = state.settings;
  let mode = s.mode;
  let reveal = false;
  const key = h('input', { type: 'password', value: getApiKey(), placeholder: 'sk-ant-...', autocomplete: 'off', spellcheck: false, 'aria-label': 'Anthropic API key' }) as HTMLInputElement;
  const eye = btn('แสดง key', {
    icon: 'eye',
    iconOnly: true,
    small: true,
    onClick: () => {
      reveal = !reveal;
      key.type = reveal ? 'text' : 'password';
      eye.replaceChildren(icon(reveal ? 'eye-off' : 'eye', 14));
    },
  });
  const testOut = h('span', { class: 'field-note' });
  const testBtn = btn('ทดสอบ key', {
    icon: 'check',
    small: true,
    onClick: async () => {
      testBtn.disabled = true;
      testOut.textContent = 'กำลังทดสอบ...';
      try {
        const used = await testKey(key.value.trim());
        addUsage(used);
        testOut.textContent = `ใช้งานได้ (ใช้ไป ${used} โทเคน)`;
        testOut.style.color = 'var(--teal)';
      } catch (err) {
        testOut.textContent = (err as Error).message;
        testOut.style.color = 'var(--red)';
      } finally {
        testBtn.disabled = false;
      }
    },
  });
  const modeGrid = h('div', { class: 'choice-grid' });
  const paintMode = () =>
    modeGrid.replaceChildren(
      h('button', { class: 'choice', type: 'button', 'aria-pressed': String(mode === 'demo'), on: { click: () => ((mode = 'demo'), paintMode()) } }, h('b', null, icon('monitor', 14), 'โหมดตัวอย่าง'), 'ข้อความจำลอง ไว้ดูการทำงาน ไม่ต้องมี key ไม่เสียเงิน'),
      h('button', { class: 'choice', type: 'button', 'aria-pressed': String(mode === 'live'), on: { click: () => ((mode = 'live'), paintMode()) } }, h('b', null, icon('key', 14), 'ใช้งานจริง'), 'เรียก Claude จริงด้วย key ของคุณ ได้งานจริงตามโจทย์'),
    );
  paintMode();
  const limit = h('input', { type: 'number', min: 1000, step: 1000, value: s.dailyTokenLimit }) as HTMLInputElement;
  const maxOut = h('input', { type: 'number', min: 256, max: 16000, step: 256, value: s.maxOutputTokens }) as HTMLInputElement;
  const crt = h('input', { type: 'checkbox', checked: s.crt }) as HTMLInputElement;
  const auto = h('input', { type: 'checkbox', checked: s.autopilot }) as HTMLInputElement;
  const web = h('input', { type: 'checkbox', checked: s.webSearch }) as HTMLInputElement;
  const fetchBox = h('input', { type: 'checkbox', checked: s.webFetch }) as HTMLInputElement;
  const codeBox = h('input', { type: 'checkbox', checked: s.codeExec }) as HTMLInputElement;
  const usedEl = h('span', null, `วันนี้ใช้ไป ${usedToday().toLocaleString()} โทเคน`);

  modal(
    'ตั้งค่า',
    'settings',
    [
      h('div', { class: 'field' }, 'โหมด', modeGrid),
      h('label', { class: 'field' }, 'Anthropic API key (สำหรับโหมดใช้งานจริง)', h('div', { class: 'row' }, h('div', { class: 'grow' }, key), eye, testBtn)),
      testOut,
      h(
        'div',
        { class: 'notice' },
        icon('shield-check', 16),
        h(
          'span',
          null,
          'ขอ key ได้ที่ console.anthropic.com เมนู API Keys (ต้องเติมเครดิตก่อน) key จะเก็บไว้ในเบราว์เซอร์เครื่องนี้เท่านั้น และส่งตรงไปที่ api.anthropic.com เท่านั้น STARNET ไม่มีเซิร์ฟเวอร์ แนะนำให้ตั้งวงเงินใช้จ่ายของ key ไว้ด้วย และกด ลบ key เมื่อใช้เสร็จบนเครื่องคนอื่น',
        ),
      ),
      h('div', { class: 'row' }, h('label', { class: 'field grow' }, 'เพดานโทเคนต่อวัน', limit), h('label', { class: 'field grow' }, 'ความยาวคำตอบสูงสุดต่องาน (โทเคน)', maxOut)),
      h('div', { class: 'row field-note' }, usedEl, btn('รีเซ็ตตัวนับ', { icon: 'reset', small: true, kind: 'ghost', onClick: () => (resetSpend(), (usedEl.textContent = 'วันนี้ใช้ไป 0 โทเคน'), bus.emit('spend:update', { used: 0, limit: s.dailyTokenLimit })) })),
      h('label', { class: 'row field-note' }, web, 'ให้ลูกเรือค้นเว็บได้ (ค้นหาข้อมูลล่าสุดจากอินเทอร์เน็ต มีค่าใช้จ่ายเพิ่มประมาณ 10 ดอลลาร์ต่อ 1,000 ครั้ง และผู้ดูแลบัญชีต้องเปิดใช้ใน Console ก่อน)'),
      h('label', { class: 'row field-note' }, fetchBox, 'ให้ลูกเรืออ่านหน้าเว็บจากลิงก์ที่ให้ได้ (web fetch)'),
      h('label', { class: 'row field-note' }, codeBox, 'ให้ลูกเรือรันโค้ด Python และสร้างไฟล์ได้ เช่น CSV กราฟ (code execution มีค่าใช้จ่ายตามเวลาที่รัน)'),
      h('label', { class: 'row field-note' }, crt, 'เส้นจอ CRT แบบทีวีเก่า'),
      h('label', { class: 'row field-note' }, auto, 'ให้ลูกเรือที่ว่างหยิบงานตัวอย่างมาทำเอง (เฉพาะโหมดตัวอย่าง ไว้โชว์ จะทำให้กล่องงานเต็มเร็ว)'),
      h('div', { class: 'field-note' }, `key ปัจจุบัน: ${maskKey(getApiKey())}`),
    ],
    [
      btn('ลบ key', { icon: 'trash', kind: 'danger', onClick: () => ((key.value = ''), setApiKey(''), bus.emit('toast', { kind: 'info', text: 'ลบ API key ออกจากเบราว์เซอร์นี้แล้ว' })) }),
      btn('ยกเลิก', { kind: 'ghost', onClick: close }),
      btn('บันทึก', {
        icon: 'check',
        kind: 'primary',
        onClick: () => {
          const k = key.value.trim();
          if (mode === 'live' && !k) {
            bus.emit('toast', { kind: 'warn', text: 'โหมดใช้งานจริงต้องมี API key' });
            key.focus();
            return;
          }
          if (k && !k.startsWith('sk-ant-')) bus.emit('toast', { kind: 'warn', text: 'key นี้ดูไม่เหมือน key ของ Anthropic (ควรขึ้นต้นด้วย sk-ant-) แต่บันทึกไว้ให้แล้ว' });
          setApiKey(k);
          updateSettings({
            mode,
            dailyTokenLimit: Math.max(1000, Math.round(+limit.value || s.dailyTokenLimit)),
            maxOutputTokens: Math.min(16000, Math.max(256, Math.round(+maxOut.value || s.maxOutputTokens))),
            crt: crt.checked,
            autopilot: auto.checked,
            webSearch: web.checked,
            webFetch: fetchBox.checked,
            codeExec: codeBox.checked,
          });
          bus.emit('spend:update', { used: usedToday(), limit: state.settings.dailyTokenLimit });
          bus.emit('toast', { kind: 'ok', text: mode === 'live' ? 'เปิดโหมดใช้งานจริงแล้ว ลูกเรือจะเรียก Claude จริง' : 'ใช้โหมดตัวอย่าง' });
          close();
        },
      }),
    ],
  );
}

// -------------------------------------------------------------- result -----

function resultPanel(id: string) {
  const r = state.results.find((x) => x.id === id);
  if (!r) return;
  markRead(id);
  const cls = CLASSES[r.cls];
  const md = h('div', { class: 'md', html: renderMarkdown(r.content) });
  const slug = r.title.toLowerCase().replace(/[^a-z0-9฀-๿]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  const fileName = `${r.agentName.toLowerCase()}-${slug || 'result'}.md`;
  modal(
    r.title,
    cls.icon,
    [
      h('div', { class: 'field-note' }, `โดย ${r.agentName} (${cls.title}) / ${new Date(r.createdAt).toLocaleString(getLang() === 'en' ? 'en-GB' : 'th-TH')}${r.mode === 'demo' ? ' / ผลงานจำลองจากโหมดตัวอย่าง' : ''}`),
      md,
      r.files?.length
        ? h(
            'div',
            { class: 'field' },
            'ไฟล์ที่ลูกเรือสร้าง',
            h(
              'div',
              { class: 'row' },
              ...r.files.map((f) =>
                btn(f.name, {
                  icon: 'file',
                  small: true,
                  onClick: async () => {
                    try {
                      const blob = await downloadFile(f.id);
                      const url = URL.createObjectURL(blob);
                      const a = h('a', { href: url, download: f.name });
                      document.body.append(a);
                      a.click();
                      a.remove();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    } catch (err) {
                      bus.emit('toast', { kind: 'error', text: (err as Error).message });
                    }
                  },
                }),
              ),
            ),
          )
        : h('span'),
    ],
    [
      btn('ลบ', {
        icon: 'trash',
        kind: 'danger',
        onClick: () => {
          deleteResult(id);
          bus.emit('result:update', r);
          close();
        },
      }),
      btn('ส่งต่อให้คนอื่นทำต่อ', { icon: 'arrow-right', onClick: () => taskPanel(undefined, { input: r.content, from: r.agentName }) }),
      btn('คัดลอก', {
        icon: 'copy',
        onClick: async () => {
          try {
            await navigator.clipboard.writeText(r.content);
            bus.emit('toast', { kind: 'ok', text: 'คัดลอกแล้ว' });
          } catch {
            bus.emit('toast', { kind: 'error', text: 'เบราว์เซอร์นี้ไม่อนุญาตให้คัดลอก' });
          }
        },
      }),
      btn('ดาวน์โหลด .md', {
        icon: 'download',
        kind: 'primary',
        onClick: () => {
          const header = `<!-- STARNET: ${r.agentName} (${cls.title}), ${new Date(r.createdAt).toISOString()} -->\n\n`;
          const blob = new Blob([header + r.content], { type: 'text/markdown;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = h('a', { href: url, download: fileName });
          document.body.append(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        },
      }),
    ],
    true,
  );
}

// ----------------------------------------------------------- schedules -----

function schedulesPanel() {
  const listEl = h('div', { class: 'outbox-list', style: { padding: '0' } });
  const paint = () => {
    const list = loadSchedules();
    listEl.replaceChildren(
      ...(list.length
        ? list.map((sc) => {
            const a = getAgent(sc.agentId);
            const toggle = h('input', { type: 'checkbox', checked: sc.enabled, 'aria-label': 'เปิดใช้' }) as HTMLInputElement;
            toggle.addEventListener('change', () => {
              const all = loadSchedules();
              const x = all.find((y) => y.id === sc.id);
              if (x) x.enabled = toggle.checked;
              saveSchedules(all);
            });
            return h(
              'div',
              { class: 'result-item', style: { gridTemplateColumns: 'auto 1fr auto', cursor: 'default' } },
              toggle,
              h(
                'div',
                { style: { minWidth: '0' } },
                h('div', { class: 'r-title' }, sc.prompt),
                h('div', { class: 'r-sub' }, `${a?.name ?? '?'} / ${describeRepeat(sc.repeat)}${sc.lastRun ? ` / ล่าสุด ${new Date(sc.lastRun).toLocaleString()}` : ''}`),
              ),
              btn('ลบ', {
                icon: 'trash',
                small: true,
                iconOnly: true,
                kind: 'danger',
                onClick: () => {
                  saveSchedules(loadSchedules().filter((y) => y.id !== sc.id));
                  paint();
                },
              }),
            );
          })
        : [h('div', { class: 'empty' }, 'ยังไม่มีงานตั้งเวลา ตอนสั่งงาน เลือก ทำซ้ำ เป็น ทุกวัน หรือ ทุกๆ กี่ชั่วโมง')]),
    );
  };
  paint();
  modal(
    'งานตั้งเวลา',
    'clock',
    [
      h(
        'div',
        { class: 'notice warn' },
        icon('clock', 16),
        h('span', null, 'งานตั้งเวลาจะทำงานเฉพาะตอนที่เปิดหน้า STARNET ค้างไว้ ถ้าปิดเบราว์เซอร์ งานจะรอจนกว่าจะเปิดใหม่ แล้วทำรอบที่พลาดไปหนึ่งครั้ง'),
      ),
      listEl,
    ],
    [btn('สั่งงานแบบตั้งเวลา', { icon: 'send', kind: 'primary', onClick: () => taskPanel() })],
    true,
  );
}
