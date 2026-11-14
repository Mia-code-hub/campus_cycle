import { NextResponse } from 'next/server';
import { getDb } from '@/server/db';
import { requireUser } from '@/server/auth';
import { getConversationPeer, insertMessage, listMessages } from '@/server/messages';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const peerId = getConversationPeer(itemId, user.id);
  if (peerId == null) {
    return NextResponse.json({ ok: false, code: 'FORBIDDEN', message: '无权查看该对话' }, { status: 403 });
  }

  const messages = listMessages(itemId, user.id, peerId).map((m) => ({
    ...m,
    mine: m.from_user_id === user.id,
  }));
  return NextResponse.json({ ok: true, messages });
}

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
  const item = db.prepare('SELECT id FROM items WHERE id = ?').get(itemId);
  if (!item) {
    return NextResponse.json({ ok: false, code: 'NOT_FOUND', message: '物品不存在' }, { status: 404 });
  }

  const peerId = getConversationPeer(itemId, user.id);
  if (peerId == null) {
    return NextResponse.json({ ok: false, code: 'FORBIDDEN', message: '无权发送消息' }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  if (!content) {
    return NextResponse.json({ ok: false, code: 'EMPTY', message: '消息不能为空' }, { status: 400 });
  }
  if (content.length > 500) {
    return NextResponse.json({ ok: false, code: 'TOO_LONG', message: '消息最多 500 字' }, { status: 400 });
  }

  const message = insertMessage(itemId, user.id, peerId, content);
  return NextResponse.json({ ok: true, message: { ...message, mine: true } });
}
