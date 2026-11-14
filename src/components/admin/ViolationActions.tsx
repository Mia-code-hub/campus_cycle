'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function ViolationActions({
  itemId,
  flag,
}: {
  itemId: number;
  /** 1=已下架，2=待复核 */
  flag: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');

  async function act(action: 'remove' | 'restore') {
    if (loading) return;
    setLoading(action);
    setError('');
    try {
      const res = await fetch(`/api/admin/violations/${itemId}`, {
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
    <div className="flex flex-wrap items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      {flag !== 1 && (
        <button
          type="button"
          onClick={() => act('remove')}
          disabled={!!loading}
          className="rounded-card-sm bg-red-500/90 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
        >
          {loading === 'remove' ? '处理中…' : '人工下架'}
        </button>
      )}
      <button
        type="button"
        onClick={() => act('restore')}
        disabled={!!loading}
        className="rounded-card-sm bg-panel px-3 py-1.5 text-sm text-ink transition hover:bg-cream disabled:opacity-50"
      >
        {loading === 'restore' ? '处理中…' : flag === 1 ? '恢复上架' : '确认合规，解除标记'}
      </button>
    </div>
  );
}
