'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';

export default function ApplyButton({
  itemId,
  mode,
  isOwner,
}: {
  itemId: number;
  mode: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(r: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/items/${itemId}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: r }),
      });
      if (res.status === 401) {
        router.push(`/login?next=/items/${itemId}`);
        return;
      }
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setShowReason(false);
        setReason('');
        toast.push({ tone: 'ok', title: '已提交申请', description: '等待对方处理' });
      } else {
        toast.push({ tone: 'danger', title: data?.message ?? '提交失败，请稍后重试' });
      }
    } catch {
      toast.push({ tone: 'danger', title: '网络异常，请稍后重试' });
    } finally {
      setLoading(false);
    }
  }

  function onClick() {
    if (isOwner) {
      toast.push({ tone: 'warn', title: '不能申领自己发布的物品' });
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
      {showReason && (
        <div className="flex flex-col gap-2 rounded-card-sm bg-sunken p-3">
          <Textarea
            label="申请用途"
            hint="捐赠物品必填：说明给谁用、什么时候用"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="例：新生入学需要这套教材"
          />
          <Button
            size="sm"
            onClick={() => submit(reason.trim())}
            loading={loading}
            loadingText="提交中…"
            disabled={!reason.trim()}
          >
            提交申请
          </Button>
        </div>
      )}

      <Button size="lg" block onClick={onClick} loading={loading} loadingText="提交中…">
        {label}
      </Button>
    </div>
  );
}
