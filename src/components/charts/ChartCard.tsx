import type { ReactNode } from 'react';

interface Props {
  title: string;
  /** 一句话口径：数字怎么来的，看板上每个图都要能当场解释 */
  hint?: string;
  extra?: ReactNode;
  children: ReactNode;
}

/** 图表外壳：统一内边距、圆角与标题层级，四张图看起来才是一套 */
export default function ChartCard({ title, hint, extra, children }: Props) {
  return (
    <section className="min-w-0 rounded-card-lg bg-panel p-5 shadow-soft ring-1 ring-black/5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>
          {hint && <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">{hint}</p>}
        </div>
        {extra}
      </div>
      {children}
    </section>
  );
}
