// Dialogs, loaded on first use: new task, recruitment, pipeline, settings, result.

import { addAgent, bus, deleteResult, getAgent, makeAgent, markRead, state, updateSettings } from '../core/store';
import type { Agent, ClassId, Look, ModelId, PanelId } from '../core/types';
import { CLASSES, CLASS_IDS, DEFAULT_MODEL, MODELS } from '../agents/classes';
import { assignTask, runPipeline, scheduler } from '../app';
import { getApiKey, maskKey, setApiKey } from '../agents/live';
import { resetSpend, usedToday } from '../agents/spend';
import { HAIR_COLORS, HAIR_STYLES, SKIN_TONES, UNIFORMS, UNIFORM_NAMES } from '../game/palette';
import { MAX_CREW_SLOTS } from '../game/atlas';
import { avatarImg, btn, fmtTokens, fullBody, h } from './dom';
import { icon } from './icons';
import { renderMarkdown } from './markdown';

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
    h('div', { class: 'modal-head' }, h('div', { class: 'panel-title' }, icon(ic, 14), title), btn('Close', { icon: 'x', iconOnly: true, kind: 'ghost', small: true, onClick: close })),
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
  if (panel === 'result' && arg) return resultPanel(arg);
}

function modeNotice() {
  return state.settings.mode === 'live'
    ? h('div', { class: 'notice' }, icon('key', 16), h('span', null, `Live mode: real Claude calls with your key. Daily guard: ${fmtTokens(usedToday())} of ${fmtTokens(state.settings.dailyTokenLimit)} tokens used.`))
    : h('div', { class: 'notice warn' }, icon('monitor', 16), h('span', null, 'Demo mode: scripted agents, no key and no cost. Switch to Live in Settings to run real Claude agents.'));
}

function agentPicker(selectedId: string | null, onPick: (a: Agent) => void, filter?: (a: Agent) => boolean) {
  const wrap = h('div', { class: 'pick-list' });
  const paint = (sel: string | null) => {
    wrap.replaceChildren(
      ...state.agents.filter(filter ?? (() => true)).map((a) => {
        const cls = CLASSES[a.cls];
        const b = h(
          'button',
          { class: 'pick', type: 'button', 'aria-pressed': String(a.id === sel), style: { borderColor: a.id === sel ? cls.color : '' }, on: { click: () => (onPick(a), paint(a.id)) } },
          avatarImg(a.look, cls.color),
          h('div', null, h('span', null, a.name), h('small', null, `${cls.title} / ${a.status}`)),
        );
        return b;
      }),
    );
  };
  paint(selectedId);
  return wrap;
}

// ---------------------------------------------------------------- task -----

function taskPanel(agentId?: string) {
  let chosen = agentId ? getAgent(agentId) : state.agents.find((a) => a.status === 'IDLE') ?? state.agents[0];
  const ta = h('textarea', { placeholder: 'Describe the mission. Example: research the market for pixel-art productivity tools.', maxlength: 8000 }) as HTMLTextAreaElement;
  const sample = btn('Use sample', {
    icon: 'reset',
    small: true,
    kind: 'ghost',
    onClick: () => {
      if (chosen) ta.value = CLASSES[chosen.cls].samplePrompt;
    },
  });
  const who = h('div', { class: 'field-note' });
  const paintWho = () => {
    if (!chosen) return;
    const busy = scheduler.isBusy(chosen.id);
    who.textContent = `${chosen.name} the ${CLASSES[chosen.cls].title}${busy ? ' is busy; the task will wait in the queue.' : ' will walk to a desk and start.'}`;
  };
  paintWho();
  const go = btn('Send to desk', {
    icon: 'send',
    kind: 'primary',
    onClick: () => {
      if (!chosen || !ta.value.trim()) {
        ta.focus();
        return;
      }
      assignTask(chosen.id, ta.value);
      bus.emit('ui:select', { agentId: chosen.id });
      close();
    },
  });
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) go.click();
  });
  modal(
    'New task',
    'send',
    [
      modeNotice(),
      h('label', { class: 'field' }, 'Crew member', agentPicker(chosen?.id ?? null, (a) => ((chosen = a), paintWho()))),
      who,
      h('label', { class: 'field' }, 'Mission', ta),
      h('div', { class: 'row' }, sample, h('span', { class: 'field-note' }, 'Ctrl+Enter to send')),
    ],
    [btn('Cancel', { kind: 'ghost', onClick: close }), go],
  );
}

