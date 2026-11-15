import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/ui/cn';

export type BadgeTone =
  | 'neutral'
  | 'blush'
  | 'sky'
  | 'lilac'
  | 'ok'
  | 'warn'
  | 'danger'
  | 'outline';

const TONE: Record<BadgeTone, string> = {
  neutral: 'bg-sunken text-ink-soft',
  blush: 'bg-blush/45 text-ink',
  sky: 'bg-sky/45 text-ink',
  lilac: 'bg-lilac/45 text-ink',
  ok: 'bg-ok-soft text-ok ring-1 ring-ok-line',
  warn: 'bg-warn-soft text-warn ring-1 ring-warn-line',
  danger: 'bg-danger-soft text-danger ring-1 ring-danger-line',
  outline: 'bg-panel text-ink-soft ring-1 ring-line-strong',
};

const SIZE = {
  xs: 'px-1.5 py-0.5 text-[10px]',
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-2.5 py-0.5 text-xs',
} as const;

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: keyof typeof SIZE;
}

/** 状态标签。颜色只表达语义（成功/待处理/失败），不用色阶深浅去暗示程度——那需要额外图例 */
export default function Badge({ tone = 'neutral', size = 'md', className, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap',
        TONE[tone],
        SIZE[size],
        className,
      )}
      {...rest}
    />
  );
}
