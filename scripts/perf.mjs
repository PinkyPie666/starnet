// Frame-rate and long-task check while N agents stream at once.
// Usage: node scripts/perf.mjs [url] [agents] [seconds] [width] [height] [cpuThrottle]
import { chromium } from 'playwright';

const [url = 'http://localhost:5173', n = '6', secs = '10', w = '1440', h = '900', throttle = '1'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, isMobile: +w < 600, hasTouch: +w < 600 });
if (+throttle > 1) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: +throttle });
}
await page.addInitScript(() => localStorage.setItem('starnet.helpSeen', '1'));
await page.goto(url);
await page.waitForFunction(() => window.__starnet?.game);
await page.waitForTimeout(2500);
const r = await page.evaluate(
  async ({ n, secs }) => {
    const S = window.__starnet;
    S.state.settings.autopilot = false;
    // make sure we have enough crew
    const need = n - S.state.agents.length;
    const classes = ['researcher', 'strategist', 'coder', 'copywriter', 'reviewer', 'ops'];
    for (let i = 0; i < need; i++) S.recruit(`PERF${i}`, classes[i % 6]);
    await new Promise((r) => setTimeout(r, 1500));
    S.scheduler.maxConcurrent = Math.max(6, n);
    for (const a of S.state.agents.slice(0, n)) S.assignTask(a.id, 'Plan a launch for a pixel-art app');
    const long = [];
    try {
      new PerformanceObserver((l) => l.getEntries().forEach((e) => long.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: false });
    } catch {}
    const frames = [];
    let last = performance.now();
    const t0 = last;
    await new Promise((resolve) => {
      const f = (t) => {
        frames.push(t - last);
        last = t;
        if (t - t0 < secs * 1000) requestAnimationFrame(f);
        else resolve();
      };
      requestAnimationFrame(f);
    });
    frames.shift();
    frames.sort((a, b) => a - b);
    const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
    return {
      working: S.state.agents.filter((a) => a.status === 'WORKING').length,
      fps: Math.round(1000 / avg),
      p95FrameMs: Math.round(frames[Math.floor(frames.length * 0.95)] * 10) / 10,
      worstFrameMs: Math.round(frames[frames.length - 1]),
      framesOver33ms: frames.filter((x) => x > 33).length,
      totalFrames: frames.length,
      longTasks: long,
      renderer: S.game.renderer.type === 2 ? 'WEBGL' : 'CANVAS',
    };
  },
  { n: +n, secs: +secs },
);
console.log(JSON.stringify(r, null, 2));
await browser.close();
