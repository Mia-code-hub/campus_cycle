import { echarts, type EChartsCoreOption } from './echarts.ts';
import { BAR_RADIUS, categoryAxisStyle, tooltipStyle, valueAxisStyle } from './chartOptions.ts';
import { buildPalette, mixHex, withAlpha, type ChartTokens } from '../../lib/chart-theme.ts';
import type {
  CategoryBucket,
  CollegeBucket,
  ModeBucket,
  TrendPoint,
} from '../../server/stats.ts';

// 四张图的 option 构造集中在这里：纯函数、收「数据 + 令牌」两个入参，
// 组件里只留一层 useMemo。这样配色和数据映射都能被 node:test 直接断言，
// 不用起浏览器才知道某个 series 的数据是不是空的。

/** 2026-03 → 3月；跨年时补上年份，避免两个 12 月撞在一起 */
export function monthLabel(key: string, firstYear: string): string {
  const [year, month] = key.split('-');
  return year === firstYear ? `${Number(month)}月` : `${year.slice(2)}年${Number(month)}月`;
}

export function buildTrendOption(data: TrendPoint[], tokens: ChartTokens): EChartsCoreOption {
  const firstYear = data[0]?.month.split('-')[0] ?? '';
  const line = mixHex(tokens.sky, tokens.ink, 0.28);
  return {
    animationDuration: 600,
    grid: { left: 8, right: 16, top: 24, bottom: 4, containLabel: true },
    tooltip: {
      trigger: 'axis',
      ...tooltipStyle(tokens),
      axisPointer: { type: 'line', lineStyle: { color: withAlpha(tokens.sky, 0.8) } },
      valueFormatter: (v: unknown) => `${v} 件`,
    },
    xAxis: {
      ...categoryAxisStyle(tokens),
      boundaryGap: false,
      data: data.map((p) => monthLabel(p.month, firstYear)),
    },
    yAxis: valueAxisStyle(tokens),
    series: [
      {
        name: '完成流转',
        type: 'line',
        smooth: 0.35,
        symbol: 'circle',
        symbolSize: 6,
        showSymbol: data.length <= 12,
        data: data.map((p) => p.count),
        lineStyle: { width: 2.5, color: line },
        itemStyle: { color: line, borderColor: tokens.panel, borderWidth: 2 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: withAlpha(tokens.sky, 0.55) },
            { offset: 1, color: withAlpha(tokens.sky, 0.02) },
          ]),
        },
        emphasis: { focus: 'series' },
      },
    ],
  };
}

export function buildCategoryOption(
  data: CategoryBucket[],
  tokens: ChartTokens,
): EChartsCoreOption {
  const total = data.reduce((s, c) => s + c.count, 0);
  return {
    animationDuration: 600,
    color: buildPalette(tokens, data.length),
    tooltip: {
      trigger: 'item',
      ...tooltipStyle(tokens),
      formatter: (p: unknown) => {
        const item = p as { name: string; value: number; percent: number };
        return `${item.name}<br/>${item.value} 件 · ${item.percent}%`;
      },
    },
    legend: {
      bottom: 0,
      itemWidth: 8,
      itemHeight: 8,
      icon: 'circle',
      textStyle: { color: tokens.inkSoft, fontSize: 11 },
    },
    title: {
      text: String(total),
      subtext: '件已完成',
      left: 'center',
      top: '34%',
      textStyle: { color: tokens.ink, fontSize: 26, fontWeight: 600 },
      subtextStyle: { color: tokens.inkSoft, fontSize: 11 },
    },
    series: [
      {
        type: 'pie',
        radius: ['46%', '68%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        padAngle: 2,
        itemStyle: { borderRadius: 4, borderColor: tokens.panel, borderWidth: 2 },
        label: { show: false },
        labelLine: { show: false },
        emphasis: { scaleSize: 4 },
        data: data.map((c) => ({ name: c.label, value: c.count })),
      },
    ],
  };
}

export function buildModeOption(data: ModeBucket[], tokens: ChartTokens): EChartsCoreOption {
  // ECharts 的类目轴从下往上排，先反转才能让件数最多的类别显示在最上面
  const rows = [...data].reverse();
  const saleColor = mixHex(tokens.blush, tokens.ink, 0.12);
  const donateColor = mixHex(tokens.sky, tokens.ink, 0.16);
  return {
    animationDuration: 600,
    grid: { left: 8, right: 40, top: 12, bottom: 4, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, ...tooltipStyle(tokens) },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 8,
      itemHeight: 8,
      icon: 'circle',
      textStyle: { color: tokens.inkSoft, fontSize: 11 },
    },
    xAxis: { ...valueAxisStyle(tokens) },
    yAxis: { ...categoryAxisStyle(tokens), data: rows.map((r) => r.label) },
    series: [
      {
        name: '转售',
        type: 'bar',
        barMaxWidth: 12,
        barGap: '30%',
        itemStyle: { color: saleColor, borderRadius: BAR_RADIUS },
        data: rows.map((r) => r.sale),
      },
      {
        name: '捐赠',
        type: 'bar',
        barMaxWidth: 12,
        itemStyle: { color: donateColor, borderRadius: BAR_RADIUS },
        data: rows.map((r) => r.donate),
      },
    ],
  };
}

export function buildCollegeOption(
  data: CollegeBucket[],
  tokens: ChartTokens,
): EChartsCoreOption {
  const rows = [...data].reverse();
  const start = mixHex(tokens.lilac, tokens.sky, 0.15);
  const end = mixHex(tokens.lilac, tokens.blush, 0.35);
  return {
    animationDuration: 600,
    grid: { left: 8, right: 40, top: 12, bottom: 4, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      ...tooltipStyle(tokens),
      formatter: (p: unknown) => {
        const list = p as Array<{ dataIndex: number }>;
        const row = rows[list[0]?.dataIndex ?? 0];
        if (!row) return '';
        return `${row.college}<br/>受益 ${row.benefited} 人 · 捐赠 ${row.donations} 人次 · 物品 ${row.items} 件`;
      },
    },
    xAxis: { ...valueAxisStyle(tokens) },
    yAxis: { ...categoryAxisStyle(tokens), data: rows.map((r) => r.college) },
    series: [
      {
        name: '受益人数',
        type: 'bar',
        barMaxWidth: 16,
        itemStyle: {
          borderRadius: BAR_RADIUS,
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: withAlpha(start, 0.95) },
            { offset: 1, color: withAlpha(end, 0.95) },
          ]),
        },
        label: {
          show: true,
          position: 'right',
          color: tokens.inkSoft,
          fontSize: 11,
          formatter: '{c} 人',
        },
        data: rows.map((r) => r.benefited),
      },
    ],
  };
}
