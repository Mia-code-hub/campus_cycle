import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { requireUser } from '@/server/auth';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const item = db.prepare('SELECT id FROM items WHERE id = ?').get(itemId);
  if (!item) {
    return NextResponse.json({ ok: false, code: 'NOT_FOUND', message: '物品不存在' }, { status: 404 });
  }

  const existing = db
    .prepare('SELECT 1 FROM favorites WHERE user_id = ? AND item_id = ?')
    .get(user.id, itemId);
  if (existing) {
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND item_id = ?').run(user.id, itemId);
    return NextResponse.json({ ok: true, favorited: false });
  }

  db.prepare('INSERT INTO favorites (user_id, item_id) VALUES (?, ?)').run(user.id, itemId);
  return NextResponse.json({ ok: true, favorited: true });
}
