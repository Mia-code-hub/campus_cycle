'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/ui/cn';
import { dismiss, enqueue, type ToastInput, type ToastItem, type ToastTone } from '@/lib/ui/toast';
import { AlertIcon, CheckIcon, CloseIcon, InfoIcon } from './icons';

interface ToastApi {
  push: (toast: ToastInput) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast 必须用在 <ToastProvider> 内');
  return api;
}

const TONE_STYLE: Record<ToastTone, { bar: string; icon: ReactNode }> = {
  info: { bar: 'border-l-sky-deep', icon: <InfoIcon className="text-sky-deep" size={18} /> },
  ok: { bar: 'border-l-ok', icon: <CheckIcon className="text-ok" size={18} /> },
  warn: { bar: 'border-l-warn', icon: <AlertIcon className="text-warn" size={18} /> },
  danger: { bar: 'border-l-danger', icon: <AlertIcon className="text-danger" size={18} /> },
};

/**
 * 全局轻提示。挂在根布局，任何客户端组件都能 useToast() 弹一条。
 * 容器是 aria-live 区：新消息进来自动播报；错误用 role="alert" 抢读，普通消息用 role="status" 排队。
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const remove = useCallback((id: number) => {
    setItems((prev) => dismiss(prev, id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (input: ToastInput) => {
      const id = seq.current++;
      setItems((prev) => {
        const { list } = enqueue(prev, input, id);
        // 被挤出队列的旧 toast 要把计时器一起清掉，否则会在几秒后白白触发一次 setState
        for (const key of timers.current.keys()) {
          if (!list.some((t) => t.id === key)) {
            clearTimeout(timers.current.get(key));
            timers.current.delete(key);
          }
        }
        return list;
      });
      const timer = setTimeout(() => remove(id), input.duration ?? 4200);
      timers.current.set(id, timer);
    },
    [remove],
  );

  const dismissAll = useCallback(() => {
    for (const timer of timers.current.values()) clearTimeout(timer);
    timers.current.clear();
    setItems([]);
  }, []);

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const timer of map.values()) clearTimeout(timer);
      map.clear();
    };
  }, []);

  const api = useMemo(() => ({ push, dismissAll }), [push, dismissAll]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="region"
        aria-label="通知"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 bottom-20 z-50 flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-80 print:hidden"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'danger' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex items-start gap-2.5 rounded-card-sm border-l-4 bg-panel px-3.5 py-3 shadow-lift ring-1 ring-line',
              TONE_STYLE[t.tone].bar,
            )}
          >
            <span className="mt-0.5 shrink-0">{TONE_STYLE[t.tone].icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{t.title}</p>
              {t.description && (
                <p className="mt-0.5 text-xs leading-5 text-ink-soft">{t.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => remove(t.id)}
              aria-label="关闭通知"
              className="-mr-1 shrink-0 rounded p-1 text-ink-soft transition hover:bg-sunken hover:text-ink"
            >
              <CloseIcon size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
