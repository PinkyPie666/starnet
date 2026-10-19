// Quick single screenshot helper: node scripts/shot.mjs <url> <out.png> [width] [height] [waitMs] [js]
import { chromium } from 'playwright';
const [url = 'http://localhost:5173', out = 'shots/shot.png', w = '1440', h = '900', wait = '6000', js = ''] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: +w < 600, hasTouch: +w < 600 });
const logs = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(url);
await page.waitForTimeout(+wait);
if (js) {
  await page.evaluate(js);
  await page.waitForTimeout(1500);
}
await page.screenshot({ path: out });
console.log(logs.join('\n') || 'no console errors');
await browser.close();
