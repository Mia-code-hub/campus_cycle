'use client';

import { useEffect } from 'react';
import { CRITICAL_PAINT } from '@/lib/ui/tokens';

/**
 * 根布局自身崩溃时的兜底页。
 * 这一层拿不到 globals.css 的保证（根布局已经挂了），样式只能内联；
 * 颜色写成 `var(--token, 镜像值)`：令牌能读到就用令牌，读不到退回 lib/ui/tokens 里的镜像，
 * 所以这个文件里也没有硬编码色值——兜底值本身也是设计令牌的镜像，改配色只需改一处。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global-error]', error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `var(--color-cream, ${CRITICAL_PAINT.cream})`,
          color: `var(--color-ink, ${CRITICAL_PAINT.ink})`,
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
          padding: 24,
        }}
      >
        <main style={{ maxWidth: 460, textAlign: 'center' }}>
          <p style={{ fontSize: 11, letterSpacing: '0.3em', color: `var(--color-ink-soft, ${CRITICAL_PAINT.inkSoft})` }}>
            ERROR
          </p>
          <h1 style={{ fontSize: 22, margin: '10px 0 8px' }}>应用没能启动</h1>
          <p style={{ fontSize: 14, lineHeight: 1.9, color: `var(--color-ink-soft, ${CRITICAL_PAINT.inkSoft})` }}>
            最外层出了点问题。可以先重试；仍然不行的话，请稍后再访问，或联系管理员。
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 18,
              padding: '10px 22px',
              borderRadius: 16,
              border: 'none',
              background: `var(--color-blush, ${CRITICAL_PAINT.blush})`,
              color: `var(--color-ink, ${CRITICAL_PAINT.ink})`,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            重试
          </button>
          {error.digest && (
            <p style={{ marginTop: 14, fontSize: 11, color: `var(--color-ink-soft, ${CRITICAL_PAINT.inkSoft})` }}>
              错误编号：{error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
