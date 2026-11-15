import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth';
import { listAidApplications } from '@/server/aid';
import AidReviewButton from '@/components/aid/AidReviewButton';
import EmptyState from '@/components/ui/EmptyState';

const AID_STATUS_LABEL: Record<string, string> = {
  pending: '待处理',
  approved: '已通过',
  rejected: '已驳回',
};

export default function AdminAidPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-5xl flex-1 px-6 py-16 text-ink-soft">
          加载中…
        </div>
      }
    >
      <AdminAidContent />
    </Suspense>
  );
}

async function AdminAidContent() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/admin/aid');
  if (user.role !== 'admin') redirect('/');

  const apps = listAidApplications();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">帮扶资格审核</h1>

      {apps.length === 0 ? (
        <EmptyState title="暂无帮扶资格申请" />
      ) : (
        <div className="flex flex-col gap-3">
          {apps.map((a) => (
            <div key={a.id} className="rounded-card-lg bg-panel p-4 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-ink">
                    {a.nickname}
                    <span className="ml-2 text-xs text-ink-soft">@{a.username}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {[a.college, a.grade].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-panel px-2.5 py-0.5 text-xs text-ink-soft">
                  {AID_STATUS_LABEL[a.status] ?? a.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-ink">{a.reason}</p>
              {a.proof_note && (
                <p className="mt-1 text-xs text-ink-soft">补充：{a.proof_note}</p>
              )}
              {a.status === 'pending' && (
                <div className="mt-3">
                  <AidReviewButton applicationId={a.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
