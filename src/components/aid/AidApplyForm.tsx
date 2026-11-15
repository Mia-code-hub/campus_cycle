'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';

export default function AidApplyForm() {
  const router = useRouter();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [proofNote, setProofNote] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/aid/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, proofNote }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        toast.push({ tone: 'ok', title: '申请已提交', description: '管理员审核后会通知你。' });
        router.refresh();
        return;
      }
      setError(data?.message ?? '提交失败');
    } catch {
      setError('网络异常，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card padding="xl" className="flex flex-col gap-4">
      <form onSubmit={onSubmit} aria-label="帮扶资格申请" className="flex flex-col gap-4">
        <Textarea
          label="申请说明"
          hint="至少 20 字，简要说明实际困难，便于管理员审核"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          maxLength={500}
          required
          placeholder="例：新生入学，家里暂时无法负担教材与生活用品的开销…"
        />
        <Textarea
          label="补充说明（选填）"
          hint="Demo 不要求上传真实证件，简单说明即可"
          value={proofNote}
          onChange={(e) => setProofNote(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="可以不填"
        />

        {error && <Alert tone="danger" title="提交失败">{error}</Alert>}

        <Button
          type="submit"
          size="lg"
          loading={loading}
          loadingText="提交中…"
          disabled={reason.trim().length < 20}
        >
          提交申请
        </Button>
      </form>
    </Card>
  );
}
