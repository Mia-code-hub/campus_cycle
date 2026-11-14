import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth';
import { applyAid, getAidStatus } from '@/server/aid';

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, code: 'UNAUTHORIZED', message: '请先登录' },
      { status: 401 },
    );
  }

  const current = getAidStatus(user.id);
  if (current === 1) {
    return NextResponse.json({ ok: false, code: 'ALREADY_APPROVED', message: '你已通过帮扶资格审核' }, { status: 400 });
  }
  if (current === 2) {
    return NextResponse.json({ ok: false, code: 'PENDING', message: '你的申请正在审核中' }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  const proofNote = typeof body.proofNote === 'string' ? body.proofNote.trim() : '';

  if (reason.length < 20) {
    return NextResponse.json(
      { ok: false, code: 'REASON_TOO_SHORT', message: '申请说明至少 20 字' },
      { status: 400 },
    );
  }
  if (reason.length > 500) {
    return NextResponse.json(
      { ok: false, code: 'REASON_TOO_LONG', message: '申请说明过长' },
      { status: 400 },
    );
  }
  if (proofNote.length > 500) {
    return NextResponse.json(
      { ok: false, code: 'PROOF_TOO_LONG', message: '说明材料过长' },
      { status: 400 },
    );
  }

  applyAid(user.id, reason, proofNote || null);
  return NextResponse.json({ ok: true });
}
