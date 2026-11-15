import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth';
import { getAidStatus } from '@/server/aid';
import {
  getMyStats,
  getMyItems,
  getMyFavorites,
  getMyPayout,
  getReceivedApplications,
  getMyApplications,
  getLetterAnonymous,
} from '@/server/me';
import {
  categoryLabel,
  ITEM_STATUS_LABEL,
  APPLICATION_STATUS_LABEL,
} from '@/lib/constants';
import ItemCard from '@/components/ItemCard';
import EmptyState from '@/components/ui/EmptyState';
import Badge, { type BadgeTone } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import ApplicationActions from '@/components/ApplicationActions';
import ItemWithdrawButton from '@/components/ItemWithdrawButton';
import LetterAnonymityToggle from '@/components/letters/LetterAnonymityToggle';
import PayoutSettings from '@/components/PayoutSettings';
import PaymentPanel from '@/components/PaymentPanel';
import type { ReceivedApplicationRow } from '@/server/me';

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

/** removed 有两种来源：主人自己撤回，或管理员违规下架——对主人来说含义不同 */
function statusLabel(i: { status: string; violation_flag: number }): string {
  if (i.status === 'removed') return i.violation_flag === 1 ? '违规下架' : '已撤回';
  return ITEM_STATUS_LABEL[i.status] ?? i.status;
}

function appBadge(status: string): string {
  if (status === 'pending') return 'bg-blush text-ink';
  if (status === 'approved') return 'bg-sky text-ink';
  return 'bg-panel text-ink-soft';
}
/**
 * 物主能做的动作。出售物品的交割动作要跟支付进度联动：
 * 买家还没声明转账 → 不给交割按钮，只留等待提示；
 * 买家已声明转账 → 交割按钮换成「确认收款并交割」。
 */
