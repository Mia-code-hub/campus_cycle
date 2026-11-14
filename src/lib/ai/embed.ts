import { getDb } from '@/server/db';
import { categoryLabel } from '@/lib/constants';
import { AiError, embed, hasModelKey, type AiErrorKind } from './client';
import { EMBED_DIM, serializeVector } from './vector';
import { logAiCall } from './log';

// 物品向量化：title + ai_desc + raw_desc + category + condition_level + ai_tags 拼成一段文本，
// 调 text-embedding-v3（1024 维），Float32Array 序列化后写 items.embedding 与 embedded_at。

const MAX_LOG_PROMPT = 2000;

export function embeddingModel(): string {
  return process.env.EMBEDDING_MODEL ?? 'text-embedding-v3';
}

export interface EmbeddableItem {
  title: string;
  ai_desc: string | null;
  raw_desc: string | null;
  category: string;
  condition_level: string | null;
  ai_tags: string | null;
}

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

// 文本里 category 同时给中文名和枚举值，避免「教材」和 textbook 在向量空间里被割裂
export function buildItemEmbedText(item: EmbeddableItem): string {
  const tags = parseTags(item.ai_tags);
  return [
    `物品：${item.title}`,
    `类别：${categoryLabel(item.category)}（${item.category}）`,
    item.condition_level ? `成色：${item.condition_level}` : '',
    item.ai_desc ? `描述：${item.ai_desc}` : '',
    item.raw_desc ? `补充说明：${item.raw_desc}` : '',
    tags.length ? `标签：${tags.join('、')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export type EmbedCallResult =
  | { ok: true; vectors: number[][]; latencyMs: number }
  | { ok: false; kind: AiErrorKind; message: string; latencyMs: number };

// 统一入口：调用 + 留痕（feature='embed'，只记维度与条数，不把 1024 个浮点塞进日志）
export async function embedTexts(
  texts: string[],
  meta: { userId?: number | null; refItemId?: number | null; model?: string } = {},
): Promise<EmbedCallResult> {
  const model = meta.model ?? embeddingModel();
  const promptText = texts.join('\n---\n').slice(0, MAX_LOG_PROMPT);
  const userId = meta.userId ?? null;
  const refItemId = meta.refItemId ?? null;

  if (!hasModelKey(model)) {
    const message = `嵌入模型 ${model} 未配置 API Key`;
    logAiCall({
      feature: 'embed',
      model,
      userId,
      refItemId,
      prompt: promptText,
      raw: message,
      latencyMs: 0,
      status: 'api_error',
    });
    return { ok: false, kind: 'api_error', message, latencyMs: 0 };
  }

  const started = Date.now();
  try {
    const vectors = await embed({ model, texts, dimensions: EMBED_DIM });
    const latencyMs = Date.now() - started;
    logAiCall({
      feature: 'embed',
      model,
      userId,
      refItemId,
      prompt: promptText,
      raw: `ok: n=${vectors.length} dim=${vectors[0]?.length ?? 0}`,
      parsed: { n: vectors.length, dim: vectors[0]?.length ?? 0 },
      latencyMs,
      status: 'ok',
    });
    return { ok: true, vectors, latencyMs };
  } catch (e) {
    const latencyMs = Date.now() - started;
    const kind: AiErrorKind = e instanceof AiError ? e.kind : 'api_error';
    const message = e instanceof Error ? e.message : '嵌入调用失败';
    logAiCall({
      feature: 'embed',
      model,
      userId,
      refItemId,
      prompt: promptText,
      raw: message,
      latencyMs,
      status: kind,
    });
    return { ok: false, kind, message, latencyMs };
  }
}

export interface EmbedItemResult {
  ok: boolean;
  dim?: number;
  message?: string;
}

// 计算并落库单件物品的向量
export async function embedItem(
  itemId: number,
  opts: { userId?: number | null } = {},
): Promise<EmbedItemResult> {
  const db = getDb();
  const item = db
    .prepare(
      `SELECT title, ai_desc, raw_desc, category, condition_level, ai_tags
       FROM items WHERE id = ?`,
    )
    .get(itemId) as EmbeddableItem | undefined;
  if (!item) return { ok: false, message: '物品不存在' };

  const text = buildItemEmbedText(item);
  if (!text.trim()) return { ok: false, message: '物品文本为空' };

  const res = await embedTexts([text], { userId: opts.userId ?? null, refItemId: itemId });
  if (!res.ok) return { ok: false, message: res.message };

  const vector = res.vectors[0];
  db.prepare(
    `UPDATE items SET embedding = ?, embedded_at = datetime('now','localtime') WHERE id = ?`,
  ).run(serializeVector(vector), itemId);
  return { ok: true, dim: vector.length };
}

// 文案变更后置空，下次访问列表时会被补算
export function invalidateEmbedding(itemId: number): void {
  getDb().prepare('UPDATE items SET embedding = NULL, embedded_at = NULL WHERE id = ?').run(itemId);
}

// 串行补算：一次最多 limit 件，失败即停并进入冷却，避免模型挂掉时每次开页都猛打接口
let backfillRunning = false;
let lastFailAt = 0;
const RETRY_COOLDOWN_MS = 60_000;

export async function backfillMissingEmbeddings(limit = 3): Promise<number> {
  if (backfillRunning) return 0;
  if (Date.now() - lastFailAt < RETRY_COOLDOWN_MS) return 0;
  if (!hasModelKey(embeddingModel())) return 0;

  backfillRunning = true;
  let done = 0;
  try {
    const rows = getDb()
      .prepare(
        `SELECT id FROM items
         WHERE status = 'listed' AND violation_flag = 0
           AND (embedding IS NULL OR embedded_at IS NULL)
         ORDER BY id LIMIT ?`,
      )
      .all(Math.max(1, limit)) as { id: number }[];
    for (const row of rows) {
      const res = await embedItem(row.id);
      if (!res.ok) {
        lastFailAt = Date.now();
        break;
      }
      done++;
    }
  } catch {
    lastFailAt = Date.now();
  } finally {
    backfillRunning = false;
  }
  return done;
}
