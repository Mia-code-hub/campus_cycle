import { LoadingRegion, Skeleton, SkeletonText } from '@/components/ui/Skeleton';

/** 物品详情：左图右信息，骨架按真实版式的比例给，加载完不会跳一下 */
export default function Loading() {
  return (
    <LoadingRegion label="正在加载物品详情…">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
        <Skeleton className="h-4 w-20" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="aspect-[4/3] w-full rounded-card-lg" />
          <div className="flex flex-col gap-4 rounded-card-lg bg-panel p-6 shadow-soft ring-1 ring-line">
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-9 w-24" />
            <SkeletonText lines={3} />
            <div className="mt-auto flex gap-3 pt-4">
              <Skeleton className="h-10 flex-1 rounded-card" />
              <Skeleton className="h-10 w-24 rounded-card" />
            </div>
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}
