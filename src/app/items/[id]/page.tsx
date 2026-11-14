import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/server/auth';
import { getItemDetail, isFavorited } from '@/server/items';
import { getConversationPeer } from '@/server/messages';
import { categoryLabel, modeLabel } from '@/lib/constants';
import FavoriteButton from '@/components/FavoriteButton';
import ApplyButton from '@/components/ApplyButton';
import MessageDrawer from '@/components/MessageDrawer';

export const instant = false;

function parseTags(s: string | null): string[] {
  if (!s) return [];
  try {
    const arr = JSON.parse(s);
    return Array.isArray(arr) ? arr.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const idNum = Number(id);
  const item = Number.isSafeInteger(idNum) && idNum > 0 ? getItemDetail(idNum) : null;
  if (!item) notFound();

  const desc = item.ai_desc || item.raw_desc || '';
  const tags = parseTags(item.ai_tags);
  const isDonate = item.mode === 'donate';
  const user = await getCurrentUser();
  const favorited = user ? isFavorited(user.id, item.id) : false;
  const isOwner = user ? user.id === item.owner_id : false;
  const peerId = user ? getConversationPeer(item.id, user.id) : null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
      <Link href="/" className="w-fit text-sm text-ink-soft transition hover:text-ink">
        ← 返回列表
      </Link>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-card-lg bg-panel shadow-soft">
          {item.image_path ? (
            <img
              src={item.image_path}
              alt={item.title}
              className="aspect-[4/3] w-full object-cover"
            />
          ) : (
            <div className="flex aspect-[4/3] w-full items-center justify-center text-ink-soft">
              暂无图片
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 rounded-card-lg bg-panel p-6 shadow-soft">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium text-ink ${
                isDonate ? 'bg-blush' : 'bg-sky'
              }`}
            >
              {modeLabel(item.mode)}
            </span>
            <span className="rounded-full bg-panel px-2.5 py-0.5 text-xs text-ink-soft">
              {categoryLabel(item.category)}
            </span>
            {item.condition_level && (
              <span className="rounded-full bg-panel px-2.5 py-0.5 text-xs text-ink-soft">
                {item.condition_level}
              </span>
            )}
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">{item.title}</h1>
          <p className="text-3xl font-semibold text-ink">{isDonate ? '免费' : `¥${item.price}`}</p>

          {isDonate && item.donate_tag && (
            <p className="w-fit rounded-full bg-blush/30 px-3 py-1 text-xs text-ink">
              {item.donate_tag}
            </p>
          )}

          {desc && <p className="text-sm leading-7 text-ink-soft">{desc}</p>}

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <span key={t} className="rounded-full bg-lilac/30 px-2.5 py-0.5 text-xs text-ink">
                  {t}
                </span>
              ))}
            </div>
          )}

          <div className="mt-auto border-t border-black/5 pt-4 text-sm text-ink-soft">
            发起人：{item.owner_nickname}
            {item.owner_college ? ` · ${item.owner_college}` : ''}
            <span className="ml-3">{item.view_count} 次浏览</span>
          </div>

          <div className="flex gap-3">
            <ApplyButton itemId={item.id} mode={item.mode} isOwner={isOwner} />
            <FavoriteButton itemId={item.id} initialFavorited={favorited} />
          </div>

          {peerId != null && <MessageDrawer itemId={item.id} />}
        </div>
      </div>
    </main>
  );
}