function receivedActions(
  a: ReceivedApplicationRow,
): { actions: string[]; labels?: Record<string, string>; note?: string } {
  if (a.status === 'pending') return { actions: ['approve', 'reject'] };
  if (a.status === 'approved') {
    if (a.item_mode === 'sale' && a.payment_status === 'pending') {
      return {
        actions: ['cancel'],
        note: '买家选好了支付方式但还没转账，交割要等对方完成支付',
      };
    }
    if (a.item_mode === 'sale' && a.payment_status === 'paid') {
      return { actions: ['complete', 'cancel'], labels: { complete: '确认收款并交割' } };
    }
    return { actions: ['complete', 'cancel'] };
  }
  return { actions: [] };
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
  const payout = getMyPayout(user.id);

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

      <AidCard status={getAidStatus(user.id)} />

      <PayoutSettings
        initialWechat={payout.wechat_qr}
        initialAlipay={payout.alipay_qr}
      />

      <LetterAnonymityToggle initial={getLetterAnonymous(user.id)} />

      <div className="flex gap-1 border-b border-line">
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

/**
 * 帮扶资格四态：0 未申请 / 1 已通过 / 2 审核中 / 3 已驳回。
 * 认定标准由学校掌握，平台只记录审核结果，所以文案只讲「资格」不给人贴标签。
 */
function aidView(status: number): {
  badge: string;
  tone: BadgeTone;
  desc: string;
  action: string;
  variant: 'primary' | 'secondary' | 'ghost';
} {
  if (status === 1) {
    return {
      badge: '已认证',
      tone: 'ok',
      desc: '公益捐赠物资优先向你开放，物主处理申领时会看到你的帮扶身份。',
      action: '查看详情',
      variant: 'ghost',
    };
  }
  if (status === 2) {
    return {
      badge: '审核中',
      tone: 'warn',
      desc: '申请已提交，管理员审核通过后即可享受公益物资优先。',
      action: '查看进度',
      variant: 'ghost',
    };
  }
  if (status === 3) {
    return {
      badge: '未通过',
      tone: 'danger',
      desc: '本次申请未通过，可以修改说明后重新提交。',
      action: '重新申请',
      variant: 'secondary',
    };
  }
  return {
    badge: '未申请',
    tone: 'neutral',
    desc: '家庭经济困难学生认定。通过后公益捐赠物资优先向你开放。',
    action: '去申请',
    variant: 'primary',
  };
}

function AidCard({ status }: { status: number }) {
  const v = aidView(status);
  return (
    <section className="flex flex-col gap-3 rounded-card-lg bg-panel p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-ink">帮扶资格认证</h2>
          <Badge tone={v.tone} size="sm">
            {v.badge}
          </Badge>
        </div>
        <p className="mt-1 text-sm leading-6 text-ink-soft">{v.desc}</p>
      </div>
      <ButtonLink href="/me/aid" variant={v.variant} size="sm" className="shrink-0">
        {v.action}
      </ButtonLink>
    </section>
  );
}

function PostedTab({ userId }: { userId: number }) {
  const items = getMyItems(userId);
  if (items.length === 0) {
    return <EmptyState title="还没有发布过物品" action={{ href: '/publish', label: '去发布' }} />;
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {items.map((i) => (
        <div
          key={i.id}
          className="flex flex-col overflow-hidden rounded-card bg-panel shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-lift"
        >
          {/* 卡片主体是链接，撤回按钮必须放在链接外面——否则点撤回会先跳到详情页 */}
          <Link
            href={`/items/${i.id}`}
            className={`group block ${i.status === 'removed' ? 'opacity-55' : ''}`}
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
                {statusLabel(i)}
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

          {/* 已交割不显示撤回（台账已写）；违规下架也不给按钮，恢复要走管理员复核 */}
          {i.status !== 'completed' && (
            <div className="mt-auto border-t border-line px-3 py-2">
              {i.violation_flag === 1 ? (
                <p className="py-1 text-center text-xs text-ink-soft">违规下架，需管理员复核</p>
              ) : (
                <ItemWithdrawButton itemId={i.id} status={i.status} size="sm" block />
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function FavTab({ userId }: { userId: number }) {
  const items = getMyFavorites(userId);
  if (items.length === 0) {
    return <EmptyState title="还没有收藏，去逛逛" action={{ href: '/', label: '去逛逛' }} />;
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
      {apps.map((a) => {
        const act = receivedActions(a);
        return (
          <div key={a.id} className="rounded-card-lg bg-panel p-4 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/items/${a.item_id}`} className="font-medium text-ink hover:underline">
                  {a.item_title}
                </Link>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                  <span>{a.applicant_nickname} 想申领</span>
                  {a.item_mode === 'donate' && a.applicant_aid === 1 && (
                    <Badge tone="blush" size="sm">
                      帮扶生优先
                    </Badge>
                  )}
                  {a.item_mode === 'sale' && a.item_price > 0 && <span>¥{a.item_price}</span>}
                  {a.status === 'approved' && a.payment_status === 'pending' && (
                    <Badge tone="warn" size="sm">
                      等待买家转账
                    </Badge>
                  )}
                  {a.status === 'approved' && a.payment_status === 'paid' && (
                    <Badge tone="ok" size="sm">
                      买家已转账
                    </Badge>
                  )}
                </p>
                {a.reason && <p className="mt-1 text-sm text-ink-soft">留言：{a.reason}</p>}
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${appBadge(a.status)}`}
              >
                {APPLICATION_STATUS_LABEL[a.status] ?? a.status}
              </span>
            </div>
            <div className="mt-3">
              {act.note && <p className="mb-2 text-xs text-ink-soft">{act.note}</p>}
              {act.actions.length > 0 && (
                <ApplicationActions applicationId={a.id} actions={act.actions} labels={act.labels} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AppliedTab({ userId }: { userId: number }) {
  const apps = getMyApplications(userId);
  if (apps.length === 0) {
    return <EmptyState title="还没有申领过物品" action={{ href: '/', label: '去逛逛' }} />;
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
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                <span>来自 {a.owner_nickname}</span>
                {a.item_mode === 'sale' && a.item_price > 0 && <span>¥{a.item_price}</span>}
                {a.status === 'approved' && a.payment_status === 'paid' && (
                  <Badge tone="ok" size="sm">
                    已转账，待卖家确认
                  </Badge>
                )}
              </p>
              {a.reason && <p className="mt-1 text-sm text-ink-soft">我的留言：{a.reason}</p>}
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${appBadge(a.status)}`}
            >
              {APPLICATION_STATUS_LABEL[a.status] ?? a.status}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ApplicationActions applicationId={a.id} actions={appliedActions(a.status)} />
            {a.status === 'approved' &&
              a.item_mode === 'sale' &&
              a.payment_status !== 'confirmed' && (
                <PaymentPanel
                  applicationId={a.id}
                  amount={a.item_price}
                  wechatQr={a.owner_wechat_qr}
                  alipayQr={a.owner_alipay_qr}
                  currentMethod={a.payment_method === 'wechat' || a.payment_method === 'alipay' ? a.payment_method : null}
                  currentStatus={a.payment_status}
                />
              )}
          </div>
        </div>
      ))}
    </div>
  );
}
