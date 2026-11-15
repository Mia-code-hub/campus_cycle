import { LoadingRegion, Skeleton, SkeletonText } from '@/components/ui/Skeleton';

/** 个人中心：标题 + 三个统计卡 + 标签页 + 列表 */
export default function Loading() {
  return (
    <LoadingRegion label="正在加载个人中心…">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
        <Skeleton className="h-7 w-28" />
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-card-lg" />
          ))}
        </div>
        <div className="flex gap-3 border-b border-line pb-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-4 w-16" />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-card-lg bg-panel p-4 shadow-soft ring-1 ring-line"
            >
              <SkeletonText lines={2} />
            </div>
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}
