'use client';

import { useMemo } from 'react';
import EChart from './EChart';
import { useChartTokens } from './useChartTokens';
import { buildTrendOption } from './buildOptions';
import type { TrendPoint } from '@/server/stats';

export default function TrendChart({ data }: { data: TrendPoint[] }) {
  const tokens = useChartTokens();
  const option = useMemo(() => buildTrendOption(data, tokens), [data, tokens]);
  const total = data.reduce((s, p) => s + p.count, 0);

  return (
    <EChart
      option={option}
      height={260}
      label={`月度完成流转趋势折线图，近 ${data.length} 个月合计 ${total} 件`}
    />
  );
}
