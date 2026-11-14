'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// 台账里的「查看感谢信」：已有信直接跳；没有就现生成（服务端幂等，重复点只会返回同一封）
export default function DonationLetterButton({
  donationId,
  letterId,
}: {
  donationId: number;
  letterId: number | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  if (letterId) {
    return (
      <Link
        href={`/letters/${letterId}`}
        className="inline-block rounded-card-sm bg-lilac/40 px-3 py-1.5 text-sm text-ink transition hover:bg-lilac/70"
      >
        查看感谢信
      </Link>
    );
  }

  async function generate() {
    if (busy) return;
    setBusy(true);
    setNotice('');
    try {
      const res = await fetch('/api/ai/letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ donationId }),
      });
      const data = await res.json().catch(() => null);
      if (!data?.ok || !data?.letter?.id) {
        setNotice(data?.message ?? '生成失败，请稍后重试');
        return;
      }
      router.push(`/letters/${data.letter.id}`);
    } catch {
      setNotice('网络异常，请稍后再试');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={generate}
        disabled={busy}
        className={`rounded-card-sm px-3 py-1.5 text-sm transition ${
          busy
            ? 'cursor-wait bg-lilac/30 text-ink-soft'
            : 'bg-lilac/40 text-ink hover:bg-lilac/70'
        }`}
      >
        {busy ? '正在生成…' : '生成感谢信'}
      </button>
      {notice && <span className="text-xs text-ink-soft">{notice}</span>}
    </div>
  );
}
