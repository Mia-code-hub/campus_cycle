'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

const ACTION_LABEL: Record<string, string> = {
  approve: '同意',
  reject: '拒绝',
  complete: '标记完成',
  cancel: '取消',
};

const ACTION_DONE: Record<string, string> = {
  approve: '已同意这次申领',
  reject: '已拒绝这次申领',
  complete: '已标记为完成',
  cancel: '已取消',
};

const ACTION_VARIANT = {
  approve: 'primary',
  reject: 'secondary',
  complete: 'primary',
  cancel: 'secondary',
} as const;

/** 需要二次确认的动作：拒绝与取消会让对方白等一场，值得多问一句 */
const NEED_CONFIRM = new Set(['reject', 'cancel']);

const CONFIRM_TITLE: Record<string, string> = {
  reject: '确认拒绝这次申领？',
  cancel: '确认取消？',
};

const CONFIRM_DESC: Record<string, string> = {
  reject: '对方会收到结果。如果只是暂时不方便，先留着可能更合适。',
  cancel: '取消后这条申领记录会作废，物品重新回到可申领状态。',
};

export default function ApplicationActions({
  applicationId,
  actions,
}: {
  applicationId: number;
  actions: string[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null);

  async function act(action: string) {
    if (loading) return;
    setLoading(action);
    setError('');
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setConfirm(null);
        toast.push({ tone: 'ok', title: ACTION_DONE[action] ?? '操作成功' });
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

  function onClick(action: string) {
    if (NEED_CONFIRM.has(action)) {
      setConfirm(action);
      return;
    }
    act(action);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
      {actions.map((a) => (
        <Button
          key={a}
          size="sm"
          variant={ACTION_VARIANT[a as keyof typeof ACTION_VARIANT] ?? 'secondary'}
          onClick={() => onClick(a)}
          loading={loading === a}
          loadingText="处理中…"
          disabled={!!loading && loading !== a}
        >
          {ACTION_LABEL[a] ?? a}
        </Button>
      ))}

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm ? CONFIRM_TITLE[confirm] : ''}
        description={confirm ? CONFIRM_DESC[confirm] : undefined}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)} disabled={!!loading}>
              先不改
            </Button>
            <Button
              variant="danger"
              onClick={() => confirm && act(confirm)}
              loading={!!loading}
              loadingText="处理中…"
            >
              确认{confirm ? ACTION_LABEL[confirm] : ''}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-6 text-ink-soft">
          这个操作会立刻生效，并记录在申领流里。
        </p>
      </Modal>
    </div>
  );
}
