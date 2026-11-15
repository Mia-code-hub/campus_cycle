import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/server/auth';
import { getItemDetail, isFavorited } from '@/server/items';
import { getConversationPeer } from '@/server/messages';
import { categoryLabel, modeLabel } from '@/lib/constants';
import FavoriteButton from '@/components/FavoriteButton';
import ApplyButton from '@/components/ApplyButton';
import MessageDrawer from '@/components/MessageDrawer';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';

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

  // 已下架（violation_flag=1）的东西对外就是不存在。
  // 列表和搜索都过滤了它，详情页如果只按 id 查就会变成一条「下架了还能看」的捷径——
  // 违规内容照样在传播，只是从列表里消失了。本人和管理员仍然能看，用来申诉与复核。
  if (item.violation_flag === 1 && !isOwner && user?.role !== 'admin') notFound();

  const peerId = user ? getConversationPeer(item.id, user.id) : null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
      <Link href="/" className="w-fit text-sm text-ink-soft transition hover:text-ink">
        ← 返回列表
      </Link>

      {/* 审核状态只给本人和管理员看，其他同学看到的仍是一件正常物品 */}
      {item.violation_flag === 2 && (isOwner || user?.role === 'admin') && (
        <Alert tone="warn" title="待人工复核">
          AI 审核本轮未能给出结论，物品已正常上架，管理员会尽快复核。
          {item.violation_reason && (
            <p className="mt-1 break-all text-xs text-warn/80">{item.violation_reason}</p>
          )}
        </Alert>
      )}
      {item.violation_flag === 1 && (isOwner || user?.role === 'admin') && (
        <Alert tone="danger" title="已下架">
          该物品经人工复核判定不符合平台规则，已从列表与搜索中移除。
          {item.violation_reason && (
            <p className="mt-1 break-all text-xs text-danger/80">{item.violation_reason}</p>
          )}
        </Alert>
      )}

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
            <Badge tone={isDonate ? 'blush' : 'sky'}>{modeLabel(item.mode)}</Badge>
            <Badge tone="neutral">{categoryLabel(item.category)}</Badge>
            {item.condition_level && <Badge tone="neutral">{item.condition_level}</Badge>}
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

          <div className="mt-auto border-t border-line pt-4 text-sm text-ink-soft">
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
