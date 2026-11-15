'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

export default function ViolationActions({
  itemId,
  flag,
}: {
  itemId: number;
  /** 1=已下架，2=待复核 */
  flag: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);

  async function act(action: 'remove' | 'restore') {
    if (loading) return;
    setLoading(action);
    setError('');
    try {
      const res = await fetch(`/api/admin/violations/${itemId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setConfirmRemove(false);
        toast.push({
          tone: 'ok',
          title: action === 'remove' ? '已下架该物品' : '已解除标记',
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
    <div className="flex flex-wrap items-center gap-2">
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
      {flag !== 1 && (
        <Button
          size="sm"
          variant="danger"
          onClick={() => setConfirmRemove(true)}
          disabled={!!loading}
        >
          人工下架
        </Button>
      )}
      <Button
        size="sm"
        variant="secondary"
        onClick={() => act('restore')}
        loading={loading === 'restore'}
        loadingText="处理中…"
        disabled={!!loading && loading !== 'restore'}
      >
        {flag === 1 ? '恢复上架' : '确认合规，解除标记'}
      </Button>

      <Modal
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title="确认下架这件物品？"
        description="下架后物品会立刻从列表与搜索中消失，发布者会看到下架原因。"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmRemove(false)} disabled={!!loading}>
              再看看
            </Button>
            <Button
              variant="danger"
              onClick={() => act('remove')}
              loading={loading === 'remove'}
              loadingText="下架中…"
            >
              确认下架
            </Button>
          </>
        }
      >
        <p className="text-sm leading-6 text-ink-soft">
          信息不够完整的话，可以先恢复上架让对方补充描述。下架之后仍可通过「恢复上架」撤销。
        </p>
      </Modal>
    </div>
  );
}
