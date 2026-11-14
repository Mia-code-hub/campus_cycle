import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth';
import PublishForm from '@/components/publish/PublishForm';

export default function PublishPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-5xl flex-1 px-6 py-16 text-ink-soft">
          加载中…
        </div>
      }
    >
      <PublishGate />
    </Suspense>
  );
}

async function PublishGate() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/publish');
  return <PublishForm />;
}
