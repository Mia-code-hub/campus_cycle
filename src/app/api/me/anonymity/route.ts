import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth';
import { getDb } from '@/server/db';

// 受赠人署名偏好：默认匿名，只有本人主动开启才会在感谢信里出现昵称
export async function PATCH(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ ok: false, code: 'UNAUTHORIZED', message: '请先登录' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (typeof body.anonymous !== 'boolean') {
    return NextResponse.json(
      { ok: false, code: 'INVALID_BODY', message: '参数应为 anonymous: true/false' },
      { status: 400 },
    );
  }

  getDb()
    .prepare('UPDATE users SET letter_anonymous = ? WHERE id = ?')
    .run(body.anonymous ? 1 : 0, user.id);

  return NextResponse.json({ ok: true, anonymous: body.anonymous });
}
