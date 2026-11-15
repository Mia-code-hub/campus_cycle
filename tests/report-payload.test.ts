import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PlatformStats } from '../src/server/stats.ts';
import {
  buildPayloadText,
  buildReportPayload,
  buildReportSnapshot,
  monthText,
  reportTitle,
} from '../src/lib/report/payload.ts';
import { buildAllowlist } from '../src/lib/report/verify.ts';

// 数据快照是报告、图表、白名单三处的共同来源，这里的断言就是「三者同源」的证据。

function fixture(overrides: Partial<PlatformStats> = {}): PlatformStats {
  return {
    generatedAt: '2026-11-15 15:20:33',
    overview: {
      totalItems: 30,
      completedItems: 9,
      saleCount: 5,
      donateCount: 4,
      activeUsers: 4,
      aidedStudents: 1,
      benefitedStudents: 3,
      greenWeightKg: 7.15,
      paperSavedKg: 0.95,
      co2SavedKg: 15,
    },
    trend: [
      { month: '2026-06', count: 0 },
      { month: '2026-10', count: 6 },
      { month: '2026-11', count: 3 },
    ],
    categories: [
      { category: 'daily', label: '日用品', count: 3, share: 0.3333, greenWeightKg: 1.2 },
      { category: 'textbook', label: '教材', count: 3, share: 0.3333, greenWeightKg: 1.05 },
      { category: 'appliance', label: '小家电', count: 2, share: 0.2222, greenWeightKg: 2.4 },
      { category: 'bedding', label: '被褥', count: 1, share: 0.1111, greenWeightKg: 2.5 },
    ],
    modeSplit: { sale: 5, donate: 4, saleShare: 0.5556, donateShare: 0.4444 },
    modeByCategory: [],
    collegeBenefit: [
      { college: '计算机学院', benefited: 1, donations: 2, items: 2 },
      { college: '外国语学院', benefited: 1, donations: 1, items: 1 },
      { college: '经济学院', benefited: 1, donations: 1, items: 1 },
    ],
    ...overrides,
  };
}

test('快照基础字段：日期取到分钟，占比换算成百分数一位小数', () => {
  const p = buildReportPayload(fixture(), 6);
  assert.equal(p.asOf, '2026-11-15');
  assert.equal(p.asOfTime, '2026-11-15 15:20');
  assert.equal(p.months, 6);
  assert.equal(p.overview.donateSharePercent, '44.4');
  assert.equal(p.overview.saleSharePercent, '55.6');
  // 小数位由我们定，不让前端再格式化：7.15 不变成 7.150
  assert.equal(p.overview.greenWeightKg, '7.15');
  assert.equal(p.overview.co2SavedKg, '15');
});

test('月度与峰值：窗口合计、峰值月份都能直接说给模型', () => {
  const p = buildReportPayload(fixture(), 6);
  assert.deepEqual(
    p.trend.map((t) => t.label),
    ['6月', '10月', '11月'],
  );
  assert.equal(p.trendTotal, 9);
  assert.deepEqual(p.peak, { label: '10月', count: 6 });
});

test('峰值全为 0 时不编造峰值月份', () => {
  const p = buildReportPayload(
    fixture({ trend: [{ month: '2026-11', count: 0 }] }),
    6,
  );
  assert.equal(p.peak, null);
});

test('跨年的月份标签带年份，避免两个 12 月撞在一起', () => {
  assert.equal(monthText('2026-03', '2026'), '3月');
  assert.equal(monthText('2025-12', '2026'), '25年12月');
});

test('类别与学院合计：与总览同源，合计等于逐项相加', () => {
  const p = buildReportPayload(fixture(), 6);
  assert.equal(p.categoryTotal, 9);
  assert.equal(p.categoryTotal, p.overview.completedItems);
  assert.deepEqual(p.collegeTotal, { benefited: 3, items: 4 });
});

test('关键数字表：单位与小数位固定，页面与 prompt 共用同一份', () => {
  const p = buildReportPayload(fixture(), 6);
  const byLabel = new Map(p.keyFigures.map((f) => [f.label, f]));
  assert.equal(byLabel.get('累计完成流转')?.value, '9');
  assert.equal(byLabel.get('闲置物资折算重量')?.value, '7.15');
  assert.equal(byLabel.get('减碳量（参考估算）')?.unit, 'kgCO₂e');
  assert.equal(byLabel.get('捐赠占完成流转')?.value, '44.4');
});

test('数据区原文：所有关键事实都在，且不含推算出来的数字', () => {
  const p = buildReportPayload(fixture(), 6);
  const text = buildPayloadText(p);

  assert.match(text, /数据快照：2026-11-15 15:20/);
  assert.match(text, /累计完成流转 9 件/);
  assert.match(text, /公益捐赠 4 件，占完成流转 44\.4%/);
  assert.match(text, /闲置物资折算重量 7\.15 kg/);
  assert.match(text, /减碳量 15 kgCO₂e（折算重量 × 2\.1）/);
  assert.match(text, /峰值月份 10月，6 件/);
  assert.match(text, /教材 3 件，占 33\.3%，折算重量 1\.05 kg/);
  assert.match(text, /计算机学院 受益 1 人，收到 2 件/);

  // 「100%」这种容易被模型顺势写出来的数字不该出现在数据区里
  const allow = buildAllowlist(text);
  assert.ok(!allow.has('100'));
  // 但真正存在的数字必须能查到
  assert.ok(allow.has('7.15'));
  assert.ok(allow.has('44.4'));
  assert.ok(allow.has('2.1'));
});

test('图表快照与报告同源：报告页的图不读实时数据', () => {
  const stats = fixture();
  const snap = buildReportSnapshot(stats, 6);
  assert.equal(snap.charts.trend, stats.trend);
  assert.equal(snap.charts.categories, stats.categories);
  assert.equal(snap.caliberVersion.length > 0, true);
  assert.equal(snap.payloadText, buildPayloadText(snap.payload));
  assert.match(reportTitle(snap.payload), /环保效益报告（2026-11-15）/);
});
