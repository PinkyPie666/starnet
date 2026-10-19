// Live mode: real Claude calls straight from the browser with the user's own key.
// The key lives only in localStorage and is sent only to api.anthropic.com
// (the SDK's default base URL). The SDK is loaded lazily so Demo mode never
// downloads it.

import type { Runner } from '../core/scheduler';
import type { Task } from '../core/types';
import { CLASSES } from './classes';
import { getLang } from '../ui/i18n';
import type { ClassId } from '../core/types';

const KEY_STORAGE = 'starnet.apiKey';

export function getApiKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

export function setApiKey(key: string): void {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key.trim());
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* ignore */
  }
}

export function maskKey(key: string): string {
  if (!key) return 'ยังไม่ได้ใส่';
  return key.length <= 12 ? '****' : `${key.slice(0, 7)}...${key.slice(-4)}`;
}

type SDK = typeof import('@anthropic-ai/sdk');
let sdkPromise: Promise<SDK> | null = null;
const loadSdk = () => (sdkPromise ??= import('@anthropic-ai/sdk'));

export function buildUserMessage(task: Task): string {
  if (!task.input) return task.prompt;
  return `Mission brief from the operator:\n${task.prompt}\n\nWork handed to you (output from a previous crew member or a document from the operator):\n<previous_output>\n${task.input}\n</previous_output>\n\nDo your part of the mission using that material.`;
}

export class LiveError extends Error {
  constructor(
    message: string,
    public kind: 'auth' | 'rate' | 'network' | 'overloaded' | 'refusal' | 'bad_request' | 'unknown',
  ) {
    super(message);
    this.name = 'LiveError';
  }
}

export function liveRunner(cls: ClassId, maxTokens: number, webSearch = false): Runner {
  return async ({ task, signal, text }) => {
    const apiKey = getApiKey();
    if (!apiKey) throw new LiveError('ยังไม่ได้ใส่ API key เปิดหน้าตั้งค่าแล้ววาง key ของ Anthropic หรือสลับกลับไปโหมดตัวอย่าง', 'auth');
    const mod = await loadSdk();
    const Anthropic = mod.default;
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 });

    const params = {
      model: task.model,
      max_tokens: maxTokens,
      system: CLASSES[cls].system + languageRule(),
      ...(webSearch ? { tools: [webSearchTool(task.model)] } : {}),
      messages: [{ role: 'user' as const, content: buildUserMessage(task) }],
    };

    try {
      // Sonnet 5.5 can decline on safety classifiers; opt into Anthropic's
      // server-side fallback so the operator gets an answer instead.
      const stream: any =
        task.model === 'claude-sonnet-5-5'
          ? client.beta.messages.stream(
              { ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } as any,
              { signal },
            )
          : client.messages.stream(params, { signal });

      stream.on('text', (delta: string) => text(delta));
      const msg: any = await stream.finalMessage();
      if (msg.stop_reason === 'refusal') {
        throw new LiveError('โมเดลปฏิเสธคำขอนี้ ลองเขียนคำสั่งใหม่ด้วยถ้อยคำอื่น', 'refusal');
      }
      if (msg.stop_reason === 'max_tokens') text(`\n\n_[หยุดที่เพดาน ${maxTokens} โทเคนต่องานตามที่ตั้งไว้ในหน้าตั้งค่า]_`);
      return { input: msg.usage?.input_tokens ?? 0, output: msg.usage?.output_tokens ?? 0 };
    } catch (err: any) {
      if (signal.aborted || err?.name === 'AbortError' || err instanceof Anthropic.APIUserAbortError) {
        const e = new Error('stopped');
        e.name = 'AbortError';
        throw e;
      }
      throw toLiveError(err, Anthropic);
    }
  };
}

function languageRule(): string {
  return getLang() === 'en'
    ? '\nLanguage: write in English by default. If the operator clearly writes the mission in another language, answer in that language.'
    : '\nLanguage: write in Thai by default, in natural modern Thai. If the operator clearly writes the mission in another language, answer in that language. Keep code, commands, file names, product names and technical terms in their original form.';
}

/** Anthropic-hosted web search; the newer variant needs a newer model. */
function webSearchTool(model: string) {
  const dynamic = model === 'claude-sonnet-5-5';
  return { type: dynamic ? 'web_search_20260209' : 'web_search_20250305', name: 'web_search', max_uses: 3 } as any;
}

function toLiveError(err: any, A: SDK['default']): LiveError {
  if (err instanceof LiveError) return err;
  if (err instanceof A.AuthenticationError || err instanceof A.PermissionDeniedError)
    return new LiveError('API key ไม่ถูกต้องหรือไม่มีสิทธิ์ ตรวจ key ในหน้าตั้งค่า', 'auth');
  if (err instanceof A.RateLimitError) return new LiveError('ส่งคำขอถี่เกินไป (rate limit) รอสักครู่แล้วลองใหม่ หรือให้ทำงานพร้อมกันน้อยลง', 'rate');
  if (err instanceof A.APIConnectionError) return new LiveError('เชื่อมต่อ api.anthropic.com ไม่ได้ ตรวจสอบอินเทอร์เน็ต', 'network');
  if (err instanceof A.BadRequestError) return new LiveError(`คำขอถูกปฏิเสธ: ${err.message}`, 'bad_request');
  if (err instanceof A.APIError && (err.status === 529 || (err.status ?? 0) >= 500))
    return new LiveError('เซิร์ฟเวอร์ของ Anthropic งานล้นอยู่ ลองใหม่ในอีกสักนาที', 'overloaded');
  return new LiveError(err?.message ?? 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ', 'unknown');
}

/** One tiny request to confirm a key works. Returns the tokens it used. */
export async function testKey(key: string): Promise<number> {
  if (!key) throw new LiveError('ยังไม่ได้ใส่ API key', 'auth');
  const mod = await loadSdk();
  const Anthropic = mod.default;
  const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 0 });
  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8,
      messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
    });
    return (msg.usage?.input_tokens ?? 0) + (msg.usage?.output_tokens ?? 0);
  } catch (err) {
    throw toLiveError(err, Anthropic);
  }
}
