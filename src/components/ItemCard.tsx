import Link from 'next/link';
import { categoryLabel, modeLabel } from '@/lib/constants';
import type { ItemSummary } from '@/server/items';
import Badge from '@/components/ui/Badge';

export default function ItemCard({
  item,
  matchPercent,
}: {
  item: ItemSummary;
  /** 语义检索结果传入 0-1 的相似度，右上角显示百分比并让位给匹配度 */
  matchPercent?: number | null;
}) {
  const isDonate = item.mode === 'donate';
  const hasMatch = typeof matchPercent === 'number' && Number.isFinite(matchPercent);

  return (
    // 整张卡只保留一个可聚焦元素（链接）。之前里面还套了个没有事件的「收藏」按钮，
    // 既是嵌套交互元素（读屏会念出两个控件），又点了没反应，属于假按钮，已删除。
    <Link
      href={`/items/${item.id}`}
      aria-label={`${item.title}，${modeLabel(item.mode)}，${isDonate ? '免费' : `¥${item.price}`}`}
      className="group block overflow-hidden rounded-card bg-panel shadow-soft ring-1 ring-line transition duration-200 hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-sunken">
        {item.image_path ? (
          <img
            src={item.image_path}
            alt={`${item.title} 的实物照片`}
            loading="lazy"
            className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-ink-soft">
            暂无图片
          </div>
        )}

        <Badge
          tone={isDonate ? 'blush' : 'sky'}
          size="md"
          className="absolute left-2 top-2 shadow-soft"
        >
          {modeLabel(item.mode)}
        </Badge>

        {hasMatch && (
          <span className="absolute right-2 top-2 rounded-full bg-ink/75 px-2 py-0.5 text-[11px] font-medium text-raise">
            {Math.round((matchPercent as number) * 100)}% 匹配
          </span>
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
