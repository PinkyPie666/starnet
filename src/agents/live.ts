// Live mode: real Claude calls straight from the browser with the user's own key.
// The key lives only in localStorage and is sent only to api.anthropic.com
// (the SDK's default base URL). The SDK is loaded lazily so Demo mode never
// downloads it.

import type { Runner } from '../core/scheduler';
import type { Task } from '../core/types';
import { CLASSES } from './classes';
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
  if (!key) return 'none';
  return key.length <= 12 ? '****' : `${key.slice(0, 7)}...${key.slice(-4)}`;
}

type SDK = typeof import('@anthropic-ai/sdk');
let sdkPromise: Promise<SDK> | null = null;
const loadSdk = () => (sdkPromise ??= import('@anthropic-ai/sdk'));

export function buildUserMessage(task: Task): string {
  if (!task.input) return task.prompt;
  return `Mission brief from the operator:\n${task.prompt}\n\nOutput from the previous crew member (your input for this step):\n<previous_output>\n${task.input}\n</previous_output>\n\nDo your part of the mission using that input.`;
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

export function liveRunner(cls: ClassId, maxTokens: number): Runner {
  return async ({ task, signal, text }) => {
    const apiKey = getApiKey();
    if (!apiKey) throw new LiveError('No API key set. Open Settings and paste your Anthropic key, or switch to Demo mode.', 'auth');
    const mod = await loadSdk();
    const Anthropic = mod.default;
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 });

    const params = {
      model: task.model,
      max_tokens: maxTokens,
      system: CLASSES[cls].system,
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
        throw new LiveError('The model declined this request. Try rephrasing the mission.', 'refusal');
      }
      if (msg.stop_reason === 'max_tokens') text(`\n\n_[Stopped at the ${maxTokens}-token output limit set in Settings.]_`);
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

function toLiveError(err: any, A: SDK['default']): LiveError {
  if (err instanceof LiveError) return err;
  if (err instanceof A.AuthenticationError || err instanceof A.PermissionDeniedError)
    return new LiveError('Bad or unauthorized API key. Check the key in Settings.', 'auth');
  if (err instanceof A.RateLimitError) return new LiveError('Rate limited by the API. Wait a moment and retry, or run fewer agents at once.', 'rate');
  if (err instanceof A.APIConnectionError) return new LiveError('Network error: could not reach api.anthropic.com. Check your connection.', 'network');
  if (err instanceof A.BadRequestError) return new LiveError(`Request rejected: ${err.message}`, 'bad_request');
  if (err instanceof A.APIError && (err.status === 529 || (err.status ?? 0) >= 500))
    return new LiveError('The API is overloaded right now. Retry in a minute.', 'overloaded');
  return new LiveError(err?.message ?? 'Unknown error', 'unknown');
}
