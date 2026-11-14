import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth';
import { getAidStatus } from '@/server/aid';
import AidApplyForm from '@/components/aid/AidApplyForm';

export default function AidPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-3xl flex-1 px-6 py-16 text-ink-soft">
          加载中…
        </div>
      }
    >
      <AidContent />
    </Suspense>
  );
}

async function AidContent() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/me/aid');
  const status = getAidStatus(user.id);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">帮扶资格申请</h1>

      {status === 1 ? (
        <div className="rounded-card-lg bg-blush/25 p-6 text-ink">
          你已通过帮扶资格审核，公益专区的捐赠物资将优先向你开放。
        </div>
      ) : status === 2 ? (
        <div className="rounded-card-lg bg-lilac/30 p-6 text-ink">
          你的申请正在审核中，请耐心等待管理员处理。
        </div>
      ) : (
        <>
          {status === 3 && (
            <p className="text-sm text-ink-soft">你的申请被驳回，可以修改后重新提交。</p>
          )}
          <AidApplyForm />
        </>
      )}
    </main>
  );
}
