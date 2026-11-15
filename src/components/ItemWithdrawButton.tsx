'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

/**
 * 物品主人对自己发布的物品：撤回（下架）与重新上架。
 * 撤回会连带作废进行中的申领，所以走二次确认；重新上架无副作用，点了就生效。
 * completed 的物品不显示任何按钮——已经交割完了，撤回等于抹掉台账。
 */
export default function ItemWithdrawButton({
  itemId,
  status,
  size = 'sm',
  block = false,
}: {
  itemId: number;
  status: string;
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (status === 'completed') return null;

  const isRemoved = status === 'removed';

  async function act() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: isRemoved ? 'relist' : 'withdraw' }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setConfirming(false);
        toast.push(
          isRemoved
            ? { tone: 'ok', title: '已重新上架', description: '同学现在能在列表里看到它了' }
            : {
                tone: 'ok',
                title: '已撤回',
                description:
                  data.cancelledApplications > 0
                    ? `同时作废了 ${data.cancelledApplications} 条进行中的申领`
                    : '已从列表和搜索中移除',
              },
        );
        router.refresh();
        return;
      }
      if (res.status === 401) {
        router.push(`/login?next=/items/${itemId}`);
        return;
      }
      toast.push({ tone: 'danger', title: data?.message ?? '操作失败，请稍后重试' });
    } catch {
      toast.push({ tone: 'danger', title: '网络异常，请稍后重试' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        size={size}
        block={block}
        variant="secondary"
        onClick={() => (isRemoved ? act() : setConfirming(true))}
        loading={loading}
        loadingText={isRemoved ? '上架中…' : '撤回中…'}
      >
        {isRemoved ? '重新上架' : '撤回'}
      </Button>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="确认撤回这件物品？"
        description="撤回后它会立刻从列表和搜索中消失。"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={loading}>
              先留着
            </Button>
            <Button
              variant="danger"
              onClick={act}
              loading={loading}
              loadingText="撤回中…"
            >
              确认撤回
            </Button>
          </>
        }
      >
        <p className="text-sm leading-6 text-ink-soft">
          正在等待你处理的申领会一并作废，对方会看到「已取消」。物品本身不会被删除，
          记录和已完成的交割台账都保留着，之后可以在「我发布的」里重新上架。
        </p>
      </Modal>
    </>
  );
}
