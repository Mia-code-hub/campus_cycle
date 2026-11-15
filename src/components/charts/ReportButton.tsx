'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

/**
 * 看板底部的「一键生成环保报告」。
 * 服务端会把统计快照喂给模型、再逐字校验数字；校验不过也返回 id，
 * 这里照常跳转到报告页——报告页会明确写出「未通过校验，正文不展示」。
 * 把失败也展示出来，比藏起来更接近「可审计」。
 */
export default function ReportButton({ label = '一键生成环保报告' }: { label?: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const toast = useToast();

  async function onClick() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/ai/report', { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as {
        id?: number;
        message?: string;
        verified?: boolean;
      };
      if (res.ok && data.id) {
        toast.push({
          tone: data.verified === false ? 'warn' : 'ok',
          title: data.verified === false ? '报告已生成，但未通过校验' : '报告已生成',
          description:
            data.verified === false
              ? '打开后只会看到校验说明，正文不会展示。'
              : '正在打开报告页…',
        });
        router.push(`/admin/report?id=${data.id}`);
        return;
      }
      toast.push({
        tone: 'warn',
        title: '报告没有生成',
        description: data.message ?? '可先打印看板作为数据快照。',
      });
    } catch {
      toast.push({
        tone: 'danger',
        title: '网络异常',
        description: '报告没有生成，可先打印看板作为数据快照。',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 print:hidden">
      <Button onClick={onClick} loading={loading} loadingText="AI 正在思考…">
        {label}
      </Button>
      <Button variant="ghost" onClick={() => window.print()}>
        打印本页
      </Button>
    </div>
  );
}
