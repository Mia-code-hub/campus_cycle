import Link from 'next/link';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth';
import { listViolationItems, rescanItem } from '@/server/moderation';
import { categoryLabel, modeLabel } from '@/lib/constants';
import ViolationActions from '@/components/admin/ViolationActions';
import EmptyState from '@/components/EmptyState';

export const instant = false;

const FLAG_META: Record<number, { text: string; cls: string }> = {
  1: { text: '已下架', cls: 'bg-red-100 text-red-700' },
  2: { text: '待复核', cls: 'bg-amber-100 text-amber-800' },
};

export default function AdminViolationsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-5xl flex-1 px-6 py-16 text-ink-soft">
          加载中…
        </div>
      }
    >
      <AdminViolationsContent />
    </Suspense>
  );
}

async function AdminViolationsContent() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/admin/violations');
  if (user.role !== 'admin') redirect('/');

  const rows = listViolationItems();
  const pending = rows.filter((r) => r.violation_flag === 2).length;
  const removed = rows.filter((r) => r.violation_flag === 1).length;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">违规复核队列</h1>
          <p className="mt-1 text-sm text-ink-soft">
            待复核 {pending} 件 · 已下架 {removed} 件
            {pending > 0 && '（AI 审核不可用时会先放行并进入这里，请优先处理）'}
          </p>
        </div>
        <Link
          href="/admin/aid"
          className="rounded-card-sm bg-panel px-3 py-1.5 text-sm text-ink transition hover:bg-cream"
        >
          帮扶资格审核 →
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="复核队列是空的，目前没有需要人工处理的物品" />
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row) => {
            const meta = FLAG_META[row.violation_flag] ?? {
              text: `标记 ${row.violation_flag}`,
              cls: 'bg-panel text-ink-soft',
            };
            const hits = rescanItem(row);
            return (
              <div key={row.id} className="rounded-card-lg bg-panel p-4 shadow-soft">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-card-sm bg-cream">
                    {row.image_path ? (
                      <img
                        src={row.image_path}
                        alt={row.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-ink-soft">
                        无图
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}>
                        {meta.text}
                      </span>
                      <Link
                        href={`/items/${row.id}`}
                        className="truncate font-medium text-ink hover:underline"
                      >
                        {row.title}
                      </Link>
                    </div>

                    <p className="mt-1 text-xs text-ink-soft">
                      {row.owner_nickname}（@{row.owner_username}）· {categoryLabel(row.category)} ·{' '}
                      {modeLabel(row.mode)}
                      {row.mode === 'sale' ? ` ¥${row.price}` : ''} · 发布 {row.created_at} · #
                      {row.id}
                    </p>

                    <p className="mt-2 break-words rounded-card-sm bg-cream/70 px-3 py-2 text-sm text-ink">
                      <span className="text-ink-soft">审核依据：</span>
                      {row.violation_reason ?? '（未记录）'}
                    </p>

                    {(row.raw_desc || row.ai_desc) && (
                      <p className="mt-1 line-clamp-2 text-xs text-ink-soft">
                        物品描述：{row.raw_desc || row.ai_desc}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-ink-soft">本地词表实时扫描：</span>
                      {hits.length === 0 ? (
                        <span className="text-xs text-ink-soft">无命中</span>
                      ) : (
                        hits.map((h) => (
                          <span
                            key={h.term}
                            className="rounded-full bg-blush/30 px-2 py-0.5 text-[11px] text-ink"
                            title={h.hint}
                          >
                            {h.term}（{h.label}）
                          </span>
                        ))
                      )}
                    </div>

                    <div className="mt-3">
                      <ViolationActions itemId={row.id} flag={row.violation_flag} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
