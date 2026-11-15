'use client';

import { useState } from 'react';
import { CHART_TOKEN_FALLBACK, tokensFrom, type ChartTokens } from '@/lib/chart-theme';

/**
 * 从 CSS 主题令牌读图表配色。
 * 用 useState 的惰性初始化而不是 useEffect：颜色在首次客户端渲染就要定下来，
 * 走 effect 会先画一遍兜底色再变色，看起来像闪了一下。
 * 服务端渲染时没有 document，直接给与令牌同值的兜底，不会产生 hydration 差异。
 */
export function useChartTokens(): ChartTokens {
  const [tokens] = useState<ChartTokens>(() => {
    if (typeof document === 'undefined') return CHART_TOKEN_FALLBACK;
    const style = getComputedStyle(document.documentElement);
    return tokensFrom((name) => style.getPropertyValue(name));
  });
  return tokens;
}
