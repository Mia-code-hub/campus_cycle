'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * 路由切换的顶部细进度条。
 * App Router 没有 router event，这里退一步：捕获阶段监听站内链接点击 → 起条，
 * 路径（含查询串）一变 → 收条。点击后 12 秒兜底收起，避免链接失效时条子永远挂着。
 * 条子本身对读屏隐藏，另有 sr-only 状态播报。
 */
export default function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const key = `${pathname}?${searchParams.toString()}`;
  const lastKey = useRef(key);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      // 新标签页、下载、外链、锚点、以及被 preventDefault 的点击都不该起条
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const anchor = (e.target as HTMLElement | null)?.closest?.('a');
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      if (anchor.getAttribute('aria-disabled') === 'true') return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.hash && url.pathname === window.location.pathname && url.search === window.location.search) {
        return;
      }
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setActive(true);
    }

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  useEffect(() => {
    if (lastKey.current !== key) {
      lastKey.current = key;
      setActive(false);
    }
  }, [key]);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setActive(false), 12000);
    return () => clearTimeout(timer);
  }, [active]);

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden print:hidden"
      >
        {active && (
          <div className="h-full w-1/3 rounded-full bg-lilac-deep animate-nav-progress motion-reduce:w-full motion-reduce:animate-none" />
        )}
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {active ? '正在加载页面' : ''}
      </p>
    </>
  );
}
