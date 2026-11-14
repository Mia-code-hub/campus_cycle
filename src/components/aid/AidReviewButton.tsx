'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function AidReviewButton({ applicationId }: { applicationId: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');

  async function act(action: 'approve' | 'reject') {
    if (loading) return;
    setLoading(action);
    setError('');
    try {
      const res = await fetch(`/api/admin/aid/${applicationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => null);
      setError(data?.message ?? '操作失败');
    } catch {
      setError('网络异常，请稍后重试');
    } finally {
      setLoading('');
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        type="button"
        onClick={() => act('approve')}
        disabled={!!loading}
        className="rounded-card-sm bg-blush px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-blush-deep disabled:opacity-50"
      >
        {loading === 'approve' ? '处理中…' : '通过'}
      </button>
      <button
        type="button"
        onClick={() => act('reject')}
        disabled={!!loading}
        className="rounded-card-sm bg-panel px-3 py-1.5 text-sm text-ink transition hover:bg-cream disabled:opacity-50"
      >
        {loading === 'reject' ? '处理中…' : '驳回'}
      </button>
    </div>
  );
}
