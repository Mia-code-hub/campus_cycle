'use client';

import { useState } from 'react';

// 受赠人署名偏好：默认匿名。改成「显示昵称」后，之后生成的感谢信才会署昵称，
// 已经发出的信不会追溯修改（历史信件保持当时的署名口径）。
export default function LetterAnonymityToggle({ initial }: { initial: boolean }) {
  const [anonymous, setAnonymous] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function toggle() {
    if (busy) return;
    const next = !anonymous;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/me/anonymity', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymous: next }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.message ?? '保存失败');
        return;
      }
      setAnonymous(next);
    } catch {
      setError('网络异常，请稍后再试');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-card-lg bg-panel px-4 py-3 shadow-soft">
      <div className="min-w-0">
        <p className="text-sm font-medium">感谢信署名</p>
        <p className="mt-0.5 text-xs leading-5 text-ink-soft">
          你收到捐赠后，平台会替捐赠人写一封感谢信。默认匿名，不公开你的昵称、学院与年级。
        </p>
        {error && <p className="mt-1 text-xs text-blush-deep">{error}</p>}
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={!anonymous}
        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
          busy
            ? 'cursor-wait bg-panel text-ink-soft'
            : anonymous
              ? 'bg-panel text-ink-soft hover:bg-cream'
              : 'bg-lilac/50 text-ink hover:bg-lilac/70'
        }`}
      >
        {busy ? '保存中…' : anonymous ? '当前：匿名' : '当前：显示昵称'}
      </button>
    </div>
  );
}