// ------------------------------------------------------------- recruit -----

const NAMES = ['ORION', 'VEGA', 'KITE', 'ECHO', 'ZED', 'MIRA', 'SOL', 'IONA', 'RHO', 'CYAN', 'JUNO', 'PAX', 'TESS', 'AXEL', 'NYX', 'BOLT', 'KAI', 'LUX'];

function recruitPanel() {
  if (state.agents.length >= MAX_CREW_SLOTS) {
    bus.emit('toast', { kind: 'warn', text: `The station is full (${MAX_CREW_SLOTS} crew).` });
    return;
  }
  let cls: ClassId = 'researcher';
  let model: ModelId = DEFAULT_MODEL;
  const look: Look = { body: Math.random() < 0.5 ? 'a' : 'b', skin: (Math.random() * SKIN_TONES.length) | 0, hair: (Math.random() * HAIR_COLORS.length) | 0, hairStyle: (Math.random() * 4) | 0, uniform: (Math.random() * UNIFORMS.length) | 0 };
  const used = new Set(state.agents.map((a) => a.name));
  const name = h('input', { type: 'text', maxlength: 12, value: NAMES.find((n) => !used.has(n)) ?? `UNIT${state.agents.length + 1}`, 'aria-label': 'Name' }) as HTMLInputElement;
  name.addEventListener('input', () => (name.value = name.value.toUpperCase().replace(/[^A-Z0-9 \-]/g, '')));
  const preview = h('img', { alt: 'Recruit preview', class: 'pixel' }) as HTMLImageElement;
  const podTag = h('div', { class: 'pod-tag' });
  let frame = 0;
  let row = 0;
  const repaint = () => {
    void fullBody(look, CLASSES[cls].color, frame, row).then((src) => (preview.src = src));
    podTag.textContent = `${CLASSES[cls].tag} / ${UNIFORM_NAMES[look.uniform]}`;
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
    return h('label', { class: 'field' }, label, row);
  };
  const styleSel = h(
    'select',
    { on: { change: (e: Event) => ((look.hairStyle = +(e.target as HTMLSelectElement).value), repaint()) } },
    ...HAIR_STYLES.map((s, i) => h('option', { value: i, selected: i === look.hairStyle }, s)),
  );
  const bodySel = h(
    'select',
    { on: { change: (e: Event) => ((look.body = (e.target as HTMLSelectElement).value as 'a' | 'b'), repaint()) } },
    h('option', { value: 'a', selected: look.body === 'a' }, 'Frame A'),
    h('option', { value: 'b', selected: look.body === 'b' }, 'Frame B'),
  );
  const modelSel = h(
    'select',
    { on: { change: (e: Event) => (model = (e.target as HTMLSelectElement).value as ModelId) } },
    ...MODELS.map((m) => h('option', { value: m.id, selected: m.id === model }, `${m.label} (${m.note})`)),
  );
  repaint();

  modal(
    'Recruitment bay',
    'user-plus',
    [
      h(
        'div',
        { class: 'recruit-grid' },
        h('div', { class: 'preview-pod' }, preview, podTag),
        h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
          h('label', { class: 'field' }, 'Callsign', name),
          h('div', { class: 'row' }, h('label', { class: 'field grow' }, 'Hair style', styleSel), h('label', { class: 'field grow' }, 'Body', bodySel)),
          swatchRow('Uniform', UNIFORMS.map((u) => u[0]), () => look.uniform, (i) => (look.uniform = i)),
          swatchRow('Skin', SKIN_TONES.map((s) => s[0]), () => look.skin, (i) => (look.skin = i)),
          swatchRow('Hair', HAIR_COLORS.map((s) => s[0]), () => look.hair, (i) => (look.hair = i)),
        ),
      ),
      h('label', { class: 'field' }, 'Class', classGrid),
      h('label', { class: 'field' }, 'Model (used in Live mode)', modelSel),
    ],
    [
      btn('Cancel', { kind: 'ghost', onClick: close }),
      btn('Summon', {
        icon: 'user-plus',
        kind: 'amber',
        onClick: () => {
          const n = name.value.trim() || 'RECRUIT';
          const a = makeAgent(n, cls, { ...look }, model);
          addAgent(a);
          bus.emit('toast', { kind: 'ok', text: `${a.name} the ${CLASSES[cls].title} joined the crew` });
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
          btn('Remove', { icon: 'x', iconOnly: true, small: true, kind: 'ghost', onClick: () => (chain.splice(i, 1), paintChain(), paintPicker()) }),
        ),
      );
    });
    if (!chain.length) parts.push(h('div', { class: 'field-note' }, 'Pick crew members below, in order.'));
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
  const ta = h('textarea', { placeholder: 'The mission for the whole chain. Example: launch plan for a pixel-art focus timer app.' }) as HTMLTextAreaElement;
  ta.value = 'Plan and announce the launch of STARNET, a pixel-art control room for AI agents.';
  const go = btn('Start pipeline', {
    icon: 'workflow',
    kind: 'primary',
    onClick: () => {
      if (chain.length < 2 || !ta.value.trim()) return;
      runPipeline(
        chain.map((a) => a.id),
        ta.value,
      );
      bus.emit('toast', { kind: 'info', text: `Pipeline started: ${chain.map((a) => a.name).join(' > ')}` });
      close();
    },
  });
  paintChain();
  paintPicker();
  modal(
    'Pipeline mode',
    'workflow',
    [
      modeNotice(),
      h('div', { class: 'field-note' }, 'Chain up to four crew members. Each one works at a Factory station; their output rides the conveyor to the next, and the last one carries the final result to the Outbox.'),
      h('label', { class: 'field' }, 'Chain', chainEl),
      h('label', { class: 'field' }, 'Add crew', pickerHost),
      h('label', { class: 'field' }, 'Mission', ta),
    ],
    [btn('Cancel', { kind: 'ghost', onClick: close }), go],
    true,
  );
}

