import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth';
import { reviewAid } from '@/server/aid';

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
  const appId = Number(id);
  if (!Number.isSafeInteger(appId) || appId <= 0) {
    return NextResponse.json({ ok: false, code: 'INVALID_ID', message: '申请不存在' }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const action = typeof body.action === 'string' ? body.action : '';
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ ok: false, code: 'INVALID_ACTION', message: '非法动作' }, { status: 400 });
  }

  const result = reviewAid(appId, user.id, action === 'approve');
  if (!result) {
    return NextResponse.json({ ok: false, code: 'NOT_PENDING', message: '该申请已处理或不存在' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
