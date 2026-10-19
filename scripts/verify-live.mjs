// Verifies Live mode without a real key by intercepting api.anthropic.com in
// Playwright: streaming success with 4 concurrent agents, then bad key,
// rate limit, network failure and the daily spend guard.
// Usage: node scripts/verify-live.mjs [url]
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:5173';
const sse = (text, inTok = 120, outTok = 300) => {
  const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  let body = ev('message_start', {
    message: { id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-haiku-4-5-20251001', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: inTok, output_tokens: 1 } },
  });
  body += ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
  for (const chunk of text.match(/.{1,12}/gs)) body += ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: chunk } });
  body += ev('content_block_stop', { index: 0 });
  body += ev('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: outTok } });
  body += ev('message_stop', {});
  return body;
};

let mode = 'ok';
const seen = [];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.route('**/*', async (route) => {
  const req = route.request();
  const host = new URL(req.url()).host;
  if (!/localhost|127\.0\.0\.1/.test(host)) seen.push(host);
  if (host !== 'api.anthropic.com') return route.continue();
  const h = req.headers();
  const body = JSON.parse(req.postData() ?? '{}');
  seen.push(`headers ok=${h['x-api-key'] === 'sk-ant-test-key' && h['anthropic-dangerous-direct-browser-access'] === 'true'} model=${body.model} stream=${body.stream} sys=${typeof body.system === 'string' && body.system.length > 200}`);
  if (mode === 'network') return route.abort('internetdisconnected');
  if (mode === 'auth') return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }) });
  if (mode === 'rate') return route.fulfill({ status: 429, contentType: 'application/json', headers: { 'retry-after': '0' }, body: JSON.stringify({ type: 'error', error: { type: 'rate_limit_error', message: 'Rate limited' } }) });
  await new Promise((r) => setTimeout(r, 400));
  return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(`# Live result for ${body.model}\n\nThis came through the **streaming** path.\n\n- one\n- two\n`) });
});

await page.addInitScript(() => {
  localStorage.setItem('starnet.apiKey', 'sk-ant-test-key');
});
await page.goto(url);
await page.waitForFunction(() => window.__starnet?.game);
await page.waitForTimeout(2500);

const run = async (n) =>
  page.evaluate(async (n) => {
    const S = window.__starnet;
    S.state.settings.autopilot = false;
    S.scheduler.stopAll();
    S.state.settings.mode = 'live';
    const agents = S.state.agents.slice(0, n);
    const tasks = agents.map((a) => S.assignTask(a.id, 'Say hello in one paragraph'));
    const maxRunning = S.scheduler.running;
    await new Promise((r) => {
      const t = setInterval(() => {
        if (tasks.every((x) => ['done', 'error', 'stopped'].includes(x.status))) {
          clearInterval(t);
          r();
        }
      }, 100);
    });
    return { maxRunning, statuses: tasks.map((t) => `${t.status}${t.error ? ': ' + t.error : ''}`), out: tasks[0].output.slice(0, 60), tokens: tasks.map((t) => t.tokensIn + t.tokensOut) };
  }, n);

const report = {};
mode = 'ok';
report.ok = await run(4);
report.spendAfterOk = await page.evaluate(() => JSON.parse(localStorage.getItem('starnet.spend')));
report.results = await page.evaluate(() => window.__starnet.state.results.filter((r) => r.mode === 'live').length);
mode = 'auth';
report.auth = await run(1);
mode = 'rate';
report.rate = await run(1);
mode = 'network';
report.network = await run(1);
mode = 'ok';
await page.evaluate(() => {
  window.__starnet.state.settings.dailyTokenLimit = 1000;
});
report.guard = await run(1);
report.hostsContacted = [...new Set(seen.filter((s) => !s.startsWith('headers')))];
report.requestChecks = [...new Set(seen.filter((s) => s.startsWith('headers')))];
report.pageErrors = errors;
await page.screenshot({ path: 'shots/live-errors.png' });
console.log(JSON.stringify(report, null, 2));
await browser.close();
