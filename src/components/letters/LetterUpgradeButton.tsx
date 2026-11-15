'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

// 模板兜底信件的「升级」入口：再请一次模型，成功后原地更新同一封信（不新增行）
export default function LetterUpgradeButton({ donationId }: { donationId: number }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function upgrade() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/ai/letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ donationId, retryTemplate: true }),
      });
      const data = await res.json().catch(() => null);
      if (!data?.ok) {
        toast.push({
          tone: 'warn',
          title: 'AI 仍然不可用',
          description: data?.message ?? '稍后再试，模板信仍然有效。',
        });
        return;
      }
      if (data.letter?.source === 'ai') {
        toast.push({ tone: 'ok', title: '已升级为 AI 版本' });
        router.refresh();
        return;
      }
      toast.push({ tone: 'warn', title: 'AI 仍然不可用', description: '稍后再试一次。' });
    } catch {
      toast.push({ tone: 'danger', title: '网络异常', description: '请稍后再试。' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={upgrade}
      loading={busy}
      loadingText="AI 正在思考…"
    >
      升级为 AI 版本
    </Button>
  );
}
