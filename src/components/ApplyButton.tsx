'use client';

import { useState } from 'react';

export default function ApplyButton({
  itemId,
  mode,
  isOwner,
}: {
  itemId: number;
  mode: string;
  isOwner: boolean;
}) {
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(r: string) {
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch(`/api/items/${itemId}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: r }),
      });
      if (res.status === 401) {
        window.location.href = `/login?next=/items/${itemId}`;
        return;
      }
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setShowReason(false);
        setReason('');
        setMsg('已提交申请，等待对方处理');
      } else {
        setMsg(data?.message ?? '提交失败');
      }
    } catch {
      setMsg('网络异常，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  function onClick() {
    if (isOwner) {
      setMsg('不能申领自己的物品');
      return;
    }
    if (mode === 'donate') {
      setShowReason((v) => !v);
    } else {
      submit('');
    }
  }

  const label = mode === 'donate' ? '申请领取' : '我想要';

  return (
    <div className="flex flex-1 flex-col gap-2">
      {msg && <p className="text-sm text-ink-soft">{msg}</p>}

      {showReason && (
        <div className="flex flex-col gap-2 rounded-card-sm bg-cream/50 p-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink-soft">申请用途（捐赠物品必填）</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="说明用途，如：新生入学需要这套教材"
              className="rounded-card-sm border border-black/10 bg-panel px-2 py-1.5 text-sm outline-none focus:border-blush-deep"
            />
          </label>
          <button
            type="button"
            onClick={() => submit(reason.trim())}
            disabled={loading || !reason.trim()}
            className="rounded-card-sm bg-blush px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-blush-deep disabled:opacity-50"
          >
            {loading ? '提交中…' : '提交申请'}
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="rounded-card bg-blush py-3 text-sm font-medium text-ink transition hover:bg-blush-deep disabled:opacity-50"
      >
        {loading ? '提交中…' : label}
      </button>
    </div>
  );
}
