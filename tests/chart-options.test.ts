import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCategoryOption,
  buildCollegeOption,
  buildModeOption,
  buildTrendOption,
  monthLabel,
} from '../src/components/charts/buildOptions.ts';
import { CHART_TOKEN_FALLBACK } from '../src/lib/chart-theme.ts';

// 图表 option 是纯函数产物，可以在 Node 里直接断言：
// series 里到底有没有数据、颜色是不是来自令牌、类目顺序对不对。
// 这些点用肉眼看图很难发现（比如少传一个 data 会画出空坐标系，看起来只是「图有点空」）。

const TOKENS = CHART_TOKEN_FALLBACK;

interface AxisLike {
  data?: string[];
}
interface SeriesLike {
  name?: string;
  type?: string;
  data: number[] | Array<{ name: string; value: number }>;
  itemStyle?: { color?: unknown };
}

const seriesOf = (o: unknown) => (o as { series: SeriesLike[] }).series;
const xAxisOf = (o: unknown) => (o as { xAxis: AxisLike }).xAxis;
const yAxisOf = (o: unknown) => (o as { yAxis: AxisLike }).yAxis;

test('月份标签：同年只写月，跨年补两位年份', () => {
  assert.equal(monthLabel('2026-03', '2026'), '3月');
  assert.equal(monthLabel('2026-12', '2026'), '12月');
  assert.equal(monthLabel('2025-12', '2026'), '25年12月');
});

test('月度趋势：点数与月份数一致，面积是渐变而不是单色', () => {
  const data = [
    { month: '2026-09', count: 0 },
    { month: '2026-10', count: 2 },
    { month: '2026-11', count: 3 },
  ];
  const option = buildTrendOption(data, TOKENS);
  const [line] = seriesOf(option);
  assert.equal(line.type, 'line');
  assert.deepEqual(line.data, [0, 2, 3]);
  assert.deepEqual(xAxisOf(option).data, ['9月', '10月', '11月']);

  const area = (option as { series: Array<{ areaStyle: { color: { colorStops: unknown[] } } }> })
    .series[0].areaStyle.color;
  assert.equal(area.colorStops.length, 2, '渐变至少要有起止两段');
});

test('类别环形：色板数量与类别数一致，中心显示合计', () => {
  const data = [
    { category: 'textbook', label: '教材', count: 3, share: 0.6, greenWeightKg: 1.05 },
    { category: 'daily', label: '日用品', count: 2, share: 0.4, greenWeightKg: 0.8 },
  ];
  const option = buildCategoryOption(data, TOKENS);
  const palette = (option as { color: string[] }).color;
  assert.equal(palette.length, 2);
  assert.ok(palette.every((c) => /^#[0-9a-f]{6}$/.test(c)));

  const [pie] = seriesOf(option);
  assert.equal(pie.type, 'pie');
  assert.deepEqual(pie.data, [
    { name: '教材', value: 3 },
    { name: '日用品', value: 2 },
  ]);
  assert.equal((option as { title: { text: string } }).title.text, '5');
});

test('转售与捐赠：只画有数据的类别，最大的类别排在最上面', () => {
  const data = [
    { category: 'textbook', label: '教材', sale: 3, donate: 0 },
    { category: 'bedding', label: '被褥', sale: 0, donate: 2 },
  ];
  const option = buildModeOption(data, TOKENS);
  const [sale, donate] = seriesOf(option);
  assert.equal(sale.name, '转售');
  assert.equal(donate.name, '捐赠');
  // 反转后最后一项（最大类别）在类目轴末端，也就是视觉上的顶部
  assert.deepEqual(yAxisOf(option).data, ['被褥', '教材']);
  assert.deepEqual(sale.data, [0, 3]);
  assert.deepEqual(donate.data, [2, 0]);
});

test('学院受益：条尾标人数，受益人数按人去重后的值直接画', () => {
  const data = [
    { college: '计算机学院', benefited: 2, donations: 3, items: 3 },
    { college: '外国语学院', benefited: 1, donations: 1, items: 1 },
  ];
  const option = buildCollegeOption(data, TOKENS);
  const [bar] = seriesOf(option);
  assert.deepEqual(yAxisOf(option).data, ['外国语学院', '计算机学院']);
  assert.deepEqual(bar.data, [1, 2]);
  assert.equal((option as { series: Array<{ label: { formatter: string } }> }).series[0].label.formatter, '{c} 人');
  // 条形用渐变，起点终点都来自主题令牌，不能出现未定义的 color
  const color = (option as { series: Array<{ itemStyle: { color: { colorStops: Array<{ color: string }> } } }> })
    .series[0].itemStyle.color;
  assert.ok(color.colorStops.every((s) => s.color.startsWith('rgba(')));
});

test('空数据：不抛错，series 为空数组（由组件层显示占位文案）', () => {
  assert.deepEqual(seriesOf(buildCategoryOption([], TOKENS))[0].data, []);
  assert.deepEqual(seriesOf(buildModeOption([], TOKENS))[0].data, []);
  assert.deepEqual(seriesOf(buildCollegeOption([], TOKENS))[0].data, []);
});
