import { CO2_PER_KG, GREEN_WEIGHT_KG, PAPER_SHARE } from './green-factors.ts';

// 统计口径的唯一来源：接口返回、页面 tooltip、测试断言三处引用同一份文案，
// 避免「页面上写 30 天、SQL 里算 7 天」这种对不上的情况。
// 纯常量与纯函数，不碰数据库，便于 node:test 直接引入。

export const STATS_VERSION = 'R17';

export type MetricKey =
  | 'totalItems'
  | 'completedItems'
  | 'saleCount'
  | 'donateCount'
  | 'activeUsers'
  | 'aidedStudents'
  | 'benefitedStudents'
  | 'greenWeightKg'
  | 'paperSavedKg'
  | 'co2SavedKg';

export interface MetricCaliber {
  label: string;
  unit: string;
  /** 一句话公式，能直接对着 SQL 核 */
  formula: string;
  note?: string;
}

// 「在架口径」：下架物品（status='removed'）与违规物品（violation_flag=1）一律不计入，
// 否则看板上的「累计流转」会因为有人删了一堆违规帖而变得不可解释。
export const COUNTABLE = "status <> 'removed' AND violation_flag <> 1";

export const METRIC_CALIBER: Record<MetricKey, MetricCaliber> = {
  totalItems: {
    label: '累计发布物品',
    unit: '件',
    formula: 'COUNT(items) WHERE status <> \'removed\' AND violation_flag <> 1',
    note: '含在架、已预留、已成交；下架与违规物品不计入',
  },
  completedItems: {
    label: '累计完成流转',
    unit: '件',
    formula: "COUNT(items) WHERE status = 'completed' AND status <> 'removed' AND violation_flag <> 1",
    note: '转售成交与捐赠交付都算完成',
  },
  saleCount: {
    label: '转售成交',
    unit: '件',
    formula: "COUNT(items) WHERE status = 'completed' AND mode = 'sale' AND violation_flag <> 1",
  },
  donateCount: {
    label: '公益捐赠',
    unit: '件',
    formula: "COUNT(items) WHERE status = 'completed' AND mode = 'donate' AND violation_flag <> 1",
  },
  activeUsers: {
    label: '近 30 天活跃用户',
    unit: '人',
    formula: 'COUNT(DISTINCT owner_id) FROM items WHERE created_at >= now - 30 days',
    note: '活跃定义为「发过物品」，浏览与收藏不计；口径窄但不会虚高',
  },
  aidedStudents: {
    label: '帮扶资格通过人数',
    unit: '人',
    formula: 'COUNT(users) WHERE is_aid_approved = 1',
    note: '是资格数，不是实际受助人数；实际受助人数另见 benefitedStudents',
  },
  benefitedStudents: {
    label: '实际受助学生',
    unit: '人',
    formula: 'COUNT(DISTINCT donations.receiver_id)',
    note: '收到过捐赠的去重学生数，按捐赠记录算，不按资格算',
  },
  greenWeightKg: {
    label: '闲置物资折算重量',
    unit: 'kg',
    formula: 'Σ 已成交物品（有捐赠快照用快照值，否则用该类目系数）',
    note: '转售与捐赠都计入：二手转卖同样让物品免于丢弃、省下一次新购；合计恒等于类别分布里各类重量之和',
  },
  paperSavedKg: {
    label: '节约纸张',
    unit: 'kg',
    formula: 'Σ 已成交物品折算重量 × 该类目纸张占比',
    note: '只算教材与文具：教材按 90%、文具按 50% 计纸张，其余类目不计（宁可少算）',
  },
  co2SavedKg: {
    label: '减碳量（参考估算）',
    unit: 'kgCO₂e',
    formula: `greenWeightKg × ${CO2_PER_KG}`,
    note: '参考估算值，非实测：系数为二手物资再利用的减排近似中位值',
  },
};

export interface PeriodCaliber {
  label: string;
  formula: string;
  note?: string;
}

export const PERIOD_CALIBER = {
  trend: {
    label: '月度趋势',
    formula: "GROUP BY strftime('%Y-%m', items.created_at)，只统计 status='completed'",
    note: '按「物品发布月份」归集，不是按成交月份——表里没有成交时间字段，这点在看板上要说明',
  },
  categories: {
    label: '类别分布',
    formula: "GROUP BY items.category WHERE status='completed'",
    note: '分母是累计完成流转件数，占比之和为 100%',
  },
  modeSplit: {
    label: '转售 / 捐赠占比',
    formula: "GROUP BY items.mode WHERE status='completed'",
    note: '占比 = 该模式件数 ÷ 累计完成流转件数',
  },
  collegeBenefit: {
    label: '学院受益分布',
    formula: 'donations JOIN users ON receiver_id GROUP BY users.college',
    note: '受益人数是去重受赠学生数，不是人次；不是每个学生都填了学院，未填的归入「未填写」一列',
  },
} as const;

/** 环保公式的完整说明文本，前端 tooltip 与文档直接引用 */
export function greenFormulaText(): string {
  const list = Object.entries(GREEN_WEIGHT_KG)
    .map(([k, v]) => `${k} ${v}kg`)
    .join('、');
  return `折算重量 = 已成交物品逐件折算后求和（捐赠落库有快照则用快照，否则按类目系数：${list}，其余 0.4kg 兜底）；减碳量 = 折算重量 × ${CO2_PER_KG}。以上均为参考估算值，非实测。`;
}

/** 节约纸张口径的完整说明，看板 tooltip 与报告直接引用 */
export function paperFormulaText(): string {
  const list = Object.entries(PAPER_SHARE)
    .map(([k, v]) => `${k} ${Math.round(v * 100)}%`)
    .join('、');
  return `节约纸张 = 已成交物品折算重量 × 类目纸张占比（${list}，其余类目不计）。按「二手再用省下一件新购」的思路估算，属于参考值。`;
}

/** 各指标口径的整体说明，接口返回值里的 caliber.metrics 用它 */
export function metricCaliberList(): Array<{ key: MetricKey } & MetricCaliber> {
  return (Object.keys(METRIC_CALIBER) as MetricKey[]).map((key) => ({
    key,
    ...METRIC_CALIBER[key],
  }));
}
