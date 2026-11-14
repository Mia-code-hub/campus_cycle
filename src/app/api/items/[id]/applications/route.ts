import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { requireUser } from '@/server/auth';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, code: 'UNAUTHORIZED', message: '请先登录' },
      { status: 401 },
    );
  }

  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isSafeInteger(itemId) || itemId <= 0) {
    return NextResponse.json({ ok: false, code: 'INVALID_ID', message: '物品不存在' }, { status: 400 });
  }

  const db = getDb();
  const item = db
    .prepare('SELECT id, owner_id, status, mode FROM items WHERE id = ?')
    .get(itemId) as { id: number; owner_id: number; status: string; mode: string } | undefined;
  if (!item) {
    return NextResponse.json({ ok: false, code: 'NOT_FOUND', message: '物品不存在' }, { status: 404 });
  }

  if (item.owner_id === user.id) {
    return NextResponse.json({ ok: false, code: 'OWN_ITEM', message: '不能申领自己的物品' }, { status: 400 });
  }
  if (item.status !== 'listed') {
    return NextResponse.json({ ok: false, code: 'NOT_LISTED', message: '该物品当前不可申领' }, { status: 400 });
  }

  const dup = db
    .prepare(
      "SELECT 1 FROM applications WHERE item_id = ? AND applicant_id = ? AND status != 'cancelled'",
    )
    .get(itemId, user.id);
  if (dup) {
    return NextResponse.json({ ok: false, code: 'DUPLICATE', message: '你已申领过该物品' }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

  if (item.mode === 'donate' && !reason) {
    return NextResponse.json({ ok: false, code: 'REASON_REQUIRED', message: '请填写申领用途' }, { status: 400 });
  }
  if (reason.length > 500) {
    return NextResponse.json({ ok: false, code: 'REASON_TOO_LONG', message: '用途说明过长' }, { status: 400 });
  }

  const info = db
    .prepare('INSERT INTO applications (item_id, applicant_id, reason, status) VALUES (?, ?, ?, ?)')
    .run(itemId, user.id, reason || null, 'pending');

  return NextResponse.json({ ok: true, id: Number(info.lastInsertRowid) });
}
