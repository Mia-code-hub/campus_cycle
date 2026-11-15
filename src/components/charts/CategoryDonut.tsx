'use client';

import { useMemo } from 'react';
import EChart from './EChart';
import { useChartTokens } from './useChartTokens';
import { buildCategoryOption } from './buildOptions';
import type { CategoryBucket } from '@/server/stats';

export default function CategoryDonut({ data }: { data: CategoryBucket[] }) {
  const tokens = useChartTokens();
  const option = useMemo(() => buildCategoryOption(data, tokens), [data, tokens]);

  if (data.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-ink-soft">
        还没有完成流转的物品
      </div>
    );
  }

  return <EChart option={option} height={260} label={`类别分布环形图，共 ${data.length} 个类别`} />;
}
