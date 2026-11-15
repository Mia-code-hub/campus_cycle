import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth';
import { getMyDonations } from '@/server/me';
import { categoryLabel } from '@/lib/constants';
import EmptyState from '@/components/ui/EmptyState';
import DonationLetterButton from '@/components/letters/DonationLetterButton';

export default function DonationsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-5xl flex-1 px-6 py-16 text-ink-soft">
          加载中…
        </div>
      }
    >
      <DonationsContent />
    </Suspense>
  );
}

async function DonationsContent() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/me/donations');

  const donations = getMyDonations(user.id);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">捐赠台账</h1>
        <Link href="/me" className="text-sm text-ink-soft transition hover:text-ink">
          ← 返回个人中心
        </Link>
      </div>

      {donations.length === 0 ? (
        <EmptyState title="还没有捐赠记录" />
      ) : (
        <div className="overflow-x-auto rounded-card-lg bg-panel shadow-soft">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-soft">
                <th className="px-4 py-3 font-medium">日期</th>
                <th className="px-4 py-3 font-medium">物品</th>
                <th className="px-4 py-3 font-medium">类别</th>
                <th className="px-4 py-3 font-medium">受赠人</th>
                <th className="px-4 py-3 font-medium">折算重量</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {donations.map((d) => (
                <tr key={d.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 text-ink-soft">{d.donated_at.slice(0, 10)}</td>
                  <td className="px-4 py-3">{d.item_title}</td>
                  <td className="px-4 py-3">{categoryLabel(d.category)}</td>
                  <td className="px-4 py-3">
                    {d.receiver_anonymous === 1 ? '一位受益于你的同学' : d.receiver_nickname}
                  </td>
                  <td className="px-4 py-3">{d.green_weight_kg} kg</td>
                  <td className="px-4 py-3">
                    <DonationLetterButton donationId={d.id} letterId={d.letter_id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
