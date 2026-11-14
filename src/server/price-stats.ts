import { getDb } from './db';

// 校内历史成交聚合：只统计「已完成 + 转售 + 价格>0」的物品。
// 样本 < 3 视为不足，调用方改用 lib/ref-price.ts 的经验区间。
export interface PriceStat {
  count: number;
  avg: number;
  min: number;
  max: number;
  insufficient: boolean;
}

const MIN_SAMPLE = 3;

interface Row {
  category: string;
  n: number;
  avg: number | null;
  min: number | null;
  max: number | null;
}

function toStat(row: Row): PriceStat {
  return {
    count: row.n,
    avg: Math.round(row.avg ?? 0),
    min: Math.round(row.min ?? 0),
    max: Math.round(row.max ?? 0),
    insufficient: row.n < MIN_SAMPLE,
  };
}

export function getAllPriceStats(): Record<string, PriceStat> {
  const rows = getDb()
    .prepare(
      `SELECT category, COUNT(*) AS n, AVG(price) AS avg, MIN(price) AS min, MAX(price) AS max
         FROM items
        WHERE status = 'completed' AND mode = 'sale' AND price > 0
        GROUP BY category`,
    )
    .all() as Row[];
  const map: Record<string, PriceStat> = {};
  for (const row of rows) map[row.category] = toStat(row);
  return map;
}

export function getCategoryPriceStats(category: string): PriceStat | null {
  const row = getDb()
    .prepare(
      `SELECT category, COUNT(*) AS n, AVG(price) AS avg, MIN(price) AS min, MAX(price) AS max
         FROM items
        WHERE category = ? AND status = 'completed' AND mode = 'sale' AND price > 0`,
    )
    .get(category) as Row | undefined;
  return row ? toStat(row) : null;
}
