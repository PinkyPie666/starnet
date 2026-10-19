// Screenshots in English mode: node scripts/shot-en.mjs [url]
import { chromium } from 'playwright';
const url = process.argv[2] ?? 'http://localhost:4173';
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu'] });
const errs = [];
for (const [w, hgt, tag] of [[1440, 900, 'desktop'], [390, 844, 'mobile']]) {
  const page = await browser.newPage({ viewport: { width: w, height: hgt }, isMobile: w < 600, hasTouch: w < 600 });
  page.on('pageerror', (e) => errs.push(e.message));
  await page.addInitScript(() => localStorage.setItem('starnet.lang', 'en'));
  await page.goto(url);
  await page.waitForFunction(() => window.__starnet?.game);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `shots/en-${tag}-help.png` });
  await page.keyboard.press('Escape');
  await page.evaluate(() => { const S = window.__starnet; S.assignTask(S.state.agents[0].id, 'Research pixel art tools'); S.bus.emit('ui:open', { panel: 'settings' }); });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `shots/en-${tag}-settings.png` });
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__starnet.bus.emit('ui:select', { agentId: window.__starnet.state.agents[0].id }));
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `shots/en-${tag}-card.png` });
  const leftovers = await page.evaluate(() => {
    const out = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) { const n = w.currentNode; if (/[\u0E00-\u0E7F]/.test(n.nodeValue) && !n.parentElement.closest('.md, .stream, .lang-toggle')) out.push(n.nodeValue.trim()); }
    return out;
  });
  console.log(tag, 'Thai left in UI:', JSON.stringify(leftovers));
  await page.close();
}
console.log(errs.length ? errs : 'no page errors');
await browser.close();
