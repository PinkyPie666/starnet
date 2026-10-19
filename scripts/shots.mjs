// Screenshot every room and panel on desktop and a 390 px phone.
// Usage: node scripts/shots.mjs [url] [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:5173';
const out = process.argv[3] ?? 'shots';
mkdirSync(out, { recursive: true });

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, mobile: false },
  { name: 'mobile', width: 390, height: 844, mobile: true },
];

const ROOMS = {
  work: [13 * 16, 9 * 16],
  factory: [38 * 16, 9 * 16],
  lounge: [13 * 16, 25 * 16],
  ops: [38 * 16, 25 * 16],
};

const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const problems = [];

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile, deviceScaleFactor: vp.mobile ? 2 : 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`${vp.name}: pageerror ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && problems.push(`${vp.name}: console ${m.text()}`));
  await page.goto(url);
  await page.waitForFunction(() => window.__starnet?.game);
  await page.waitForTimeout(2000);
  const S = (fn, arg) => page.evaluate(fn, arg);
  const shot = async (name) => {
    await page.waitForTimeout(500);
    // horizontal overflow check: nothing may scroll sideways
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (overflow) problems.push(`${vp.name}/${name}: horizontal overflow`);
    await page.screenshot({ path: `${out}/${vp.name}-${name}.png` });
  };
  const closeModal = () => page.keyboard.press('Escape');

  // start a pipeline and some solo work so every room is busy
  await S(() => {
    const st = window.__starnet;
    st.state.settings.autopilot = false;
    const by = (c) => st.state.agents.find((a) => a.cls === c);
    st.runPipeline([by('researcher').id, by('strategist').id, by('copywriter').id], 'Launch plan for a pixel-art focus timer');
    st.assignTask(by('coder').id, 'Write a debounce helper');
    st.assignTask(by('ops').id, 'Deploy checklist');
  });
  await page.waitForTimeout(11000);
  await shot('overview');

  for (const [room, [x, y]] of Object.entries(ROOMS)) {
    await S(
      ({ x, y, z }) => {
        const cam = window.__starnet.game.scene.getScene('station').cameras.main;
        cam.setZoom(z);
        cam.centerOn(x, y);
      },
      { x, y, z: vp.mobile ? 2 : 3 },
    );
    await shot(`room-${room}`);
  }

  // agent detail card
  await S(() => {
    const st = window.__starnet;
    st.bus.emit('ui:select', { agentId: st.state.agents.find((a) => a.status === 'WORKING')?.id ?? st.state.agents[0].id });
  });
  await page.waitForTimeout(800);
  await shot('agent-card');
  await S(() => window.__starnet.bus.emit('ui:select', { agentId: null }));

  for (const panel of ['task', 'pipeline', 'recruit', 'settings']) {
    await S((p) => window.__starnet.bus.emit('ui:open', { panel: p }), panel);
    await page.waitForTimeout(600);
    await shot(`panel-${panel}`);
    await closeModal();
  }

  // finish work quickly so the outbox has content
  await S(() => {
    const st = window.__starnet;
    const a = st.state.agents[0];
    st.bus.emit('task:done', {
      id: 'shot-task',
      agentId: a.id,
      prompt: 'x',
      input: null,
      pipelineId: null,
      step: 0,
      status: 'done',
      output: '# Briefing: launch research\n\n## Key findings\n- **Demand is real** (confidence: medium).\n- Price anchors are low.\n\n| Option | Strength |\n|---|---|\n| Suite | One bill |\n\n```ts\nconst ok = true;\n```\n',
      error: null,
      mode: 'demo',
      model: a.model,
      tokensIn: 100,
      tokensOut: 400,
      createdAt: Date.now(),
      startedAt: Date.now(),
      finishedAt: Date.now(),
    });
    st.bus.emit('ui:open', { panel: 'outbox' });
  });
  await shot('outbox');
  await S(() => {
    const st = window.__starnet;
    st.bus.emit('ui:open', { panel: 'result', arg: st.state.results.at(-1).id });
  });
  await page.waitForTimeout(600);
  await shot('result');
  await closeModal();

  if (vp.mobile) {
    await page.evaluate(() => document.querySelector('.mobile-nav .btn')?.click());
    await shot('crew-sheet');
  }
  await ctx.close();
}

await browser.close();
console.log(problems.length ? problems.join('\n') : 'all screenshots captured, no errors, no horizontal overflow');
