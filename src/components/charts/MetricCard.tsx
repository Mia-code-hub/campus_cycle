'use client';

import { useEffect, useRef } from 'react';

type Tone = 'blush' | 'sky' | 'lilac' | 'blend';

// 粉彩渐变底：四张卡各占一档，颜色全部来自主题令牌（blush / sky / lilac），
// 不在组件里写死十六进制，改主题时卡片跟着变。
const TONES: Record<Tone, string> = {
  blush: 'from-blush/60 via-blush/25 to-panel',
  sky: 'from-sky/60 via-sky/25 to-panel',
  lilac: 'from-lilac/60 via-lilac/25 to-panel',
  blend: 'from-sky/45 via-lilac/30 to-blush/20',
};

function format(n: number, decimals: number): string {
  const fixed = n.toFixed(decimals);
  const [int, dec] = fixed.split('.');
  const withComma = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec ? `${withComma}.${dec}` : withComma;
}

interface Props {
  label: string;
  value: number;
  unit: string;
  /** 小数位：件数 0，kg 2，减碳 1 */
  decimals?: number;
  hint?: string;
  tone?: Tone;
}

/**
 * 指标卡：数字滚动用 requestAnimationFrame 直接改文本节点，不引动画库。
 * 首屏（含 SSR）渲染的是最终值，因此禁用 JS、爬虫、打印出来的都是真实数字；
 * 客户端挂载后才从 0 滚到目标值，不会先闪一个 0。
 */
export default function MetricCard({
  label,
  value,
  unit,
  decimals = 0,
  hint,
  tone = 'blush',
}: Props) {
  const numberRef = useRef<HTMLSpanElement>(null);
  const finalText = format(value, decimals);

  useEffect(() => {
    const el = numberRef.current;
    if (!el) return;
    // 系统开启「减少动态效果」时不做动画，无障碍优先
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || value === 0) {
      el.textContent = finalText;
      return;
    }

    const duration = 900;
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      // easeOutCubic：开头快、收尾稳，数字不会在末尾来回抖
      const eased = 1 - (1 - p) ** 3;
      el.textContent = format(value * eased, decimals);
      if (p < 1) raf = requestAnimationFrame(tick);
      else el.textContent = finalText;
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, decimals, finalText]);

  return (
    <div
      className={`rounded-card-lg bg-gradient-to-br ${TONES[tone]} p-5 shadow-soft ring-1 ring-black/5`}
    >
      <div className="text-xs font-medium text-ink-soft">{label}</div>
      <div className="mt-2 flex items-baseline gap-1">
        <span
          ref={numberRef}
          className="text-3xl font-semibold tabular-nums tracking-tight text-ink"
          aria-label={`${label} ${finalText} ${unit}`}
        >
          {finalText}
        </span>
        <span className="text-sm text-ink-soft">{unit}</span>
      </div>
      {hint && <div className="mt-2 text-[11px] leading-relaxed text-ink-soft">{hint}</div>}
    </div>
  );
}
