'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const ACTION_LABEL: Record<string, string> = {
  approve: '同意',
  reject: '拒绝',
  complete: '标记完成',
  cancel: '取消',
};

const ACTION_CLASS: Record<string, string> = {
  approve: 'bg-blush text-ink hover:bg-blush-deep',
  reject: 'bg-panel text-ink hover:bg-cream',
  complete: 'bg-sky text-ink hover:bg-sky-deep',
  cancel: 'bg-panel text-ink hover:bg-cream',
};

export default function ApplicationActions({
  applicationId,
  actions,
}: {
  applicationId: number;
  actions: string[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');

  async function act(action: string) {
    if (loading) return;
    setLoading(action);
    setError('');
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: 'PATCH',
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
      {actions.map((a) => (
        <button
          key={a}
          type="button"
          onClick={() => act(a)}
          disabled={!!loading}
          className={`rounded-card-sm px-3 py-1.5 text-sm transition disabled:opacity-50 ${
            ACTION_CLASS[a] ?? 'bg-panel text-ink'
          }`}
        >
          {loading === a ? '处理中…' : ACTION_LABEL[a] ?? a}
        </button>
      ))}
    </div>
  );
}
