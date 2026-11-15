import { PageSkeleton } from '@/components/ui/Skeleton';

/** 首页与大多数列表页共用：标题 + 筛选条 + 卡片网格 */
export default function Loading() {
  return <PageSkeleton withFilter gridCount={8} />;
}
