import { getDb } from './db';
import { cosineSimilarity, deserializeVector } from '@/lib/ai/vector';
import { matchLabelOf, relevanceScore, MIN_RESULT_SIMILARITY, type MatchLabel } from '@/lib/search-score';
import { donateBoost } from './donate-boost';
import type { ItemSummary } from './items';

// 语义检索：全表载入在架物品的向量算余弦，再叠加业务加权（公益优先、帮扶生优先）。
// 数据量在校园场景是几百条量级，SQLite + 内存遍历足够，不需要上向量库。

export interface RankedItem extends ItemSummary {
  similarity: number | null; // null = 关键词兜底命中，没有语义分
  score: number;
  matchLabel: MatchLabel;
}

interface EmbeddingRow extends ItemSummary {
  embedding: Buffer | null;
}

const ITEM_COLUMNS = `id, title, image_path, category, condition_level, mode, price, view_count, created_at`;

export function searchItems(
  queryVec: ArrayLike<number>,
  opts: { topK?: number; viewerId?: number | null } = {},
): RankedItem[] {
  if (queryVec.length === 0) return [];
  const topK = Math.min(50, Math.max(1, opts.topK ?? 8));
  const aidBoost = donateBoost(opts.viewerId ?? null);

  const rows = getDb()
    .prepare(
      `SELECT ${ITEM_COLUMNS}, embedding FROM items
       WHERE status = 'listed' AND violation_flag = 0 AND embedding IS NOT NULL`,
    )
    .all() as EmbeddingRow[];

  const hits: RankedItem[] = [];
  for (const row of rows) {
    const vec = deserializeVector(row.embedding);
    // 维度对不上（换过 embedding 模型）就跳过，等补算覆盖
    if (!vec || vec.length !== queryVec.length) continue;
    const similarity = cosineSimilarity(queryVec, vec);
    if (similarity < MIN_RESULT_SIMILARITY) continue;
    hits.push({
      id: row.id,
      title: row.title,
      image_path: row.image_path,
      category: row.category,
      condition_level: row.condition_level,
      mode: row.mode,
      price: row.price,
      view_count: row.view_count,
      created_at: row.created_at,
      similarity,
      score: relevanceScore(similarity, { mode: row.mode, aidBoost }),
      matchLabel: matchLabelOf(similarity),
    });
  }

  hits.sort((a, b) => b.score - a.score || b.created_at.localeCompare(a.created_at));
  return hits.slice(0, topK);
}

// 中文没有空格，用 2-gram 切词做兜底召回：语义服务不可用时搜索页至少还能出结果
function gramsOf(query: string): string[] {
  const out = new Set<string>();
  for (const token of query.split(/[\s,，。？?！!、；;：:·"'（）()【】\[\]]+/)) {
    if (!token) continue;
    if (/^[A-Za-z0-9]+$/.test(token)) {
      out.add(token.toLowerCase());
      continue;
    }
    if (token.length === 1) out.add(token);
    for (let i = 0; i + 1 < token.length; i++) out.add(token.slice(i, i + 2));
  }
  return [...out].slice(0, 12);
}

export function keywordSearch(
  query: string,
  opts: { topK?: number; viewerId?: number | null } = {},
): RankedItem[] {
  const grams = gramsOf(query.trim());
  if (grams.length === 0) return [];
  const topK = Math.min(50, Math.max(1, opts.topK ?? 8));

  const rows = getDb()
    .prepare(
      `SELECT ${ITEM_COLUMNS}, raw_desc, ai_desc, ai_tags FROM items
       WHERE status = 'listed' AND violation_flag = 0`,
    )
    .all() as (ItemSummary & { raw_desc: string | null; ai_desc: string | null; ai_tags: string | null })[];

  const hits: RankedItem[] = [];
  for (const row of rows) {
    const haystack = `${row.title} ${row.ai_desc ?? ''} ${row.raw_desc ?? ''} ${row.ai_tags ?? ''}`.toLowerCase();
    let matched = 0;
    for (const g of grams) if (haystack.includes(g)) matched++;
    if (matched === 0) continue;
    hits.push({
      id: row.id,
      title: row.title,
      image_path: row.image_path,
      category: row.category,
      condition_level: row.condition_level,
      mode: row.mode,
      price: row.price,
      view_count: row.view_count,
      created_at: row.created_at,
      similarity: null,
      score: matched / grams.length,
      matchLabel: '关键词',
    });
  }

  hits.sort((a, b) => b.score - a.score || b.created_at.localeCompare(a.created_at));
  return hits.slice(0, topK);
}
