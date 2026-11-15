'use client';

import { useMemo } from 'react';
import EChart from './EChart';
import { useChartTokens } from './useChartTokens';
import { buildCollegeOption } from './buildOptions';
import type { CollegeBucket } from '@/server/stats';

/** 学院受益：横向条形，条尾标出人数；受益人数是去重学生数，不是人次 */
export default function CollegeBars({ data }: { data: CollegeBucket[] }) {
  const tokens = useChartTokens();
  const option = useMemo(() => buildCollegeOption(data, tokens), [data, tokens]);

  if (data.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-ink-soft">
        还没有产生捐赠交付记录
      </div>
    );
  }

  return <EChart option={option} height={260} label={`学院受益人数条形图，覆盖 ${data.length} 个学院`} />;
}
