import { LoadingRegion, Skeleton, SkeletonGrid } from '@/components/ui/Skeleton';

/** 搜索页：先出搜索框，再出「AI 导购」卡与结果网格 */
export default function Loading() {
  return (
    <LoadingRegion label="正在加载搜索页…">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-64 max-w-full" />
          <Skeleton className="h-10 w-full rounded-card-sm" />
        </div>
        <Skeleton className="h-24 w-full rounded-card-lg" />
        <Skeleton className="h-3 w-40" />
        <SkeletonGrid count={8} />
      </div>
    </LoadingRegion>
  );
}