// ------------------------------------------------------------ settings -----

function settingsPanel() {
  const s = state.settings;
  let mode = s.mode;
  let reveal = false;
  const key = h('input', { type: 'password', value: getApiKey(), placeholder: 'sk-ant-...', autocomplete: 'off', spellcheck: false, 'aria-label': 'Anthropic API key' }) as HTMLInputElement;
  const eye = btn('Show key', {
    icon: 'eye',
    iconOnly: true,
    small: true,
    onClick: () => {
      reveal = !reveal;
      key.type = reveal ? 'text' : 'password';
      eye.replaceChildren(icon(reveal ? 'eye-off' : 'eye', 14));
    },
  });
  const modeGrid = h('div', { class: 'choice-grid' });
  const paintMode = () =>
    modeGrid.replaceChildren(
      h('button', { class: 'choice', type: 'button', 'aria-pressed': String(mode === 'demo'), on: { click: () => ((mode = 'demo'), paintMode()) } }, h('b', null, icon('monitor', 14), 'Demo'), 'Scripted agents. No key, no cost.'),
      h('button', { class: 'choice', type: 'button', 'aria-pressed': String(mode === 'live'), on: { click: () => ((mode = 'live'), paintMode()) } }, h('b', null, icon('key', 14), 'Live'), 'Real Claude calls with your own key.'),
    );
  paintMode();
  const limit = h('input', { type: 'number', min: 1000, step: 1000, value: s.dailyTokenLimit }) as HTMLInputElement;
  const maxOut = h('input', { type: 'number', min: 256, max: 16000, step: 256, value: s.maxOutputTokens }) as HTMLInputElement;
  const crt = h('input', { type: 'checkbox', checked: s.crt }) as HTMLInputElement;
  const auto = h('input', { type: 'checkbox', checked: s.autopilot }) as HTMLInputElement;
  const usedEl = h('span', null, `${usedToday().toLocaleString()} tokens used today`);

  modal(
    'Settings',
    'settings',
    [
      h('label', { class: 'field' }, 'Mode', modeGrid),
      h('label', { class: 'field' }, 'Anthropic API key (Live mode)', h('div', { class: 'row' }, h('div', { class: 'grow' }, key), eye)),
      h(
        'div',
        { class: 'notice' },
        icon('shield-check', 16),
        h('span', null, 'Bring your own key. It is stored only in this browser (localStorage) and sent only to api.anthropic.com, directly from your browser. STARNET has no server. Use a key with a spend limit, and clear it here when you are done.'),
      ),
      h('div', { class: 'row' }, h('label', { class: 'field grow' }, 'Daily token limit', limit), h('label', { class: 'field grow' }, 'Max output tokens per task', maxOut)),
      h('div', { class: 'row field-note' }, usedEl, btn('Reset counter', { icon: 'reset', small: true, kind: 'ghost', onClick: () => (resetSpend(), (usedEl.textContent = '0 tokens used today'), bus.emit('spend:update', { used: 0, limit: s.dailyTokenLimit })) })),
      h('label', { class: 'row field-note' }, crt, 'CRT scanlines and vignette'),
      h('label', { class: 'row field-note' }, auto, 'Demo autopilot: idle crew pick up sample tasks on their own (Demo mode only)'),
      h('div', { class: 'field-note' }, `Current key: ${maskKey(getApiKey())}`),
    ],
    [
      btn('Clear key', { icon: 'trash', kind: 'danger', onClick: () => ((key.value = ''), setApiKey(''), bus.emit('toast', { kind: 'info', text: 'API key removed from this browser' })) }),
      btn('Cancel', { kind: 'ghost', onClick: close }),
      btn('Save', {
        icon: 'check',
        kind: 'primary',
        onClick: () => {
          const k = key.value.trim();
          if (mode === 'live' && !k) {
            bus.emit('toast', { kind: 'warn', text: 'Live mode needs an API key.' });
            key.focus();
            return;
          }
          if (k && !k.startsWith('sk-ant-')) bus.emit('toast', { kind: 'warn', text: 'That does not look like an Anthropic key (sk-ant-...). Saved anyway.' });
          setApiKey(k);
          updateSettings({
            mode,
            dailyTokenLimit: Math.max(1000, Math.round(+limit.value || s.dailyTokenLimit)),
            maxOutputTokens: Math.min(16000, Math.max(256, Math.round(+maxOut.value || s.maxOutputTokens))),
            crt: crt.checked,
            autopilot: auto.checked,
          });
          bus.emit('spend:update', { used: usedToday(), limit: state.settings.dailyTokenLimit });
          bus.emit('toast', { kind: 'ok', text: mode === 'live' ? 'Live mode on. Agents now call Claude.' : 'Demo mode on.' });
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
  const fileName = `${r.agentName.toLowerCase()}-${r.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'result'}.md`;
  modal(
    r.title,
    cls.icon,
    [h('div', { class: 'field-note' }, `By ${r.agentName} the ${cls.title} / ${new Date(r.createdAt).toLocaleString()}${r.mode === 'demo' ? ' / demo output' : ''}`), md],
    [
      btn('Delete', {
        icon: 'trash',
        kind: 'danger',
        onClick: () => {
          deleteResult(id);
          bus.emit('result:update', r);
          close();
        },
      }),
      btn('Copy', {
        icon: 'copy',
        onClick: async () => {
          try {
            await navigator.clipboard.writeText(r.content);
            bus.emit('toast', { kind: 'ok', text: 'Copied to clipboard' });
          } catch {
            bus.emit('toast', { kind: 'error', text: 'Clipboard is blocked in this browser' });
          }
        },
      }),
      btn('Download .md', {
        icon: 'download',
        kind: 'primary',
        onClick: () => {
          const header = `<!-- STARNET result by ${r.agentName} (${cls.title}), ${new Date(r.createdAt).toISOString()} -->\n\n`;
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
