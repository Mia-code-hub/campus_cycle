import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth';
import {
  getMyStats,
  getMyItems,
  getMyFavorites,
  getReceivedApplications,
  getMyApplications,
} from '@/server/me';
import {
  categoryLabel,
  ITEM_STATUS_LABEL,
  APPLICATION_STATUS_LABEL,
} from '@/lib/constants';
import ItemCard from '@/components/ItemCard';
import EmptyState from '@/components/EmptyState';
import ApplicationActions from '@/components/ApplicationActions';

const TABS = [
  { key: 'posted', label: '我的发布' },
  { key: 'fav', label: '我的收藏' },
  { key: 'received', label: '我收到的申领' },
  { key: 'applied', label: '我的申领' },
];

function itemBadge(status: string): string {
  if (status === 'listed') return 'bg-sky text-ink';
  if (status === 'reserved') return 'bg-lilac text-ink';
  return 'bg-panel text-ink-soft';
}
function appBadge(status: string): string {
  if (status === 'pending') return 'bg-blush text-ink';
  if (status === 'approved') return 'bg-sky text-ink';
  return 'bg-panel text-ink-soft';
}
function receivedActions(status: string): string[] {
  if (status === 'pending') return ['approve', 'reject'];
  if (status === 'approved') return ['complete', 'cancel'];
  return [];
}
function appliedActions(status: string): string[] {
  return status === 'pending' || status === 'approved' ? ['cancel'] : [];
}

export default function MePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-5xl flex-1 px-6 py-16 text-ink-soft">
          加载中…
        </div>
      }
    >
      <MeContent searchParams={searchParams} />
    </Suspense>
  );
}

async function MeContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/me');
  const sp = await searchParams;
  const rawTab = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const tab = TABS.some((t) => t.key === rawTab) ? (rawTab as string) : 'posted';

  const stats = getMyStats(user.id);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">个人中心</h1>
        <Link href="/me/donations" className="text-sm text-ink-soft transition hover:text-ink">
          捐赠台账 →
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="我发布的" value={stats.posted} />
        <StatCard label="我捐出的" value={stats.donated} />
        <StatCard label="我收到的" value={stats.received} />
      </div>

      <div className="flex gap-1 border-b border-black/5">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/me?tab=${t.key}`}
            className={`px-4 py-2 text-sm transition ${
              tab === t.key
                ? 'border-b-2 border-blush font-medium text-ink'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === 'posted' && <PostedTab userId={user.id} />}
      {tab === 'fav' && <FavTab userId={user.id} />}
      {tab === 'received' && <ReceivedTab userId={user.id} />}
      {tab === 'applied' && <AppliedTab userId={user.id} />}
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card-lg bg-panel p-5 text-center shadow-soft">
      <p className="text-3xl font-semibold text-ink">{value}</p>
      <p className="mt-1 text-sm text-ink-soft">{label}</p>
    </div>
  );
}

function PostedTab({ userId }: { userId: number }) {
  const items = getMyItems(userId);
  if (items.length === 0) {
    return <EmptyState title="还没有发布过物品" actionHref="/publish" actionLabel="去发布" />;
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {items.map((i) => (
        <Link
          key={i.id}
          href={`/items/${i.id}`}
          className="group block overflow-hidden rounded-card bg-panel shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-lift"
        >
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-cream/70">
            {i.image_path ? (
              <img src={i.image_path} alt={i.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-ink-soft">
                暂无图片
              </div>
            )}
            <span
              className={`absolute left-2 top-2 rounded-full px-2.5 py-0.5 text-xs font-medium ${itemBadge(i.status)}`}
            >
              {ITEM_STATUS_LABEL[i.status] ?? i.status}
            </span>
          </div>
          <div className="p-3">
            <h3 className="line-clamp-1 text-sm font-medium text-ink">{i.title}</h3>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-base font-semibold text-ink">
                {i.mode === 'donate' ? '免费' : `¥${i.price}`}
              </span>
              <span className="text-xs text-ink-soft">{categoryLabel(i.category)}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function FavTab({ userId }: { userId: number }) {
  const items = getMyFavorites(userId);
  if (items.length === 0) {
    return <EmptyState title="还没有收藏，去逛逛" actionHref="/" actionLabel="去逛逛" />;
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {items.map((i) => (
        <ItemCard key={i.id} item={i} />
      ))}
    </div>
  );
}

function ReceivedTab({ userId }: { userId: number }) {
  const apps = getReceivedApplications(userId);
  if (apps.length === 0) return <EmptyState title="还没有收到申领" />;
  return (
    <div className="flex flex-col gap-3">
      {apps.map((a) => (
        <div key={a.id} className="rounded-card-lg bg-panel p-4 shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link href={`/items/${a.item_id}`} className="font-medium text-ink hover:underline">
                {a.item_title}
              </Link>
              <p className="mt-1 text-sm text-ink-soft">{a.applicant_nickname} 想申领</p>
              {a.reason && <p className="mt-1 text-sm text-ink-soft">留言：{a.reason}</p>}
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${appBadge(a.status)}`}
            >
              {APPLICATION_STATUS_LABEL[a.status] ?? a.status}
            </span>
          </div>
          <div className="mt-3">
            <ApplicationActions applicationId={a.id} actions={receivedActions(a.status)} />
          </div>
        </div>
      ))}
    </div>
  );
}

function AppliedTab({ userId }: { userId: number }) {
  const apps = getMyApplications(userId);
  if (apps.length === 0) {
    return <EmptyState title="还没有申领过物品" actionHref="/" actionLabel="去逛逛" />;
  }
  return (
    <div className="flex flex-col gap-3">
      {apps.map((a) => (
        <div key={a.id} className="rounded-card-lg bg-panel p-4 shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link href={`/items/${a.item_id}`} className="font-medium text-ink hover:underline">
                {a.item_title}
              </Link>
              <p className="mt-1 text-sm text-ink-soft">来自 {a.owner_nickname}</p>
              {a.reason && <p className="mt-1 text-sm text-ink-soft">我的留言：{a.reason}</p>}
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${appBadge(a.status)}`}
            >
              {APPLICATION_STATUS_LABEL[a.status] ?? a.status}
            </span>
          </div>
          <div className="mt-3">
            <ApplicationActions applicationId={a.id} actions={appliedActions(a.status)} />
          </div>
        </div>
      ))}
    </div>
  );
}
