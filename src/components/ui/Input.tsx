'use client';

import { useId } from 'react';
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/ui/cn';

/* 输入控件的统一外观：下沉底 + 令牌描边 + 聚焦时换成品牌紫描边。
   注意没有写 outline-none 就完事——全局 :focus-visible 仍然给一圈焦点环，
   这里只是把「边框变色」作为额外的视觉反馈。 */
const CONTROL =
  'w-full rounded-card-sm border border-line-strong bg-sunken/60 px-3 py-2 text-sm text-ink ' +
  'placeholder:text-ink-soft/70 transition focus:border-lilac-deep ' +
  'aria-[invalid=true]:border-danger aria-[invalid=true]:bg-danger-soft/40';

interface FieldChrome {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  wrapperClassName?: string;
  /** 标签右侧的小徽章（如「AI / 已修改」） */
  badge?: ReactNode;
}

function describedBy(id: string, hint?: string, error?: string): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length ? ids.join(' ') : undefined;
}

function Chrome({
  id,
  label,
  hint,
  error,
  required,
  badge,
  wrapperClassName,
  children,
}: FieldChrome & { id: string; children: ReactNode }) {
  return (
    <div className={cn('flex flex-col gap-1.5', wrapperClassName)}>
      {label && (
        <label htmlFor={id} className="flex items-center gap-1.5 text-sm text-ink-soft">
          <span>
            {label}
            {required && (
              <span className="ml-0.5 text-danger" aria-hidden="true">
                *
              </span>
            )}
          </span>
          {badge}
        </label>
      )}
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-xs leading-5 text-ink-soft">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs leading-5 text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({
  label,
  hint,
  error,
  required,
  badge,
  wrapperClassName,
  className,
  id,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & FieldChrome) {
  const auto = useId();
  const fieldId = id ?? auto;
  const control = (
    <input
      id={fieldId}
      required={required}
      aria-required={required || undefined}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(fieldId, hint, error)}
      className={cn(CONTROL, className)}
      {...rest}
    />
  );
  if (!label && !hint && !error) return control;
  return (
    <Chrome
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      required={required}
      badge={badge}
      wrapperClassName={wrapperClassName}
    >
      {control}
    </Chrome>
  );
}

export function Textarea({
  label,
  hint,
  error,
  required,
  badge,
  wrapperClassName,
  className,
  id,
  rows = 3,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldChrome) {
  const auto = useId();
  const fieldId = id ?? auto;
  const control = (
    <textarea
      id={fieldId}
      rows={rows}
      required={required}
      aria-required={required || undefined}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(fieldId, hint, error)}
      className={cn(CONTROL, 'leading-6', className)}
      {...rest}
    />
  );
  if (!label && !hint && !error) return control;
  return (
    <Chrome
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      required={required}
      badge={badge}
      wrapperClassName={wrapperClassName}
    >
      {control}
    </Chrome>
  );
}

export function Select({
  label,
  hint,
  error,
  required,
  badge,
  wrapperClassName,
  className,
  id,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & FieldChrome) {
  const auto = useId();
  const fieldId = id ?? auto;
  const control = (
    <select
      id={fieldId}
      required={required}
      aria-required={required || undefined}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(fieldId, hint, error)}
      className={cn(CONTROL, 'pr-8', className)}
      {...rest}
    >
      {children}
    </select>
  );
  if (!label && !hint && !error) return control;
  return (
    <Chrome
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      required={required}
      badge={badge}
      wrapperClassName={wrapperClassName}
    >
      {control}
    </Chrome>
  );
}
