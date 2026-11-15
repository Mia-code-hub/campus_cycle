'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/ui/cn';

type Method = 'wechat' | 'alipay';

const METHOD_LABEL: Record<Method, string> = {
  wechat: '微信支付',
  alipay: '支付宝',
};

/**
 * 收款码支付面板：买家选定渠道 → 展示物主收款码与金额 → 线下扫码转账 →
 * 点「我已转账」记录在案，物主确认收款后才算交割。
 * 平台不经手资金，这里的每一步只是信用台账。
 */
export default function PaymentPanel({
  applicationId,
  amount,
  wechatQr,
  alipayQr,
  currentMethod,
  currentStatus,
}: {
  applicationId: number;
  amount: number;
  wechatQr: string | null;
  alipayQr: string | null;
  currentMethod: Method | null;
  currentStatus: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<Method>(currentMethod ?? (wechatQr ? 'wechat' : 'alipay'));
  const [status, setStatus] = useState<string | null>(currentStatus);
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');

  const qr = method === 'wechat' ? wechatQr : alipayQr;
  const paid = status === 'paid';

  async function call(action: 'select' | 'paid', m?: Method) {
    if (loading) return;
    setLoading(action);
    setError('');
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId, action, method: m }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        if (action === 'select') {
          setStatus('pending');
        } else {
          setStatus('paid');
          toast.push({ tone: 'ok', title: '已通知对方确认收款' });
          setOpen(false);
          router.refresh();
        }
        return true;
      }
      setError(data?.message ?? '操作失败');
      return false;
    } catch {
      setError('网络异常，请稍后重试');
      return false;
    } finally {
      setLoading('');
    }
  }

  async function switchMethod(m: Method) {
    if (m === method) return;
    setMethod(m);
    setError('');
    // 切渠道 = 重选支付方式：把记录重置为 pending
    if (!paid) await call('select', m);
  }

  const triggerLabel = paid ? '查看支付' : status === 'pending' ? '继续支付' : '去支付';

  return (
    <>
      <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="扫码支付"
        description="平台不经手资金：请使用微信或支付宝扫码，直接转账给卖家本人"
        size="sm"
        footer={
          paid ? (
            <Button variant="secondary" onClick={() => setOpen(false)} block>
              关闭
            </Button>
          ) : (
            <Button
              variant="primary"
              block
              disabled={!qr}
              loading={loading === 'paid'}
              loadingText="提交中…"
              onClick={() => call('paid')}
            >
              我已转账，通知卖家确认
            </Button>
          )
        }
      >
        <div className="flex flex-col items-center gap-4">
          <div className="flex w-full items-baseline justify-center gap-1">
            <span className="text-sm text-ink-soft">应付金额</span>
            <span className="text-3xl font-semibold text-ink">¥{amount}</span>
          </div>

          <div className="flex w-full gap-2" role="tablist" aria-label="支付方式">
            {(['wechat', 'alipay'] as const).map((m) => {
              const hasQr = m === 'wechat' ? !!wechatQr : !!alipayQr;
              return (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={method === m}
                  disabled={!hasQr || paid}
                  onClick={() => switchMethod(m)}
                  className={cn(
                    'flex-1 rounded-card px-3 py-2 text-sm font-medium transition',
                    method === m
                      ? m === 'wechat'
                        ? 'bg-ok-soft text-ok ring-1 ring-ok-line'
                        : 'bg-sky/45 text-ink ring-1 ring-line-strong'
                      : 'bg-sunken text-ink-soft',
                    !hasQr && 'cursor-not-allowed opacity-50',
                  )}
                >
                  {METHOD_LABEL[m]}
                </button>
              );
            })}
          </div>

          <div className="flex h-52 w-52 items-center justify-center overflow-hidden rounded-card bg-raise p-2">
            {qr ? (
              <img
                src={qr}
                alt={`${METHOD_LABEL[method]}收款码`}
                className="h-full w-full object-contain"
              />
            ) : (
              <p className="px-4 text-center text-xs leading-5 text-ink-soft">
                对方还没有设置{METHOD_LABEL[method]}收款码
                <br />
                可以换个渠道，或留言协商
              </p>
            )}
          </div>

          {paid && (
            <p className="text-center text-xs leading-5 text-ink-soft">
              你已声明完成转账，等卖家确认收款后交割完成。
            </p>
          )}
          {error && (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
