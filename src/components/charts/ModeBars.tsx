'use client';

import { useMemo } from 'react';
import EChart from './EChart';
import { useChartTokens } from './useChartTokens';
import { buildModeOption } from './buildOptions';
import type { ModeBucket } from '@/server/stats';

/**
 * 转售 vs 捐赠：横向分组柱状。
 * 只画两根总柱子信息量太低，所以按类别拆开——既能看出总量差距，
 * 也能看出「哪些类别几乎全靠捐赠」（例如被褥）。
 */
export default function ModeBars({ data }: { data: ModeBucket[] }) {
  const tokens = useChartTokens();
  const option = useMemo(() => buildModeOption(data, tokens), [data, tokens]);

  if (data.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-ink-soft">
        还没有完成流转的物品
      </div>
    );
  }

  return (
    <EChart
      option={option}
      height={260}
      label={`各类别转售与捐赠对比横向柱状图，共 ${data.length} 个类别`}
    />
  );
}
