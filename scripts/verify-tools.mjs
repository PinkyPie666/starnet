// Mocked check of Live-mode server tools: tool declarations, pause_turn resume,
// sandbox output files listed on the result and downloadable.
// Usage: node scripts/verify-tools.mjs [url]
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:4173';
const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
const start = (stop) =>
  ev('message_start', { message: { id: 'm', type: 'message', role: 'assistant', model: 'claude-haiku-4-5-20251001', content: [], stop_reason: null, usage: { input_tokens: 50, output_tokens: 1 } } }) +
  ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }) +
  ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: stop === 'pause_turn' ? 'Working... ' : 'Chart saved as sales.csv.' } }) +
  ev('content_block_stop', { index: 0 });
const fileBlock =
  ev('content_block_start', { index: 1, content_block: { type: 'bash_code_execution_tool_result', tool_use_id: 'srvtoolu_1', content: { type: 'bash_code_execution_result', stdout: '', stderr: '', return_code: 0, content: [{ type: 'bash_code_execution_output', file_id: 'file_abc' }] } } }) +
  ev('content_block_stop', { index: 1 });
const end = (stop) => ev('message_delta', { delta: { stop_reason: stop }, usage: { output_tokens: 20 } }) + ev('message_stop', {});

const browser = await chromium.launch();
const page = await browser.newPage();
const log = { calls: 0, tools: null, resumedWithAssistant: false, downloads: 0, errors: [] };
page.on('pageerror', (e) => log.errors.push(e.message));
await page.route('https://api.anthropic.com/**', async (route) => {
  const u = route.request().url();
  if (u.includes('/v1/files/file_abc/content')) {
    log.downloads++;
    return route.fulfill({ status: 200, contentType: 'text/csv', body: 'month,sales\njan,10\n' });
  }
  if (u.includes('/v1/files/file_abc')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'file_abc', type: 'file', filename: 'sales.csv', mime_type: 'text/csv', size_bytes: 20, created_at: '2026-10-19T00:00:00Z' }) });
  const body = JSON.parse(route.request().postData() ?? '{}');
  log.calls++;
  log.tools = body.tools?.map((t) => t.type);
  if (log.calls === 1) return route.fulfill({ status: 200, contentType: 'text/event-stream', body: start('pause_turn') + end('pause_turn') });
  log.resumedWithAssistant = body.messages?.at(-1)?.role === 'assistant';
  return route.fulfill({ status: 200, contentType: 'text/event-stream', body: start('end') + fileBlock + end('end_turn') });
});
await page.addInitScript(() => {
  localStorage.setItem('starnet.apiKey', 'sk-ant-test');
  localStorage.setItem('starnet.helpSeen', '1');
});
await page.goto(url);
await page.waitForFunction(() => window.__starnet?.game);
const res = await page.evaluate(async () => {
  const S = window.__starnet;
  Object.assign(S.state.settings, { mode: 'live', webSearch: true, webFetch: true, codeExec: true, autopilot: false });
  const t = S.assignTask(S.state.agents[2].id, 'Make a CSV of sales');
  await new Promise((r) => { const i = setInterval(() => { if (t.status !== 'running' && t.status !== 'queued') { clearInterval(i); r(); } }, 100); });
  const r = S.state.results.at(-1);
  S.bus.emit('ui:open', { panel: 'result', arg: r.id });
  return { status: t.status, error: t.error, output: t.output, files: r.files };
});
await page.waitForTimeout(800);
const dl = page.waitForEvent('download');
await page.getByRole('button', { name: 'sales.csv' }).click();
const download = await dl;
await page.screenshot({ path: 'shots/tools-result.png' });
console.log(JSON.stringify({ ...res, ...log, downloadedName: download.suggestedFilename() }, null, 1));
await browser.close();
