import type { ReactNode } from 'react';
import { cn } from '@/lib/ui/cn';

/** 一块骨架面。尺寸交给调用方，颜色与扫光动画都来自 .skeleton（令牌定义） */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden="true" />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={cn('h-3', i === lines - 1 ? 'w-2/3' : i % 2 ? 'w-11/12' : 'w-full')}
        />
      ))}
    </div>
  );
}

/** 物品卡骨架：图片 4:3、两行文字，和真实卡片同样的高度节奏，切过去不跳 */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-card bg-panel shadow-soft', className)}>
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="flex flex-col gap-2 p-3">
        <Skeleton className="h-3.5 w-3/4" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 8, className }: { count?: number; className?: string }) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
        className,
      )}
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/**
 * 加载区域的语义外壳：骨架本身对读屏不可见，
 * 由这里统一播报「正在加载」——否则读屏用户只会听到一片空白。
 */
export function LoadingRegion({
  label = '正在加载内容…',
  children,
  className,
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** 页面级骨架：标题 + 可选筛选条 + 卡片网格，路由 loading.tsx 共用 */
export function PageSkeleton({
  label = '正在加载页面…',
  withFilter = false,
  gridCount = 8,
}: {
  label?: string;
  withFilter?: boolean;
  gridCount?: number;
}) {
  return (
    <LoadingRegion label={label}>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-28 rounded-full" />
          <Skeleton className="h-8 w-72 max-w-full" />
          <Skeleton className="h-10 w-full rounded-card-sm" />
        </div>
        {withFilter && <Skeleton className="h-28 w-full rounded-card-lg" />}
        <SkeletonGrid count={gridCount} />
      </div>
    </LoadingRegion>
  );
}
