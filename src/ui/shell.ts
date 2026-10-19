// The always-on HUD: top bar, crew list, agent card, outbox drawer, toasts.
// Heavier dialogs live in panels.ts and are loaded on first use.

import { bus, clearResults, getAgent, markRead, state, updateAgent, updateSettings } from '../core/store';
import type { Agent, PanelId, Result } from '../core/types';
import { CLASSES, MODELS, xpForLevel } from '../agents/classes';
import { stopAgent, stopAll } from '../app';
import { usedToday } from '../agents/spend';
import { avatarImg, btn, fmtTokens, h } from './dom';
import { STATUS_TH, timeAgoTh } from './th';
import { getLang, setLang, tr } from './i18n';
import { icon } from './icons';

export interface ShellRefs {
  world: HTMLElement;
  onZoom: (d: number) => void;
  onFocus: (agentId: string) => void;
}

const panels = () => import('./panels');

export function openPanel(panel: PanelId, arg?: string) {
  void panels().then((m) => m.open(panel, arg));
}

export function mountShell(root: HTMLElement, refs: Omit<ShellRefs, 'world'>): ShellRefs {
  root.querySelectorAll(':scope > :not(#boot)').forEach((n) => n.remove());

  // ---- top bar ----
  const modeBadge = h('button', { class: 'mode-badge', type: 'button', title: 'สลับโหมดได้ในหน้าตั้งค่า', on: { click: () => openPanel('settings') } });
  const lang = getLang();
  const langBtn = h(
    'button',
    { class: 'lang-toggle', type: 'button', title: lang === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย', on: { click: () => setLang(lang === 'th' ? 'en' : 'th') } },
    h('span', { class: lang === 'th' ? 'on' : '' }, 'ไทย'),
    h('span', { class: lang === 'en' ? 'on' : '' }, 'EN'),
  );
  const spendMeter = h('div', { class: 'meter' }, h('i'));
  const spendLabel = h('span', { class: 'spend-label' });
  const spend = h('div', { class: 'spend', title: 'จำนวนโทเคนที่ใช้วันนี้ (โหมดใช้งานจริง)' }, spendLabel, spendMeter);
  const outboxCount = h('span', { class: 'badge-count' });
  const outboxBtn = btn('งานที่เสร็จ', { icon: 'inbox', onClick: () => toggleOutbox() });
  outboxBtn.append(outboxCount);
  outboxBtn.querySelector('span')!.classList.add('label-wide');
  outboxBtn.classList.add('hide-mobile');
  const crtBtn = btn('CRT', { icon: 'tv', kind: 'ghost', iconOnly: true, title: 'เปิด/ปิดเส้นจอ CRT', onClick: () => updateSettings({ crt: !state.settings.crt }) });
  crtBtn.classList.add('hide-mobile');
  const mk = (label: string, ic: string, fn: () => void, kind?: 'primary' | 'amber', extra = '') => {
    const b = btn(label, { icon: ic, kind, onClick: fn });
    b.querySelector('span')!.classList.add('label-wide');
    if (extra) b.classList.add(extra);
    return b;
  };
  const topbar = h(
    'header',
    { class: 'topbar panel' },
    h('div', { class: 'logo' }, 'STARNET', h('small', null, 'ศูนย์บัญชาการลูกเรือ AI')),
    modeBadge,
    langBtn,
    spend,
    h('div', { class: 'top-spacer' }),
    h(
      'div',
      { class: 'top-actions' },
      mk('สั่งงาน', 'send', () => openPanel('task'), 'primary', 'hide-mobile'),
      mk('งานต่อกัน', 'workflow', () => openPanel('pipeline'), undefined, 'hide-mobile'),
      mk('รับลูกเรือ', 'user-plus', () => openPanel('recruit'), 'amber', 'hide-mobile'),
      outboxBtn,
      btn('หยุดทั้งหมด', { icon: 'stop', kind: 'danger', iconOnly: true, title: 'หยุดลูกเรือทุกคนที่กำลังทำงาน', onClick: () => stopAll() }),
      crtBtn,
      btn('งานตั้งเวลา', { icon: 'clock', iconOnly: true, kind: 'ghost', onClick: () => openPanel('schedules') }),
      btn('วิธีใช้', { icon: 'help', iconOnly: true, kind: 'ghost', onClick: () => openPanel('help') }),
      btn('ตั้งค่า', { icon: 'settings', iconOnly: true, kind: 'ghost', onClick: () => openPanel('settings') }),
    ),
  );

  // ---- crew list ----
  const crewList = h('div', { class: 'crew-list', role: 'list' });
  const side = h(
    'aside',
    { class: 'side panel', 'aria-label': 'ลูกเรือ' },
    h('div', { class: 'side-head' }, h('div', { class: 'panel-title' }, icon('users', 14), 'ลูกเรือ'), h('span', { class: 'crew-count stext IDLE' })),
    crewList,
    h(
      'div',
      { class: 'side-foot' },
      btn('สั่งงาน', { icon: 'send', kind: 'primary', small: true, onClick: () => openPanel('task') }),
      btn('ต่อกัน', { icon: 'workflow', small: true, onClick: () => openPanel('pipeline') }),
      btn('รับเพิ่ม', { icon: 'user-plus', kind: 'amber', small: true, onClick: () => openPanel('recruit') }),
    ),
  );

  // ---- world ----
  const world = h('main', { class: 'world', 'aria-label': 'มุมมองสถานี' });
  const zoomIn = btn('ซูมเข้า', { icon: 'zoom-in', iconOnly: true, onClick: () => refs.onZoom(1) });
  const zoomOut = btn('ซูมออก', { icon: 'zoom-out', iconOnly: true, onClick: () => refs.onZoom(-1) });
  world.append(
    h('div', { class: 'world-hud' }, zoomIn, zoomOut),
    h('div', { class: 'world-hint' }, 'ลากเพื่อเลื่อนจอ / ล้อเมาส์เพื่อซูม / คลิกลูกเรือเพื่อดูงาน'),
  );

  // ---- agent card ----
  const card = h('section', { class: 'agent-card panel', hidden: true, 'aria-live': 'polite' });
  world.append(card);

  // ---- outbox drawer ----
  const outList = h('div', { class: 'outbox-list' });
  const drawer = h(
    'aside',
    { class: 'drawer panel', 'aria-label': 'งานที่เสร็จแล้ว' },
    h(
      'div',
      { class: 'modal-head' },
      h('div', { class: 'panel-title' }, icon('inbox', 14), 'งานที่เสร็จแล้ว'),
      h(
        'div',
        { class: 'row' },
        btn('ล้างทั้งหมด', { icon: 'trash', kind: 'ghost', small: true, onClick: () => clearOutbox() }),
        btn('ปิด', { icon: 'x', iconOnly: true, kind: 'ghost', small: true, onClick: () => toggleOutbox(false) }),
      ),
    ),
    outList,
  );
  world.append(drawer);

  // ---- mobile nav ----
  const nav = h(
    'nav',
    { class: 'mobile-nav panel' },
    btn('ลูกเรือ', { icon: 'users', onClick: () => toggleSide() }),
    btn('สั่งงาน', { icon: 'send', kind: 'primary', onClick: () => openPanel('task') }),
    btn('ต่อกัน', { icon: 'workflow', onClick: () => openPanel('pipeline') }),
    btn('รับเพิ่ม', { icon: 'user-plus', kind: 'amber', onClick: () => openPanel('recruit') }),
    btn('งานเสร็จ', { icon: 'inbox', onClick: () => toggleOutbox() }),
  );

  const toasts = h('div', { class: 'toasts', 'aria-live': 'polite' });
  const crt = h('div', { class: 'crt', 'aria-hidden': 'true' });
  root.append(topbar, side, world, nav, toasts, crt);

  // ---------------------------------------------------------------- logic --

  function toggleSide(force?: boolean) {
    side.classList.toggle('open', force);
  }
  function toggleOutbox(force?: boolean) {
    const open = drawer.classList.toggle('open', force);
    if (open) {
      toggleSide(false);
      renderOutbox();
    }
  }

  // crew cards
  const cards = new Map<string, { el: HTMLElement; status: HTMLElement; stext: HTMLElement; meter: HTMLElement; xp: HTMLElement; lvl: HTMLElement; stop: HTMLButtonElement; name: HTMLElement }>();
  let selected: string | null = null;

  function crewCard(a: Agent) {
    const cls = CLASSES[a.cls];
    const meter = h('i');
    const xp = h('i');
    const stext = h('span', { class: 'stext' });
    const sdot = h('span', { class: 'sdot' });
    const lvl = h('span');
    const name = h('b', null, a.name);
    const stop = btn('หยุด', { icon: 'stop', kind: 'danger', small: true, iconOnly: true, onClick: (e) => (e.stopPropagation(), stopAgent(a.id)) });
    const el = h(
      'div',
      {
        class: 'crew-card',
        role: 'listitem',
        tabindex: 0,
        style: { '--cls': cls.color } as any,
        on: {
          click: () => bus.emit('ui:select', { agentId: a.id }),
          keydown: (e: KeyboardEvent) => e.key === 'Enter' && bus.emit('ui:select', { agentId: a.id }),
        },
      },
      avatarImg(a.look, cls.color),
      h('div', { class: 'crew-name' }, name, h('span', { class: 'tag' }, cls.tag)),
      h(
        'div',
        { class: 'crew-actions' },
        stop,
        btn('สั่งงานคนนี้', { icon: 'send', small: true, iconOnly: true, onClick: (e) => (e.stopPropagation(), openPanel('task', a.id)) }),
      ),
      h('div', { class: 'crew-meta' }, lvl, h('div', { class: 'meter', title: 'XP', style: { '--c': '#3aa0ff' } as any }, xp)),
      h('div', { class: 'crew-status' }, sdot, stext, h('div', { class: 'meter' }, meter)),
    );
    const entry = { el, status: sdot, stext, meter, xp, lvl, stop, name };
    cards.set(a.id, entry);
    paintCard(a);
    return el;
  }

  function paintCard(a: Agent) {
    const c = cards.get(a.id);
    if (!c) return;
    c.name.textContent = a.name;
    c.status.className = `sdot ${a.status}`;
    c.stext.className = `stext ${a.status}`;
    c.stext.textContent = STATUS_TH[a.status];
    c.meter.style.width = `${Math.round((a.status === 'DONE' ? 1 : a.status === 'WORKING' ? a.progress : 0) * 100)}%`;
    c.meter.style.setProperty('--c', a.status === 'DONE' ? 'var(--amber)' : a.status === 'ERROR' ? 'var(--red)' : 'var(--teal)');
    c.lvl.textContent = `เลเวล ${a.level}`;
    c.xp.style.width = `${Math.round((a.xp / xpForLevel(a.level)) * 100)}%`;
    c.stop.disabled = a.status !== 'WORKING';
    c.el.classList.toggle('selected', a.id === selected);
  }

  function renderCrew() {
    crewList.replaceChildren(...state.agents.map(crewCard));
    side.querySelector('.crew-count')!.textContent = `${state.agents.length} คนบนสถานี`;
  }

  // rAF-batched repaint so streaming progress never thrashes layout
  const dirty = new Set<string>();
  let rafQueued = false;
  function markDirty(id: string) {
    dirty.add(id);
    if (rafQueued) return;
    rafQueued = true;
    requestAnimationFrame(() => {
      rafQueued = false;
      for (const d of dirty) {
        const a = getAgent(d);
        if (a) paintCard(a);
        if (d === selected) paintAgentCard(false);
      }
      dirty.clear();
    });
  }

  // agent detail card
  let streamEl: HTMLElement | null = null;
  function paintAgentCard(full: boolean) {
    const a = selected ? getAgent(selected) : null;
    if (!a) {
      card.hidden = true;
      streamEl = null;
      return;
    }
    const cls = CLASSES[a.cls];
    const task = a.taskId ? state.tasks.find((t) => t.id === a.taskId) : [...state.tasks].reverse().find((t) => t.agentId === a.id);
    if (full || !streamEl) {
      card.hidden = false;
      card.style.setProperty('--cls', cls.color);
      const model = h(
        'select',
        { 'aria-label': 'โมเดล', on: { change: (e: Event) => updateAgent(a.id, { model: (e.target as HTMLSelectElement).value as Agent['model'] }) } },
        ...MODELS.map((m) => h('option', { value: m.id, selected: m.id === a.model }, `${m.label} (${m.note})`)),
      );
      streamEl = h('div', { class: 'stream', tabindex: 0, 'aria-label': 'ผลงานที่กำลังเขียน' });
      const big = avatarImg(a.look, cls.color);
      card.replaceChildren(
        h(
          'div',
          { class: 'ac-head' },
          big,
          h(
            'div',
            null,
            h('div', { class: 'ac-name' }, a.name),
            h('div', { class: 'ac-sub' }, `${cls.title}  เลเวล ${a.level}  ${a.xp}/${xpForLevel(a.level)} XP`),
            h('div', { class: 'ac-sub' }, cls.blurb),
          ),
          btn('ปิด', { icon: 'x', iconOnly: true, kind: 'ghost', small: true, onClick: () => bus.emit('ui:select', { agentId: null }) }),
        ),
        h(
          'div',
          { class: 'ac-body' },
          h('div', { class: 'row' }, h('span', { class: `sdot ${a.status}` }), h('span', { class: `stext ${a.status}` }, STATUS_TH[a.status]), h('div', { class: 'meter grow' }, h('i', { style: { width: `${Math.round(a.progress * 100)}%` } }))),
          streamEl,
          h('label', { class: 'field' }, 'โมเดล (ใช้ในโหมดใช้งานจริง)', model),
          h(
            'div',
            { class: 'row' },
            btn('สั่งงาน', { icon: 'send', kind: 'primary', small: true, onClick: () => openPanel('task', a.id) }),
            btn('หยุด', { icon: 'stop', kind: 'danger', small: true, onClick: () => stopAgent(a.id) }),
            btn('ตามดู', { icon: 'crosshair', small: true, onClick: () => refs.onFocus(a.id) }),
            task?.status === 'done' ? btn('เปิดผลงาน', { icon: 'inbox', small: true, onClick: () => openResultForTask(task.id) }) : null,
          ),
        ),
      );
      fillStream(task?.output ?? '', a, task?.error ?? a.lastError);
    } else {
      const row = card.querySelector('.ac-body .row')!;
      row.querySelector('.sdot')!.className = `sdot ${a.status}`;
      const st = row.querySelector('.stext')!;
      st.className = `stext ${a.status}`;
      st.textContent = STATUS_TH[a.status];
      (row.querySelector('.meter i') as HTMLElement).style.width = `${Math.round((a.status === 'DONE' ? 1 : a.progress) * 100)}%`;
    }
  }

  function fillStream(text: string, a: Agent, error: string | null) {
    if (!streamEl) return;
    streamEl.classList.toggle('err', a.status === 'ERROR');
    if (a.status === 'ERROR' && error) streamEl.textContent = `ผิดพลาด: ${error}`;
    else streamEl.textContent = text || (a.status === 'WORKING' ? 'กำลังเดินไปที่โต๊ะ...' : 'ว่างอยู่ กดปุ่ม สั่งงาน เพื่อให้คนนี้เริ่มทำงาน');
    if (a.status === 'WORKING') streamEl.append(h('span', { class: 'cursor' }));
    streamEl.scrollTop = streamEl.scrollHeight;
  }

  function openResultForTask(taskId: string) {
    const r = state.results.find((x) => x.taskId === taskId);
    if (r) openPanel('result', r.id);
  }

  // outbox
  function resultItem(r: Result) {
    const cls = CLASSES[r.cls];
    const agent = getAgent(r.agentId);
    return h(
      'button',
      {
        class: `result-item ${r.read ? '' : 'unread'}`,
        type: 'button',
        'data-id': r.id,
        on: {
          click: () => {
            markRead(r.id);
            openPanel('result', r.id);
          },
        },
      },
      agent ? avatarImg(agent.look, cls.color) : h('span'),
      h('div', { style: { minWidth: '0' } }, h('div', { class: 'r-title' }, r.title), h('div', { class: 'r-sub' }, `${r.agentName} / ${cls.title} / ${timeAgoTh(r.createdAt)}${r.mode === 'demo' ? ' / ตัวอย่าง' : ''}`)),
      icon('chevron-right', 16),
    );
  }

  function clearOutbox() {
    if (!state.results.length) return;
    if (!confirm(tr(`ลบงานที่เสร็จทั้งหมด ${state.results.length} ชิ้น? (ดาวน์โหลดเก็บไว้ก่อนได้)`))) return;
    clearResults();
    renderOutbox();
  }

  function renderOutbox() {
    const items = [...state.results].reverse();
    outList.replaceChildren(...(items.length ? items.map(resultItem) : [h('div', { class: 'empty' }, 'ยังไม่มีงานที่เสร็จ สั่งงานให้ลูกเรือ แล้วเขาจะถือผลงานมาส่งที่นี่')]));
    paintOutboxCount();
  }

  function paintOutboxCount() {
    const unread = state.results.filter((r) => !r.read).length;
    outboxCount.textContent = unread ? String(unread) : '';
  }

  function paintMode() {
    const live = state.settings.mode === 'live';
    modeBadge.textContent = live ? 'ใช้งานจริง' : 'โหมดตัวอย่าง';
    modeBadge.classList.toggle('live', live);
    modeBadge.title = live ? 'โหมดใช้งานจริง: เรียก Claude จริงด้วย key ของคุณ' : 'โหมดตัวอย่าง: ข้อความจำลอง ไม่ต้องมี key กดเพื่อเปลี่ยนเป็นใช้งานจริง';
    paintSpend();
    document.body.classList.toggle('crt-on', state.settings.crt);
    crtBtn.setAttribute('aria-pressed', String(state.settings.crt));
  }

  function paintSpend() {
    const live = state.settings.mode === 'live';
    const used = usedToday();
    const lim = state.settings.dailyTokenLimit;
    spendLabel.textContent = live ? `ใช้ไป ${fmtTokens(used)} / ${fmtTokens(lim)} โทเคนวันนี้` : 'ยังไม่เสียค่าใช้จ่าย';
    const pct = live ? Math.min(1, used / lim) : 0;
    (spendMeter.firstChild as HTMLElement).style.width = `${pct * 100}%`;
    spendMeter.classList.toggle('warn', pct > 0.7);
    spendMeter.classList.toggle('over', pct >= 1);
    spend.style.visibility = 'visible';
  }

  function toast(kind: 'info' | 'ok' | 'warn' | 'error', text: string) {
    const ic = kind === 'error' || kind === 'warn' ? 'alert' : kind === 'ok' ? 'check' : 'cpu';
    const t = h('div', { class: `toast ${kind}`, role: kind === 'error' ? 'alert' : 'status' }, icon(ic, 16), h('span', null, text));
    toasts.append(t);
    while (toasts.children.length > 4) toasts.firstChild!.remove();
    setTimeout(() => t.classList.add('out'), kind === 'error' ? 6500 : 3500);
    setTimeout(() => t.remove(), kind === 'error' ? 7000 : 4000);
  }

  // ---- bus wiring ----
  bus.on('agent:add', (a) => {
    crewList.append(crewCard(a));
    side.querySelector('.crew-count')!.textContent = `${state.agents.length} คนบนสถานี`;
  });
  bus.on('agent:remove', ({ id }) => {
    cards.get(id)?.el.remove();
    cards.delete(id);
  });
  bus.on('agent:update', (a) => markDirty(a.id));
  bus.on('ui:select', ({ agentId }) => {
    const prev = selected;
    selected = agentId;
    if (prev) markDirty(prev);
    if (agentId) {
      markDirty(agentId);
      toggleSide(false);
    }
    paintAgentCard(true);
  });
  bus.on('task:start', (t) => {
    if (t.agentId === selected) paintAgentCard(true);
  });
  bus.on('task:delta', ({ agentId, text }) => {
    if (agentId !== selected || !streamEl) return;
    const cursor = streamEl.querySelector('.cursor');
    const atBottom = streamEl.scrollHeight - streamEl.scrollTop - streamEl.clientHeight < 40;
    if (streamEl.firstChild?.nodeType === Node.TEXT_NODE && /^กำลังเดินไปที่โต๊ะ/.test(streamEl.firstChild.textContent ?? '')) streamEl.firstChild.textContent = '';
    if (cursor) cursor.before(text);
    else streamEl.append(text);
    if (atBottom) streamEl.scrollTop = streamEl.scrollHeight;
  });
  for (const evt of ['task:done', 'task:error', 'task:stopped'] as const)
    bus.on(evt, (t) => {
      if (t.agentId === selected) setTimeout(() => paintAgentCard(true), 0);
    });
  bus.on('result:add', (r) => {
    paintOutboxCount();
    if (drawer.classList.contains('open')) outList.prepend(resultItem(r));
    outList.querySelector('.empty')?.remove();
  });
  bus.on('result:update', () => {
    paintOutboxCount();
    if (drawer.classList.contains('open')) renderOutbox();
  });
  bus.on('world:delivered', ({ resultId }) => {
    const el = outList.querySelector(`[data-id="${resultId}"]`);
    el?.classList.remove('flash');
    void (el as HTMLElement | null)?.offsetWidth;
    el?.classList.add('flash');
    const r = state.results.find((x) => x.id === resultId);
    if (r) toast('ok', `${r.agentName} ส่งผลงาน "${r.title}" เข้ากล่องงานที่เสร็จแล้ว`);
  });
  bus.on('settings:update', paintMode);
  bus.on('spend:update', paintSpend);
  bus.on('toast', ({ kind, text }) => toast(kind, text));
  bus.on('ui:open', ({ panel, arg }) => {
    if (panel === 'outbox') toggleOutbox(true);
    else openPanel(panel, arg);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (document.querySelector('.scrim')) return;
      if (drawer.classList.contains('open')) toggleOutbox(false);
      else if (selected) bus.emit('ui:select', { agentId: null });
    }
  });

  renderCrew();
  renderOutbox();
  paintMode();

  return { world, ...refs };
}
