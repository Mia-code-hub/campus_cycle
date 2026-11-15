import type { ReactNode } from 'react';
import { cn } from '@/lib/ui/cn';
import { AlertIcon, CheckIcon, InfoIcon } from './icons';

export type AlertTone = 'info' | 'ok' | 'warn' | 'danger';

const TONE: Record<AlertTone, { box: string; title: string; icon: ReactNode }> = {
  info: {
    box: 'bg-sky/20 ring-1 ring-sky-deep/30',
    title: 'text-ink',
    icon: <InfoIcon className="text-sky-deep" size={18} />,
  },
  ok: {
    box: 'bg-ok-soft ring-1 ring-ok-line',
    title: 'text-ok',
    icon: <CheckIcon className="text-ok" size={18} />,
  },
  warn: {
    box: 'bg-warn-soft ring-1 ring-warn-line',
    title: 'text-warn',
    icon: <AlertIcon className="text-warn" size={18} />,
  },
  danger: {
    box: 'bg-danger-soft ring-1 ring-danger-line',
    title: 'text-danger',
    icon: <AlertIcon className="text-danger" size={18} />,
  },
};

interface AlertProps {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/**
 * 提示条。警告与错误用 role="alert" 让读屏立刻播报；普通说明用 role="status"，
 * 不打断当前朗读——「校验未通过」这种事必须马上知道，而「已按模板生成」不用。
 */
export default function Alert({ tone = 'info', title, children, action, className }: AlertProps) {
  const t = TONE[tone];
  const urgent = tone === 'danger' || tone === 'warn';
  return (
    <div
      role={urgent ? 'alert' : 'status'}
      className={cn('flex items-start gap-2.5 rounded-card-sm px-4 py-3 text-sm', t.box, className)}
    >
      <span className="mt-0.5 shrink-0">{t.icon}</span>
      <div className="min-w-0 flex-1">
        {title && <p className={cn('font-medium', t.title)}>{title}</p>}
        {children && (
          <div className={cn('leading-6 text-ink', title && 'mt-1', 'break-words')}>{children}</div>
        )}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}
