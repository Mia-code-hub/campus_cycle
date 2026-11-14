import { AiError, type AiErrorKind } from './client';
import { logAiCall, type AiFeature, type AiStatus } from './log';

export type AiResult<T> =
  | { ok: true; raw: string; parsed: T; latencyMs: number; logId: number }
  | { ok: false; kind: AiErrorKind; message: string; raw: string; latencyMs: number; logId: number };

export interface WithAiLogOptions<T> {
  feature: AiFeature;
  model: string;
  userId?: number | null;
  refItemId?: number | null;
  buildPrompt: () => string;
  run: () => Promise<string>;
  parse?: (raw: string) => T | null | undefined;
}

const KIND_MESSAGE: Record<AiErrorKind, string> = {
  api_error: 'AI 服务暂时不可用，请稍后重试',
  timeout: 'AI 请求超时，请稍后重试',
  parse_error: 'AI 返回格式异常',
};

// 高阶函数：统一负责计时、落库、错误转降级响应。
// 业务路由里只调用它，不写重复的 try/catch 与 logAiCall。
export async function withAiLog<T>(opts: WithAiLogOptions<T>): Promise<AiResult<T>> {
  const started = Date.now();
  const prompt = opts.buildPrompt();

  let raw = '';
  let parsed: T | null = null;
  let kind: AiErrorKind | null = null;

  try {
    raw = await opts.run();
    if (opts.parse) {
      const p = opts.parse(raw);
      if (p == null) {
        kind = 'parse_error';
      } else {
        parsed = p;
      }
    }
  } catch (e) {
    kind = e instanceof AiError ? e.kind : 'api_error';
    raw = e instanceof Error ? e.message : String(e);
  }

  const latencyMs = Date.now() - started;
  const status: AiStatus = kind ?? 'ok';
  const logId = logAiCall({
    feature: opts.feature,
    model: opts.model,
    userId: opts.userId,
    refItemId: opts.refItemId,
    prompt,
    raw,
    parsed: parsed ?? undefined,
    latencyMs,
    status,
  });

  if (kind === null) {
    return { ok: true, raw, parsed: parsed as T, latencyMs, logId };
  }
  return { ok: false, kind, message: KIND_MESSAGE[kind], raw, latencyMs, logId };
}
