'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/ui/cn';
import { CloseIcon } from './icons';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  /** sm/md 居中对话框；drawer 从右侧滑入，移动端铺满整屏 */
  size?: 'sm' | 'md' | 'drawer';
}

/**
 * 弹窗用原生 <dialog> + showModal()：
 * 焦点陷阱、Esc 关闭、关闭后焦点回到触发按钮，这三件事浏览器已经做对了，不必自己实现（也容易做错）。
 * 我们只补三样：滚动锁定、遮罩配色（走令牌）、关闭事件回传。
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  // 用 ref 存回调：监听器只在挂载时绑一次，不会因为父组件每次渲染换函数而反复解绑。
  // 更新放在 effect 里——渲染期间写 ref 会破坏 React 的纯渲染约定（eslint 也会报错）。
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Esc / 关闭按钮 / 程序化 close 都会走到这里，统一通知父组件
    const handleClose = () => closeRef.current();
    el.addEventListener('close', handleClose);
    return () => el.removeEventListener('close', handleClose);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const drawer = size === 'drawer';

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      aria-modal="true"
      // 点遮罩即关闭：dialog 自身铺满视口，内容层是它的子元素，target 命中 dialog 就说明点在外面
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        'm-0 border-0 bg-panel p-0 text-ink shadow-lift',
        drawer
          ? 'ml-auto h-dvh max-h-dvh w-full max-w-sm open:flex open:flex-col'
          : 'm-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg rounded-card-lg open:block',
        size === 'sm' && 'max-w-sm',
      )}
    >
      <div className={cn('flex min-h-0 flex-col', drawer && 'h-full')}>
        <header className="flex items-start gap-3 border-b border-line px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold tracking-tight">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-xs leading-5 text-ink-soft">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="-mr-1 shrink-0 rounded-card-sm p-1.5 text-ink-soft transition hover:bg-sunken hover:text-ink"
          >
            <CloseIcon size={18} />
          </button>
        </header>

        <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-4', !drawer && 'max-h-[70dvh]')}>
          {children}
        </div>

        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </dialog>
  );
}
