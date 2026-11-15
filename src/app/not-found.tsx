import ErrorView from '@/components/layout/ErrorView';
import { ButtonLink } from '@/components/ui/Button';

/**
 * 全站 404。物品不存在、信件无权查看都走这里（物品详情里调用 notFound()）。
 * 注意：不区分「不存在」与「无权」——对无权者暴露「这封信存在」本身就是信息泄露。
 */
export default function NotFound() {
  return (
    <ErrorView
      code="404"
      title="这件东西已经流转走了"
      description="链接可能已经过期，或者物品被下架、删除了。看看在架的其它闲置，或者发布一条求物需求。"
      actions={
        <>
          <ButtonLink href="/" variant="primary">
            回首页
          </ButtonLink>
          <ButtonLink href="/search" variant="secondary">
            去搜一下
          </ButtonLink>
        </>
      }
    />
  );
}
