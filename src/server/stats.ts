import type { Database } from 'better-sqlite3';
import { CATEGORIES } from '../lib/constants.ts';
import { CO2_PER_KG, greenWeightKg } from '../lib/green-factors.ts';
import {
  COUNTABLE,
  METRIC_CALIBER,
  PERIOD_CALIBER,
  STATS_VERSION,
  greenFormulaText,
  metricCaliberList,
} from '../lib/stats-defs.ts';

// 平台统计层：所有数字在 SQL 里算完再返回，不接受前端传值。
// 函数统一收 db 句柄而不是自己 getDb()，这样 node:test 能拿内存库把关键数字钉死。

export interface Overview {
  totalItems: number;
  completedItems: number;
  saleCount: number;
  donateCount: number;
  activeUsers: number;
  aidedStudents: number;
  /** 实际收到过捐赠的去重学生数（与 aidedStudents 是两种口径，别混） */
  benefitedStudents: number;
  greenWeightKg: number;
  co2SavedKg: number;
}

export interface TrendPoint {
  month: string; // YYYY-MM
  count: number;
}

export interface CategoryBucket {
  category: string;
  label: string;
  count: number;
  share: number;
  greenWeightKg: number;
}

export interface ModeSplit {
  sale: number;
  donate: number;
  saleShare: number;
  donateShare: number;
}

export interface PlatformStats {
  generatedAt: string;
  overview: Overview;
  trend: TrendPoint[];
  categories: CategoryBucket[];
  modeSplit: ModeSplit;
}

const round = (n: number, digits = 2) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

const share = (part: number, total: number) => (total > 0 ? round(part / total, 4) : 0);

/** 近 N 天有发布行为的去重用户数 */
function countActiveUsers(db: Database, days = 30): number {
  const row = db
    .prepare(
      `SELECT COUNT(DISTINCT owner_id) AS c FROM items
        WHERE created_at >= datetime('now','localtime',?)
          AND ${COUNTABLE}`,
    )
    .get(`-${days} days`) as { c: number };
  return row.c;
}

/**
 * 已成交物品的折算重量明细：一件一行，捐赠落库时记过快照就用快照，否则按类目系数。
 * 转售与捐赠都计入——二手转卖同样让物品免于被丢弃、也省下一次新购。
 * 总览与类别分布都从这一份明细汇总，保证「合计 = 各类之和」不会对不上。
 */
function completedWeights(db: Database): Array<{ category: string; kg: number }> {
  // 一件物品理论上只有一条捐赠记录，但表上没加唯一约束，这里先按 item 去重再 JOIN，
  // 免得脏数据把重量和件数算成两倍
  const rows = db
    .prepare(
      `SELECT i.category AS category, COALESCE(d.kg, 0) AS kg
         FROM items i
         LEFT JOIN (SELECT item_id, MAX(green_weight_kg) AS kg FROM donations GROUP BY item_id) d
                ON d.item_id = i.id
        WHERE i.status = 'completed' AND i.violation_flag <> 1`,
    )
    .all() as Array<{ category: string; kg: number }>;

  return rows.map((r) => ({
    category: r.category,
    kg: r.kg > 0 ? r.kg : greenWeightKg(r.category),
  }));
}

function sumGreenWeight(db: Database): number {
  return round(completedWeights(db).reduce((s, r) => s + r.kg, 0));
}

