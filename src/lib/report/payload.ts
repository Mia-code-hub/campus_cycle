// 环保报告的数据快照与 prompt 数据区。
// 纯函数、零运行时依赖（只从 stats-defs 取版本号，从 server/stats 取类型），
// 页面、接口、node:test 三处共用同一份快照，保证「报告里的数字」「图上的数字」「校验的白名单」同源。
//
// 关键约定：payloadText 是唯一送进模型的数字来源，同时也是白名单来源。
// 想给模型多一个数字，就得在 payloadText 里写出来——否则报告一用它就会被判不合格。

import type { CategoryBucket, PlatformStats, TrendPoint } from '../../server/stats.ts';
import { STATS_VERSION } from '../stats-defs.ts';

export interface Figure {
  label: string;
  /** 字符串：小数位是我们定的，不让前端再格式化一次 */
  value: string;
  unit: string;
  note?: string;
}

export interface ReportPayload {
  /** 2026-11-15 */
  asOf: string;
  /** 2026-11-15 15:20 */
  asOfTime: string;
  months: number;
  overview: {
    totalItems: number;
    completedItems: number;
    saleCount: number;
    donateCount: number;
    saleSharePercent: string;
    donateSharePercent: string;
    activeUsers: number;
    aidedStudents: number;
    benefitedStudents: number;
    greenWeightKg: string;
    paperSavedKg: string;
    co2SavedKg: string;
  };
  /** 报告与页面共用的关键数字表 */
  keyFigures: Figure[];
  trend: Array<{ month: string; label: string; count: number }>;
  trendTotal: number;
  peak: { label: string; count: number } | null;
  categories: Array<{ label: string; count: number; sharePercent: string; weightKg: string }>;
  categoryTotal: number;
  colleges: Array<{ college: string; benefited: number; items: number }>;
  collegeTotal: { benefited: number; items: number };
}

/** 图表快照：与报告同源，报告页的图不读实时数据 */
export interface ReportCharts {
  trend: TrendPoint[];
  categories: CategoryBucket[];
}

export interface ReportSnapshot {
  generatedAt: string;
  months: number;
  caliberVersion: string;
  payload: ReportPayload;
  /** 送进 prompt 的数据原文，也是校验白名单的来源 */
  payloadText: string;
  charts: ReportCharts;
}

/** 去掉多余的零：7.150 → 7.15，4.50 → 4.5，15.0 → 15 */
function trimNum(n: number, digits = 2): string {
  return String(Number(n.toFixed(digits)));
}

function pct(ratio: number): string {
  return (ratio * 100).toFixed(1);
}

/** 2026-03 → 3月；跨年补上年份，避免两个 12 月撞在一起 */
export function monthText(key: string, firstYear: string): string {
  const [year = '', month = ''] = key.split('-');
  return year === firstYear ? `${Number(month)}月` : `${year.slice(2)}年${Number(month)}月`;
}

export function buildReportPayload(stats: PlatformStats, months: number): ReportPayload {
  const { overview, trend, categories, modeSplit, collegeBenefit } = stats;
  const asOfTime = stats.generatedAt.slice(0, 16);
  const asOf = stats.generatedAt.slice(0, 10);

  const firstYear = trend[0]?.month.split('-')[0] ?? '';
  const trendRows = trend.map((p) => ({
    month: p.month,
    label: monthText(p.month, firstYear),
    count: p.count,
  }));
  const trendTotal = trend.reduce((s, p) => s + p.count, 0);
  const peakPoint = trend.reduce<TrendPoint | null>(
    (best, p) => (best === null || p.count > best.count ? p : best),
    null,
  );

  const categoryTotal = categories.reduce((s, c) => s + c.count, 0);
  const collegeTotal = {
    benefited: collegeBenefit.reduce((s, c) => s + c.benefited, 0),
    items: collegeBenefit.reduce((s, c) => s + c.items, 0),
  };

  const keyFigures: Figure[] = [
    { label: '累计完成流转', value: String(overview.completedItems), unit: '件' },
    { label: '转售成交', value: String(overview.saleCount), unit: '件' },
    { label: '公益捐赠', value: String(overview.donateCount), unit: '件' },
    { label: '捐赠占完成流转', value: pct(modeSplit.donateShare), unit: '%' },
    { label: '闲置物资折算重量', value: trimNum(overview.greenWeightKg), unit: 'kg' },
    { label: '节约纸张', value: trimNum(overview.paperSavedKg), unit: 'kg' },
    { label: '减碳量（参考估算）', value: trimNum(overview.co2SavedKg, 1), unit: 'kgCO₂e' },
    { label: '实际受助学生', value: String(overview.benefitedStudents), unit: '人' },
    { label: '近 30 天活跃发布用户', value: String(overview.activeUsers), unit: '人' },
  ];

  return {
    asOf,
    asOfTime,
    months,
    overview: {
      totalItems: overview.totalItems,
      completedItems: overview.completedItems,
      saleCount: overview.saleCount,
      donateCount: overview.donateCount,
      saleSharePercent: pct(modeSplit.saleShare),
      donateSharePercent: pct(modeSplit.donateShare),
      activeUsers: overview.activeUsers,
      aidedStudents: overview.aidedStudents,
      benefitedStudents: overview.benefitedStudents,
      greenWeightKg: trimNum(overview.greenWeightKg),
      paperSavedKg: trimNum(overview.paperSavedKg),
      co2SavedKg: trimNum(overview.co2SavedKg, 1),
    },
    keyFigures,
    trend: trendRows,
    trendTotal,
    peak: peakPoint && peakPoint.count > 0
      ? { label: monthText(peakPoint.month, firstYear), count: peakPoint.count }
      : null,
    categories: categories.map((c) => ({
      label: c.label,
      count: c.count,
      sharePercent: pct(c.share),
      weightKg: trimNum(c.greenWeightKg),
    })),
    categoryTotal,
    colleges: collegeBenefit.map((c) => ({
      college: c.college,
      benefited: c.benefited,
      items: c.items,
    })),
    collegeTotal,
  };
}

