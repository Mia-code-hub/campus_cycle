'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

export default function AidReviewButton({ applicationId }: { applicationId: number }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');

  async function act(action: 'approve' | 'reject') {
    if (loading) return;
    setLoading(action);
    setError('');
    try {
      const res = await fetch(`/api/admin/aid/${applicationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        toast.push({
          tone: 'ok',
          title: action === 'approve' ? '已通过帮扶资格' : '已驳回申请',
        });
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
    <div className="flex items-center gap-2">
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
      <Button
        size="sm"
        onClick={() => act('approve')}
        loading={loading === 'approve'}
        loadingText="处理中…"
        disabled={!!loading && loading !== 'approve'}
      >
        通过
      </Button>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => act('reject')}
        loading={loading === 'reject'}
        loadingText="处理中…"
        disabled={!!loading && loading !== 'reject'}
      >
        驳回
      </Button>
    </div>
  );
}
