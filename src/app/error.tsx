'use client';

import { useEffect } from 'react';
import ErrorView from '@/components/layout/ErrorView';
import Button, { ButtonLink } from '@/components/ui/Button';

/**
 * 路由级错误边界。服务端渲染或客户端渲染抛错时接管，
 * 不做「白屏 + 控制台堆栈」——用户看到的是一句人话和两个出口。
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 生产环境错误详情被 Next 隐藏，digest 是与服务端日志对上号的唯一线索
    console.error('[route-error]', error);
  }, [error]);

  return (
    <ErrorView
      code="出错了"
      title="这一页没能打开"
      description="页面在渲染时遇到了问题，可能是网络抖动或数据暂时不可用。可以重试一次；如果一直这样，回首页换个入口试试。"
      details={error.digest}
      actions={
        <>
          <Button onClick={reset}>重试</Button>
          <ButtonLink href="/" variant="secondary">
            回首页
          </ButtonLink>
        </>
      }
    />
  );
}
