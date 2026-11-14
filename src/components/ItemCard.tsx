import Link from 'next/link';
import { categoryLabel, modeLabel } from '@/lib/constants';
import type { ItemSummary } from '@/server/items';

export default function ItemCard({
  item,
  matchPercent,
}: {
  item: ItemSummary;
  /** 语义检索结果传入 0-1 的相似度，右上角显示百分比并让位给匹配度（搜索场景不显示收藏） */
  matchPercent?: number | null;
}) {
  const isDonate = item.mode === 'donate';
  const hasMatch = typeof matchPercent === 'number' && Number.isFinite(matchPercent);

  return (
    <Link
      href={`/items/${item.id}`}
      className="group block overflow-hidden rounded-card bg-panel shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-cream/70">
        {item.image_path ? (
          <img
            src={item.image_path}
            alt={item.title}
            className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-ink-soft">
            暂无图片
          </div>
        )}

        <span
          className={`absolute left-2 top-2 rounded-full px-2.5 py-0.5 text-xs font-medium text-ink ${
            isDonate ? 'bg-blush' : 'bg-sky'
          }`}
        >
          {modeLabel(item.mode)}
        </span>

        {hasMatch ? (
          <span className="absolute right-2 top-2 rounded-full bg-ink/75 px-2 py-0.5 text-[11px] font-medium text-white">
            {Math.round((matchPercent as number) * 100)}% 匹配
          </span>
        ) : (
          <button
            type="button"
            aria-label="收藏"
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-ink-soft transition hover:text-blush-deep"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        )}
      </div>

      <div className="p-3">
        <h3 className="line-clamp-1 text-sm font-medium text-ink">{item.title}</h3>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-base font-semibold text-ink">
            {isDonate ? '免费' : `¥${item.price}`}
          </span>
          <span className="text-xs text-ink-soft">
            {categoryLabel(item.category)}
            {item.condition_level ? ` · ${item.condition_level}` : ''}
          </span>
        </div>
      </div>
    </Link>
  );
}
