import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth';
import { rebuildAllEmbeddings } from '@/lib/ai/embed';

// 换 embedding 模型后整库重算向量。旧向量在另一个向量空间里，和新向量算余弦没有意义，
// 因此要么重算、要么被判失效不参与召回（searchItems 已按 embedding_model 过滤）。
export const maxDuration = 300;

export async function POST() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, code: 'UNAUTHORIZED', message: '请先登录' },
      { status: 401 },
    );
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ ok: false, code: 'FORBIDDEN', message: '无权限' }, { status: 403 });
  }

  const res = await rebuildAllEmbeddings();
  if (res.failed > 0 && res.embedded === 0) {
    return NextResponse.json(
      { ok: false, code: 'EMBED_FAILED', message: res.message ?? '向量重算失败', ...res },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, ...res });
}
