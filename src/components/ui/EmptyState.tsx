import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/ui/cn';
import { EmptyBoxArt } from './icons';
import { buttonClasses } from './Button';

interface Action {
  href: string;
  label: string;
}

interface EmptyStateProps {
  title: string;
  description?: string;
  /** 默认是纸箱插画；有更贴切的图标时传进来（如搜索用放大镜） */
  art?: ReactNode;
  action?: Action;
  secondary?: Action;
  compact?: boolean;
  className?: string;
}

/**
 * 空态：插画 + 一句「现在能做什么」，不只说「暂无数据」。
 * 主行动是链接而不是按钮——空态里的动作本质是导航。
 */
export default function EmptyState({
  title,
  description,
  art,
  action,
  secondary,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-card-lg bg-panel text-center shadow-soft ring-1 ring-line',
        compact ? 'px-6 py-8' : 'px-6 py-14',
        className,
      )}
    >
      {/* art={null} 表示明确不要插画（如抽屉里的空对话），此时不兜底默认图 */}
      {art === undefined ? <EmptyBoxArt className={cn(compact ? 'h-16' : 'h-24')} /> : art}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && (
        <p className="max-w-md text-xs leading-6 text-ink-soft">{description}</p>
      )}
      {(action || secondary) && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {action && (
            <Link href={action.href} className={buttonClasses({ variant: 'primary', size: 'md' })}>
              {action.label}
            </Link>
          )}
          {secondary && (
            <Link
              href={secondary.href}
              className={buttonClasses({ variant: 'ghost', size: 'md' })}
            >
              {secondary.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
