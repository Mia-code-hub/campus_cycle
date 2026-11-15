'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/ui/cn';

type Method = 'wechat' | 'alipay';

const METHOD_META: Record<Method, { label: string; hint: string; active: string }> = {
  wechat: {
    label: '微信收款码',
    hint: '买家选微信支付时会看到这张码',
    active: 'bg-ok-soft ring-ok-line text-ok',
  },
  alipay: {
    label: '支付宝收款码',
    hint: '买家选支付宝支付时会看到这张码',
    active: 'bg-sky/45 ring-line-strong text-ink',
  },
};

/**
 * 个人中心的收款码设置：上传 / 更换 / 清除。
 * 平台不碰钱，收款码是「买家扫你的码直接转给你」——文件仍走统一上传通道，
 * 归属账本保证你只能挂自己传的图。
 */
export default function PayoutSettings({
  initialWechat,
  initialAlipay,
}: {
  initialWechat: string | null;
  initialAlipay: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [qr, setQr] = useState<Record<Method, string | null>>({
    wechat: initialWechat,
    alipay: initialAlipay,
  });
  const [busy, setBusy] = useState<Method | null>(null);
  const [error, setError] = useState('');
  const inputs = useRef<Record<Method, HTMLInputElement | null>>({ wechat: null, alipay: null });

  async function upload(method: Method, file: File) {
    if (busy) return;
    setBusy(method);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const up = await fetch('/api/upload', { method: 'POST', body: form });
      const upData = await up.json().catch(() => null);
      if (!up.ok || !upData?.ok) {
        setError(upData?.message ?? '上传失败');
        return;
      }
      const save = await fetch('/api/me/payout', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, qrPath: upData.path }),
      });
      const saveData = await save.json().catch(() => null);
      if (!save.ok || !saveData?.ok) {
        setError(saveData?.message ?? '保存失败');
        return;
      }
      setQr((prev) => ({ ...prev, [method]: upData.path as string }));
      toast.push({ tone: 'ok', title: '收款码已更新' });
      router.refresh();
    } catch {
      setError('网络异常，请稍后重试');
    } finally {
      setBusy(null);
    }
  }

  async function clearQr(method: Method) {
    if (busy) return;
    setBusy(method);
    setError('');
    try {
      const res = await fetch('/api/me/payout', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, qrPath: null }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.message ?? '操作失败');
        return;
      }
      setQr((prev) => ({ ...prev, [method]: null }));
      toast.push({ tone: 'ok', title: '已清除' });
      router.refresh();
    } catch {
      setError('网络异常，请稍后重试');
    } finally {
      setBusy(null);
    }
  }

  function onPick(method: Method) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void upload(method, file);
      e.target.value = '';
    };
  }

  return (
    <section className="rounded-card-lg bg-panel p-5 shadow-soft">
      <h2 className="text-base font-semibold text-ink">收款码</h2>
      <p className="mt-1 text-sm leading-6 text-ink-soft">
        卖出物品时，买家扫码直接向你转账，平台不经手资金。建议两个渠道都设置。
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {(['wechat', 'alipay'] as const).map((m) => {
          const meta = METHOD_META[m];
          const path = qr[m];
          return (
            <div key={m} className="flex items-center gap-4 rounded-card bg-sunken p-4">
              <div
                className={cn(
                  'flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-card bg-raise p-1.5 ring-1',
                  path ? meta.active : 'ring-line',
                )}
              >
                {path ? (
                  <img src={path} alt={meta.label} className="h-full w-full object-contain" />
                ) : (
                  <span className="text-center text-[10px] leading-4 text-ink-soft">
                    还没有设置
                  </span>
                )}
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <div>
                  <p className="text-sm font-medium text-ink">{meta.label}</p>
                  <p className="text-xs text-ink-soft">{meta.hint}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={busy === m}
                    loadingText="上传中…"
                    onClick={() => inputs.current[m]?.click()}
                  >
                    {path ? '更换' : '上传'}
                  </Button>
                  {path && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!!busy && busy !== m}
                      onClick={() => clearQr(m)}
                    >
                      清除
                    </Button>
                  )}
                </div>
              </div>
              <input
                ref={(el) => {
                  inputs.current[m] = el;
                }}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={onPick(m)}
                aria-label={`上传${meta.label}`}
              />
            </div>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-xs text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