/**
 * 数据区原文：模型能看到的全部数字都在这里，白名单也从这里抽。
 * 格式刻意做成「一行一个事实」，模型照抄不容易出错，人核对也快。
 */
export function buildPayloadText(p: ReportPayload): string {
  const lines: string[] = [];

  lines.push(`数据快照：${p.asOfTime}（数据库实时聚合，统计口径版本 ${STATS_VERSION}）`);
  lines.push(`统计窗口：近 ${p.months} 个月`);
  lines.push('');

  lines.push('【总量】');
  lines.push(`累计发布物品 ${p.overview.totalItems} 件（不含下架与违规）`);
  lines.push(`累计完成流转 ${p.overview.completedItems} 件`);
  lines.push(`转售成交 ${p.overview.saleCount} 件，占完成流转 ${p.overview.saleSharePercent}%`);
  lines.push(`公益捐赠 ${p.overview.donateCount} 件，占完成流转 ${p.overview.donateSharePercent}%`);
  lines.push(`近 30 天活跃发布用户 ${p.overview.activeUsers} 人`);
  lines.push(`帮扶资格通过人数 ${p.overview.aidedStudents} 人`);
  lines.push(`实际受助学生 ${p.overview.benefitedStudents} 人`);
  lines.push('');

  lines.push('【环境效益（参考估算，非实测）】');
  lines.push(`闲置物资折算重量 ${p.overview.greenWeightKg} kg（已成交物品逐件折算后求和）`);
  lines.push(`节约纸张 ${p.overview.paperSavedKg} kg（教材与文具按类目纸张占比折算）`);
  lines.push(`减碳量 ${p.overview.co2SavedKg} kgCO₂e（折算重量 × 2.1）`);
  lines.push('');

  lines.push(`【月度完成流转（按物品发布月份归集，近 ${p.months} 个月）】`);
  for (const row of p.trend) lines.push(`${row.month} ${row.count} 件`);
  lines.push(`窗口内合计 ${p.trendTotal} 件`);
  if (p.peak) lines.push(`峰值月份 ${p.peak.label}，${p.peak.count} 件`);
  lines.push('');

  lines.push(`【类别分布（分母为累计完成流转 ${p.categoryTotal} 件）】`);
  for (const c of p.categories) {
    lines.push(`${c.label} ${c.count} 件，占 ${c.sharePercent}%，折算重量 ${c.weightKg} kg`);
  }
  lines.push('');
  lines.push('注：各类别占比是各自除以完成流转总件数，四舍五入到一位小数，各项相加可能不等于总量。');
  lines.push('');

  lines.push('【学院受益（受赠学生去重）】');
  for (const c of p.colleges) {
    lines.push(`${c.college} 受益 ${c.benefited} 人，收到 ${c.items} 件`);
  }
  lines.push(`合计受益 ${p.collegeTotal.benefited} 人，${p.collegeTotal.items} 件`);

  return lines.join('\n');
}

export function buildReportSnapshot(stats: PlatformStats, months: number): ReportSnapshot {
  const payload = buildReportPayload(stats, months);
  return {
    generatedAt: stats.generatedAt,
    months,
    caliberVersion: STATS_VERSION,
    payload,
    payloadText: buildPayloadText(payload),
    charts: { trend: stats.trend, categories: stats.categories },
  };
}

/** 报告标题：写死格式，避免模型自己起标题时把数字带歪 */
export function reportTitle(payload: ReportPayload): string {
  return `校园闲置物资循环 · 环保效益报告（${payload.asOf}）`;
}
