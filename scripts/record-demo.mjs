// Records ~30 s of Demo mode as PNG frames for the README GIF.
// Usage: node scripts/record-demo.mjs [url] [framesDir]
// Then: python scripts/frames-to-gif.py <framesDir> docs/demo.gif
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4173';
const dir = process.argv[3] ?? 'shots/frames';
mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
await page.addInitScript(() => localStorage.setItem('starnet.helpSeen', '1'));
await page.goto(url);
await page.waitForFunction(() => window.__starnet?.game);
await page.waitForTimeout(1500);

const script = [
  [0, () => {
    const S = window.__starnet;
    S.state.settings.autopilot = false;
    const cam = S.game.scene.getScene('station').cameras.main;
    cam.setZoom(2);
    cam.centerOn(13 * 16, 9 * 16);
    S.state.agents.slice(3, 6).forEach((a) => S.assignTask(a.id, (window.__starnetSamples ?? {})[a.cls] ?? 'Write a short launch checklist'));
  }],
  [4000, () => {
    const S = window.__starnet;
    S.bus.emit('ui:select', { agentId: S.state.agents[4].id });
  }],
  [9500, () => {
    const S = window.__starnet;
    S.bus.emit('ui:select', { agentId: null });
    const by = (c) => S.state.agents.find((a) => a.cls === c).id;
    S.runPipeline([by('researcher'), by('strategist'), by('copywriter')], 'Launch plan for STARNET');
    const cam = S.game.scene.getScene('station').cameras.main;
    cam.pan(37 * 16, 9 * 16, 2500, 'Sine.easeInOut');
  }],
  [17000, () => window.__starnet.bus.emit('ui:open', { panel: 'recruit' })],
  [20500, () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    document.querySelector('.scrim')?.remove();
    const S = window.__starnet;
    const cam = S.game.scene.getScene('station').cameras.main;
    cam.centerOn(40 * 16, 24 * 16);
    S.recruit('ORION', 'reviewer');
  }],
  [25000, () => {
    const S = window.__starnet;
    S.bus.emit('ui:open', { panel: 'outbox' });
  }],
];

const t0 = Date.now();
let next = 0;
let i = 0;
const times = [];
while (Date.now() - t0 < 30000) {
  const t = Date.now() - t0;
  while (next < script.length && script[next][0] <= t) await page.evaluate(script[next++][1]);
  await page.screenshot({ path: `${dir}/f${String(i).padStart(4, '0')}.png` });
  times.push(Date.now() - t0);
  i++;
  const wait = 160 - ((Date.now() - t0) - t);
  if (wait > 0) await page.waitForTimeout(wait);
}
writeFileSync(`${dir}/times.json`, JSON.stringify(times));
console.log(`captured ${i} frames`);
await browser.close();
