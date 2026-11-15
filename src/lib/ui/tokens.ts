/**
 * 运行时取令牌值。
 *
 * 大部分界面用 Tailwind 类名消费令牌就够了，但 canvas（感谢信导出、图片压缩垫底）
 * 拿不到 CSS 类名，只能读到具体的颜色字符串。这里的 fallback 与 globals.css 保持一致，
 * 用途只有一个：极少数在样式表尚未就绪时绘图的场景，不至于画出透明或黑色。
 * 因此本文件是设计令牌的「镜像」，允许出现十六进制——组件里仍然一个都不许写。
 */

export const PAINT_VARS = {
  panel: '--color-panel',
  raise: '--color-raise',
  paper: '--color-paper',
  paperLine: '--color-paper-line',
  line: '--color-line',
  lineStrong: '--color-line-strong',
  ink: '--color-ink',
  inkSoft: '--color-ink-soft',
  blush: '--color-blush-deep',
  sky: '--color-sky-deep',
  ok: '--color-ok',
  warn: '--color-warn',
  danger: '--color-danger',
} as const;

export type PaintToken = keyof typeof PAINT_VARS;

export const PAINT_FALLBACK: Record<PaintToken, string> = {
  panel: '#fffdfa',
  raise: '#fffefc',
  paper: '#fffdf7',
  paperLine: '#f0e8d8',
  line: '#ece1d7',
  lineStrong: '#ddcfc2',
  ink: '#4a4a55',
  inkSoft: '#8b8b96',
  blush: '#ef8fa1',
  sky: '#7cbcd4',
  ok: '#37735a',
  warn: '#7f5c11',
  danger: '#a23f4c',
};

/** 一次读齐：canvas 绘制时按 token 名取值，漏读某个变量也不会崩 */export function readPaintTokens(): Record<PaintToken, string> {
  const out = { ...PAINT_FALLBACK };
  if (typeof window === 'undefined' || typeof document === 'undefined') return out;
  const style = getComputedStyle(document.documentElement);
  for (const key of Object.keys(PAINT_VARS) as PaintToken[]) {
    const value = style.getPropertyValue(PAINT_VARS[key]).trim();
    if (value) out[key] = value;
  }
  return out;
}

/**
 * 最外层兜底页（app/global-error.tsx）专用：根布局已经挂了，样式表可能根本没有加载，
 * 这时 `var(--color-cream)` 取不到值。用法是 `var(--color-cream, ${CRITICAL_PAINT.cream})`，
 * 令牌能拿到就用令牌，拿不到才落到这里的镜像值。
 */
export const CRITICAL_PAINT = {
  cream: '#fdf6f0',
  panel: '#fffdfa',
  ink: '#4a4a55',
  inkSoft: '#8b8b96',
  blush: '#f7b2bd',
} as const;
