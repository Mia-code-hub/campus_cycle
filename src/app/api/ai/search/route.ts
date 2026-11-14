import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth';
import { runSemanticSearch } from '@/server/search';

// 语义检索：query → 向量 → Top-8 + 导购语。
// 语义服务不可用时自动退回关键词召回（degraded=true），接口本身仍返回 200，搜索页不会白屏。
export async function POST(req: Request) {
  const user = await getCurrentUser();

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: 'BAD_REQUEST', message: '请求体格式错误' },
      { status: 400 },
    );
  }
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const query = typeof body.query === 'string' ? body.query.trim() : '';

  if (!query) {
    return NextResponse.json(
      { ok: false, code: 'INVALID_QUERY', message: '请填写搜索内容' },
      { status: 400 },
    );
  }
  if (query.length > 100) {
    return NextResponse.json(
      { ok: false, code: 'INVALID_QUERY', message: '搜索内容过长（最多 100 字）' },
      { status: 400 },
    );
  }

  const out = await runSemanticSearch(query, user?.id ?? null);
  return NextResponse.json({
    ok: true,
    query,
    engine: out.engine,
    degraded: out.degraded,
    reason: out.reason ?? null,
    guide: out.guide,
    count: out.items.length,
    items: out.items,
  });
}
