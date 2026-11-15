'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Phase = 'idle' | 'loading' | 'error';

/**
 * 看板底部的「一键生成环保报告」。
 * 报告生成接口在 R18 接入；这里先把交互与失败兜底写好：
 * 接口没就绪时给出可读提示并引导「打印本页」，不会点了没反应，也不会跳到空页面。
 */
export default function ReportButton() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState('');
  const router = useRouter();

  async function onClick() {
    setPhase('loading');
    setMessage('');
    try {
      const res = await fetch('/api/ai/report', { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { id?: number; message?: string };
      if (res.ok && data.id) {
        router.push(`/admin/report?id=${data.id}`);
        return;
      }
      setPhase('error');
      setMessage(data.message ?? '报告生成暂不可用，可先打印本页作为数据快照。');
    } catch {
      setPhase('error');
      setMessage('网络异常，报告没有生成，可先打印本页作为数据快照。');
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={phase === 'loading'}
        className="rounded-card-sm bg-blush px-4 py-2 text-sm font-medium text-ink shadow-soft transition hover:bg-blush-deep disabled:cursor-wait disabled:opacity-70"
      >
        {phase === 'loading' ? '正在生成…' : '一键生成环保报告'}
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-card-sm px-3 py-2 text-sm text-ink-soft transition hover:bg-cream hover:text-ink"
      >
        打印本页
      </button>
      {phase === 'error' && <span className="text-xs text-ink-soft">{message}</span>}
    </div>
  );
}
