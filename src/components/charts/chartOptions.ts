import { withAlpha, type ChartTokens } from '../../lib/chart-theme.ts';

// 四张图共用的视觉语言：网格线极淡、坐标轴不出线、提示框是圆角卡片。
// 这些样式只写一遍，避免每张图的 tooltip 圆角半径都不一样。

export function tooltipStyle(tokens: ChartTokens) {
  return {
    backgroundColor: tokens.panel,
    borderColor: withAlpha(tokens.ink, 0.08),
    borderWidth: 1,
    padding: [8, 12] as [number, number],
    textStyle: { color: tokens.ink, fontSize: 12 },
    extraCssText: `border-radius:12px;box-shadow:0 8px 24px ${withAlpha(tokens.ink, 0.12)};`,
  };
}

export function axisLabelStyle(tokens: ChartTokens) {
  return { color: tokens.inkSoft, fontSize: 11 };
}

/** 数值轴：只留横向参考线，颜色淡到不抢数据 */
export function valueAxisStyle(tokens: ChartTokens) {
  return {
    type: 'value' as const,
    minInterval: 1,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: axisLabelStyle(tokens),
    splitLine: { lineStyle: { color: withAlpha(tokens.ink, 0.07) } },
  };
}

/** 类目轴：不画轴线，标签留给类目名 */
export function categoryAxisStyle(tokens: ChartTokens) {
  return {
    type: 'category' as const,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: axisLabelStyle(tokens),
  };
}

/** 柱状图圆角：横向条只圆右侧两个角 */
export const BAR_RADIUS: [number, number, number, number] = [0, 6, 6, 0];
