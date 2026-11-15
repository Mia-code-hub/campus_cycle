'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORIES, CONDITIONS } from '@/lib/constants';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { cn } from '@/lib/ui/cn';

interface Props {
  category: string;
  mode: string;
  condition: string;
  minPrice: string;
  maxPrice: string;
}

/* 筛选芯片：选中态用品牌粉，未选中给浅底。aria-pressed 让读屏也知道「选没选」 */
function chipClass(active: boolean): string {
  return cn(
    'rounded-full px-4 py-1.5 text-sm transition',
    active ? 'bg-blush font-medium text-ink' : 'bg-sunken text-ink-soft hover:bg-line hover:text-ink',
  );
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
    <Card padding="md" className="flex flex-col gap-3" aria-label="筛选条件">
      <div role="group" aria-label="按类别筛选" className="flex flex-wrap items-center gap-2">
        <span className="mr-1 w-8 text-xs text-ink-soft">类别</span>
        <button
          type="button"
          onClick={() => apply({ category: undefined })}
          aria-pressed={!category}
          className={chipClass(!category)}
        >
          全部
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => toggle('category', c.value, category)}
            aria-pressed={category === c.value}
            className={chipClass(category === c.value)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div role="group" aria-label="按流转方式筛选" className="flex flex-wrap items-center gap-2">
        <span className="mr-1 w-8 text-xs text-ink-soft">方式</span>
        <button
          type="button"
          onClick={() => apply({ mode: undefined })}
          aria-pressed={!mode}
          className={chipClass(!mode)}
        >
          全部
        </button>
        <button
          type="button"
          onClick={() => toggle('mode', 'sale', mode)}
          aria-pressed={mode === 'sale'}
          className={chipClass(mode === 'sale')}
        >
          低价转售
        </button>
        <button
          type="button"
          onClick={() => toggle('mode', 'donate', mode)}
          aria-pressed={mode === 'donate'}
          className={chipClass(mode === 'donate')}
        >
          公益捐赠
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Select
          label="成色"
          value={condition}
          onChange={(e) => apply({ condition: e.target.value || undefined })}
          wrapperClassName="w-28"
        >
          <option value="">全部</option>
          {CONDITIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>

        <div className="flex items-end gap-2">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            aria-label="最低价格"
            placeholder="最低"
            className="w-20 px-2 py-1.5"
          />
          <span className="pb-2 text-xs text-ink-soft" aria-hidden="true">
            –
          </span>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            aria-label="最高价格"
            placeholder="最高"
            className="w-20 px-2 py-1.5"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => apply({ minPrice: min || undefined, maxPrice: max || undefined })}
          >
            确定
          </Button>
        </div>
      </div>
    </Card>
  );
}