export function getOverview(db: Database): Overview {
  const items = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
         SUM(CASE WHEN status = 'completed' AND mode = 'sale' THEN 1 ELSE 0 END) AS sale,
         SUM(CASE WHEN status = 'completed' AND mode = 'donate' THEN 1 ELSE 0 END) AS donate
       FROM items WHERE ${COUNTABLE}`,
    )
    .get() as { total: number; completed: number | null; sale: number | null; donate: number | null };

  const aided = db
    .prepare('SELECT COUNT(*) AS c FROM users WHERE is_aid_approved = 1')
    .get() as { c: number };

  const benefited = db
    .prepare('SELECT COUNT(DISTINCT receiver_id) AS c FROM donations')
    .get() as { c: number };

  const greenWeight = sumGreenWeight(db);

  return {
    totalItems: items.total,
    completedItems: items.completed ?? 0,
    saleCount: items.sale ?? 0,
    donateCount: items.donate ?? 0,
    activeUsers: countActiveUsers(db),
    aidedStudents: aided.c,
    benefitedStudents: benefited.c,
    greenWeightKg: greenWeight,
    co2SavedKg: round(greenWeight * CO2_PER_KG, 1),
  };
}

// 按发布月份归集的完成件数。表里没有成交时间列，所以口径是「这个月发布的物品里，
// 最终完成流转的有几件」——看板上必须这么写，否则会被追问。
export function getMonthlyTrend(db: Database, months = 6): TrendPoint[] {
  const raw = Number.isFinite(months) ? Math.trunc(months) : 6;
  const span = Math.min(24, Math.max(1, raw));
  const rows = db
    .prepare(
      `SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS c
         FROM items
        WHERE status = 'completed' AND violation_flag <> 1 AND created_at >= datetime('now','localtime',?)
        GROUP BY month ORDER BY month`,
    )
    .all(`-${span} months`) as Array<{ month: string; c: number }>;

  const map = new Map(rows.map((r) => [r.month, r.c]));
  // 没有数据点也补 0：折线图断档比掉到 0 更容易被误读成 bug
  const out: TrendPoint[] = [];
  const now = new Date();
  for (let i = span - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({ month: key, count: map.get(key) ?? 0 });
  }
  return out;
}

export function getCategoryDistribution(db: Database): CategoryBucket[] {
  const rows = db
    .prepare(
      `SELECT category, COUNT(*) AS c
         FROM items
        WHERE status = 'completed' AND violation_flag <> 1
        GROUP BY category`,
    )
    .all() as Array<{ category: string; c: number }>;

  const total = rows.reduce((s, r) => s + r.c, 0);

  const weightByCategory = new Map<string, number>();
  for (const w of completedWeights(db)) {
    weightByCategory.set(w.category, (weightByCategory.get(w.category) ?? 0) + w.kg);
  }

  const known = new Map(CATEGORIES.map((c) => [c.value, c.label]));
  return rows
    .map((r) => ({
      category: r.category,
      label: known.get(r.category) ?? r.category,
      count: r.c,
      share: share(r.c, total),
      greenWeightKg: round(weightByCategory.get(r.category) ?? 0),
    }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}

export function getModeSplit(db: Database): ModeSplit {
  const row = db
    .prepare(
      `SELECT
         SUM(CASE WHEN mode = 'sale' THEN 1 ELSE 0 END) AS sale,
         SUM(CASE WHEN mode = 'donate' THEN 1 ELSE 0 END) AS donate
       FROM items WHERE status = 'completed' AND violation_flag <> 1`,
    )
    .get() as { sale: number | null; donate: number | null };

  const sale = row.sale ?? 0;
  const donate = row.donate ?? 0;
  const total = sale + donate;
  return {
    sale,
    donate,
    saleShare: share(sale, total),
    donateShare: share(donate, total),
  };
}

/** 一次拿全，给接口与看板复用；口径说明跟着数据一起返回 */
export function getPlatformStats(db: Database, opts: { months?: number } = {}): PlatformStats {
  const months = opts.months ?? 6;
  return {
    generatedAt: new Date().toLocaleString('sv-SE').replace('T', ' '),
    overview: getOverview(db),
    trend: getMonthlyTrend(db, months),
    categories: getCategoryDistribution(db),
    modeSplit: getModeSplit(db),
  };
}

/** 返回给前端的口径说明：数字从哪来、怎么算、哪些不算 */
export function statsCaliber(months = 6) {
  return {
    version: STATS_VERSION,
    asOf: '调用时刻的数据库快照，不做缓存',
    window: {
      trendMonths: months,
      activeUserDays: 30,
    },
    metrics: metricCaliberList(),
    periods: PERIOD_CALIBER,
    formulas: {
      greenWeightKg: greenFormulaText(),
      co2SavedKg: METRIC_CALIBER.co2SavedKg.formula,
      co2FactorPerKg: CO2_PER_KG,
    },
  };
}
