import { Suspense } from 'react';
import { getCurrentUser } from '@/server/auth';
import { listItems } from '@/server/items';
import { donateBoost } from '@/server/donate-boost';
import ItemCard from '@/components/ItemCard';
import EmptyState from '@/components/ui/EmptyState';

export default function DonatePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-5xl flex-1 px-6 py-16 text-ink-soft">
          加载中…
        </div>
      }
    >
      <DonateContent />
    </Suspense>
  );
}

async function DonateContent() {
  const viewer = await getCurrentUser();
  const boost = viewer ? donateBoost(viewer.id) : 0;
  const { items } = listItems({ mode: 'donate', pageSize: 100 });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">公益专区</h1>
        <p className="text-sm text-ink-soft">
          毕业季带不走的物资，免费流转给需要的新生，让好物继续被使用。
        </p>
      </header>

      {boost > 0 && (
        <div className="rounded-card-lg bg-blush/25 px-5 py-3 text-sm font-medium text-ink">
          你已通过帮扶资格审核，这些物资优先向你开放
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState title="暂时没有可捐赠的物资" action={{ href: '/', label: '去逛逛' }} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {items.map((i) => (
            <ItemCard key={i.id} item={i} />
          ))}
        </div>
      )}
    </main>
  );
}
