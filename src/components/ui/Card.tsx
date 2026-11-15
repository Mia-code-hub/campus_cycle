import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/ui/cn';

export type CardTone = 'panel' | 'sunken' | 'raise' | 'tint';
export type CardRadius = 'sm' | 'md' | 'lg';

const TONE: Record<CardTone, string> = {
  panel: 'bg-panel shadow-soft ring-1 ring-line',
  sunken: 'bg-sunken',
  raise: 'bg-raise shadow-lift ring-1 ring-line',
  // 浅粉底：用于「这一步在做什么」的说明块，不抢正文
  tint: 'bg-blush/15 ring-1 ring-blush/40',
};

const RADIUS: Record<CardRadius, string> = {
  sm: 'rounded-card-sm',
  md: 'rounded-card',
  lg: 'rounded-card-lg',
};

const PADDING = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
  xl: 'p-6',
} as const;

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: CardTone;
  radius?: CardRadius;
  padding?: keyof typeof PADDING;
  /** 让卡片在栅格里能缩回去：默认 min-width:auto 会把移动端撑出横向滚动 */
  fit?: boolean;
  children?: ReactNode;
}

export default function Card({
  tone = 'panel',
  radius = 'lg',
  padding = 'lg',
  fit = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(RADIUS[radius], TONE[tone], PADDING[padding], fit && 'min-w-0', className)}
      {...rest}
    >
      {children}
    </div>
  );
}
