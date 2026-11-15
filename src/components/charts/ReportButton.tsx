'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Phase = 'idle' | 'loading' | 'error';

/**
 * 看板底部的「一键生成环保报告」。
 * 服务端会把统计快照喂给模型、再逐字校验数字；校验不过也返回 id，
 * 这里照常跳转到报告页——报告页会明确写出「未通过校验，正文不展示」。
 * 把失败也展示出来，比藏起来更接近「可审计」。
 */
export default function ReportButton({ label = '一键生成环保报告' }: { label?: string }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState('');
  const router = useRouter();

  async function onClick() {
    setPhase('loading');
    setMessage('');
    try {
      const res = await fetch('/api/ai/report', { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as {
        id?: number;
        message?: string;
        verified?: boolean;
      };
      if (res.ok && data.id) {
        router.push(`/admin/report?id=${data.id}`);
        return;
      }
      setPhase('error');
      setMessage(data.message ?? '报告生成暂不可用，可先打印看板作为数据快照。');
    } catch {
      setPhase('error');
      setMessage('网络异常，报告没有生成，可先打印看板作为数据快照。');
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={phase === 'loading'}
        className="rounded-card-sm bg-blush px-4 py-2 text-sm font-medium text-ink shadow-soft transition hover:bg-blush-deep disabled:cursor-wait disabled:opacity-70 print:hidden"
      >
        {phase === 'loading' ? '正在生成…' : label}
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-card-sm px-3 py-2 text-sm text-ink-soft transition hover:bg-cream hover:text-ink print:hidden"
      >
        打印本页
      </button>
      {phase === 'error' && <span className="text-xs text-ink-soft">{message}</span>}
    </div>
  );
}
