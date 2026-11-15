'use client';

import { useEffect } from 'react';
import ErrorView from '@/components/layout/ErrorView';
import Button, { ButtonLink } from '@/components/ui/Button';

/** 管理端错误边界：比学生端多一个「回看板」的出口，避免管理员掉进死路 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[admin-error]', error);
  }, [error]);

  return (
    <ErrorView
      code="出错了"
      title="管理页加载失败"
      description="统计查询或图表渲染出了点问题。重试通常就能恢复；如果反复失败，先回看板确认服务是否正常。"
      details={error.digest}
      actions={
        <>
          <Button onClick={reset}>重试</Button>
          <ButtonLink href="/admin" variant="secondary">
            回看板
          </ButtonLink>
        </>
      }
    />
  );
}
