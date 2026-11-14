'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// 模板兜底信件的「升级」入口：再请一次模型，成功后原地更新同一封信（不新增行）
export default function LetterUpgradeButton({ donationId }: { donationId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  async function upgrade() {
    if (busy) return;
    setBusy(true);
    setNotice('');
    try {
      const res = await fetch('/api/ai/letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ donationId, retryTemplate: true }),
      });
      const data = await res.json().catch(() => null);
      if (!data?.ok) {
        setNotice(data?.message ?? 'AI 仍然不可用，请稍后再试');
        return;
      }
      if (data.letter?.source === 'ai') {
        router.refresh();
        return;
      }
      setNotice('AI 仍然不可用，请稍后再试');
    } catch {
      setNotice('网络异常，请稍后再试');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={upgrade}
        disabled={busy}
        className={`rounded-card border border-black/10 bg-panel px-3 py-1.5 text-sm transition hover:bg-cream ${
          busy ? 'cursor-wait text-ink-soft' : 'text-ink'
        }`}
      >
        {busy ? '正在重新生成…' : '升级为 AI 版本'}
      </button>
      {notice && <span className="text-xs text-ink-soft">{notice}</span>}
    </div>
  );
}
