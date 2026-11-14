import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth';
import { reviewViolation } from '@/server/moderation';

// 人工复核处置：remove 下架 / restore 恢复上架
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isSafeInteger(itemId) || itemId <= 0) {
    return NextResponse.json({ ok: false, code: 'INVALID_ID', message: '物品不存在' }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const action = typeof body.action === 'string' ? body.action : '';
  if (action !== 'remove' && action !== 'restore') {
    return NextResponse.json({ ok: false, code: 'INVALID_ACTION', message: '非法动作' }, { status: 400 });
  }

  const changed = reviewViolation(itemId, action);
  if (!changed) {
    return NextResponse.json(
      { ok: false, code: 'NOT_CHANGED', message: '该物品已处于目标状态' },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}
