import Link from 'next/link';
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/ui/cn';
import ThreeDots from './ThreeDots';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-card font-medium whitespace-nowrap transition duration-150 ' +
  'disabled:pointer-events-none disabled:opacity-55 motion-reduce:hover:transform-none';

/* 主按钮粉、次按钮白、危险按钮玫红、幽灵按钮无底。hover 统一上浮 1px，
   给人的反馈是「这一下按下去有实体感」，而不是只变色。 */
const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-blush text-ink shadow-soft hover:-translate-y-0.5 hover:bg-blush-deep hover:shadow-lift active:translate-y-0',
  secondary:
    'bg-panel text-ink ring-1 ring-line-strong hover:-translate-y-0.5 hover:bg-raise hover:shadow-soft active:translate-y-0',
  ghost: 'text-ink-soft hover:bg-sunken hover:text-ink',
  danger:
    'bg-danger text-raise shadow-soft hover:-translate-y-0.5 hover:bg-danger-deep hover:shadow-lift active:translate-y-0',
  soft: 'bg-lilac/45 text-ink hover:-translate-y-0.5 hover:bg-lilac/70 hover:shadow-soft active:translate-y-0',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-[13px]',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-sm',
};

/** 供 <Link> 或其它元素复用的类名组合，避免同一个按钮在两处长得不一样 */
export function buttonClasses(opts: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
} = {}): string {
  const { variant = 'primary', size = 'md', block = false, className } = opts;
  return cn(BASE, VARIANT[variant], SIZE[size], block && 'w-full', className);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 请求中：禁用 + 三点动画 + 文案替换。AI 请求请传 loadingText="AI 正在思考…" */
  loading?: boolean;
  loadingText?: string;
  block?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingText = '处理中…',
  block = false,
  iconLeft,
  iconRight,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, block, className })}
      {...rest}
    >
      {loading ? (
        <>
          <ThreeDots />
          <span>{loadingText}</span>
        </>
      ) : (
        <>
          {iconLeft}
          {children}
          {iconRight}
        </>
      )}
    </button>
  );
}

/** 链接形态的按钮：语义上是导航，不能渲染成 <button> */
export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  block = false,
  className,
  children,
  iconLeft,
  iconRight,
  ...rest
}: ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}) {
  return (
    <Link className={buttonClasses({ variant, size, block, className })} {...rest}>
      {iconLeft}
      {children}
      {iconRight}
    </Link>
  );
}
