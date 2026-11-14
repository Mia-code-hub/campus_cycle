'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export default function AidApplyForm() {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [proofNote, setProofNote] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/aid/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, proofNote }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        router.refresh();
        return;
      }
      setError(data?.message ?? '提交失败');
    } catch {
      setError('网络异常，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-card-lg bg-panel p-6 shadow-soft">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-ink-soft">申请说明（至少 20 字）</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          maxLength={500}
          placeholder="简要说明你的实际困难，便于管理员审核…"
          className="rounded-card-sm border border-black/10 bg-cream/50 px-3 py-2 text-sm outline-none focus:border-blush-deep"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-ink-soft">补充说明（选填）</span>
        <textarea
          value={proofNote}
          onChange={(e) => setProofNote(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Demo 不要求上传真实证件，可简单说明"
          className="rounded-card-sm border border-black/10 bg-cream/50 px-3 py-2 text-sm outline-none focus:border-blush-deep"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading || reason.trim().length < 20}
        className="rounded-card bg-blush py-2.5 text-sm font-medium text-ink transition hover:bg-blush-deep disabled:opacity-50"
      >
        {loading ? '提交中…' : '提交申请'}
      </button>
    </form>
  );
}
