import { LoadingRegion, Skeleton } from '@/components/ui/Skeleton';

/** 管理看板：四张指标卡 + 四张图表的位置先占住，图表容器不会先塌再撑 */
export default function Loading() {
  return (
    <LoadingRegion label="正在汇总统计数据…">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-6 py-8">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-3.5 w-72 max-w-full" />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-card-lg" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-card-lg lg:col-span-2" />
          <Skeleton className="h-80 rounded-card-lg" />
          <Skeleton className="h-72 rounded-card-lg" />
          <Skeleton className="h-72 rounded-card-lg lg:col-span-2" />
        </div>
      </div>
    </LoadingRegion>
  );
}
