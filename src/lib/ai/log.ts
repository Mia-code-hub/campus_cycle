import { getDb } from '@/server/db';
import { AI_FEATURE_ORDER } from '@/lib/ai-log-view';

// AI 调用留痕：比赛要交的「Prompt 历史快照」直接来自 ai_call_logs 表。
// 枚举与展示顺序只在 ai-log-view.ts 里定义一次，这里复用，避免两边漂移。
export const AI_FEATURES = AI_FEATURE_ORDER;
export type AiFeature = (typeof AI_FEATURES)[number];
export type AiStatus = 'ok' | 'timeout' | 'parse_error' | 'api_error';

export interface LogAiCallParams {
  feature: AiFeature;
  model: string;
  userId?: number | null;
  refItemId?: number | null;
  prompt: string;
  raw: string;
  parsed?: unknown;
  latencyMs?: number | null;
  status: AiStatus;
}

// prompt / 响应各截 32KB。
//
// 两个理由：① 带图请求的 prompt 里是一整段 base64，一次就几百 KB，
// 有人反复刷就能把库撑大；② 这些文本含用户描述、感谢信上下文（昵称/学院），
// 属于 PII，保留够复盘的分量就行，没必要全文永久留存。
const MAX_TEXT_CHARS = 32 * 1024;

function clip(text: string, max = MAX_TEXT_CHARS): string {
  if (text.length <= max) return text;
  // 别把 emoji 的代理对切成半个字符
  let end = max;
  const last = text.charCodeAt(end - 1);
  if (last >= 0xd800 && last <= 0xdbff) end -= 1;
  return `${text.slice(0, end)}\n…（已截断，原长 ${text.length} 字符）`;
}

export function logAiCall(p: LogAiCallParams): number {
  const db = getDb();
  const parsed =
    p.parsed == null ? null : typeof p.parsed === 'string' ? p.parsed : JSON.stringify(p.parsed);
  const info = db
    .prepare(
      `INSERT INTO ai_call_logs
         (feature, model, user_id, ref_item_id, prompt_text, response_text, parsed_result, latency_ms, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      p.feature,
      p.model,
      p.userId ?? null,
      p.refItemId ?? null,
      clip(p.prompt),
      clip(p.raw),
      parsed == null ? null : clip(parsed, 8 * 1024),
      p.latencyMs ?? null,
      p.status,
    );
  return Number(info.lastInsertRowid);
}

export interface AiCallLogRow {
  id: number;
  feature: string;
  model: string;
  user_id: number | null;
  ref_item_id: number | null;
  prompt_text: string;
  response_text: string;
  parsed_result: string | null;
  latency_ms: number | null;
  status: string;
  created_at: string;
}

export function getRecentCalls(feature?: AiFeature, limit = 20): AiCallLogRow[] {
  const db = getDb();
  if (feature) {
    return db
      .prepare('SELECT * FROM ai_call_logs WHERE feature = ? ORDER BY id DESC LIMIT ?')
      .all(feature, limit) as AiCallLogRow[];
  }
  return db.prepare('SELECT * FROM ai_call_logs ORDER BY id DESC LIMIT ?').all(limit) as AiCallLogRow[];
}
