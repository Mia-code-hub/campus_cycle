'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORIES, CONDITIONS } from '@/lib/constants';

interface Props {
  category: string;
  mode: string;
  condition: string;
  minPrice: string;
  maxPrice: string;
}

function chipClass(active: boolean): string {
  return `rounded-full px-4 py-1.5 text-sm transition ${
    active ? 'bg-blush text-ink' : 'bg-panel text-ink-soft hover:bg-cream'
  }`;
}

export default function FilterBar({ category, mode, condition, minPrice, maxPrice }: Props) {
  const router = useRouter();
  const [min, setMin] = useState(minPrice);
  const [max, setMax] = useState(maxPrice);

  function apply(overrides: Record<string, string | undefined>) {
    const merged: Record<string, string | undefined> = {
      category,
      mode,
      condition,
      minPrice,
      maxPrice,
      ...overrides,
    };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : '/');
  }

  function toggle(key: string, value: string, current: string) {
    apply({ [key]: value === current ? undefined : value });
  }

  return (
    <div className="flex flex-col gap-3 rounded-card-lg bg-panel p-4 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 w-8 text-xs text-ink-soft">类别</span>
        <button type="button" onClick={() => apply({ category: undefined })} className={chipClass(!category)}>
          全部
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => toggle('category', c.value, category)}
            className={chipClass(category === c.value)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 w-8 text-xs text-ink-soft">方式</span>
        <button type="button" onClick={() => apply({ mode: undefined })} className={chipClass(!mode)}>
          全部
        </button>
        <button type="button" onClick={() => toggle('mode', 'sale', mode)} className={chipClass(mode === 'sale')}>
          低价转售
        </button>
        <button type="button" onClick={() => toggle('mode', 'donate', mode)} className={chipClass(mode === 'donate')}>
          公益捐赠
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span className="text-xs text-ink-soft">成色</span>
          <select
            value={condition}
            onChange={(e) => apply({ condition: e.target.value || undefined })}
            className="rounded-card-sm border border-black/10 bg-cream/50 px-2 py-1.5 text-sm outline-none focus:border-blush-deep"
          >
            <option value="">全部</option>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className="text-xs text-ink-soft">价格</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            placeholder="最低"
            className="w-20 rounded-card-sm border border-black/10 bg-cream/50 px-2 py-1.5 text-sm outline-none focus:border-blush-deep"
          />
          <span className="text-xs text-ink-soft">-</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            placeholder="最高"
            className="w-20 rounded-card-sm border border-black/10 bg-cream/50 px-2 py-1.5 text-sm outline-none focus:border-blush-deep"
          />
          <button
            type="button"
            onClick={() => apply({ minPrice: min || undefined, maxPrice: max || undefined })}
            className="rounded-card-sm bg-sky px-3 py-1.5 text-sm text-ink transition hover:bg-sky-deep"
          >
            确定
          </button>
        </label>
      </div>
    </div>
  );
}
