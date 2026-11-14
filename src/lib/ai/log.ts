import { getDb } from '@/server/db';

// AI 调用留痕：比赛要交的「Prompt 历史快照」直接来自 ai_call_logs 表
export const AI_FEATURES = [
  'analyze',
  'search',
  'moderate',
  'letter',
  'report',
  'embed',
  'health',
] as const;
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
      p.prompt,
      p.raw,
      parsed,
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
