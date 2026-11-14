import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/server/db';
import { signSession, verifyPassword, SESSION_COOKIE, sessionCookieOptions } from '@/server/auth';
import type { SessionUser } from '@/lib/types';

export async function POST(req: Request) {
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
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  const row =
    username && password
      ? (getDb()
          .prepare(
            'SELECT id, username, nickname, role, password_hash FROM users WHERE username = ?',
          )
          .get(username) as (SessionUser & { password_hash: string }) | undefined)
      : undefined;

  // 不区分「用户名不存在」与「密码错误」
  if (!row || !verifyPassword(password, row.password_hash)) {
    return NextResponse.json(
      { ok: false, code: 'INVALID_CREDENTIALS', message: '用户名或密码错误' },
      { status: 401 },
    );
  }

  const user: SessionUser = {
    id: row.id,
    username: row.username,
    nickname: row.nickname,
    role: row.role,
  };

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, signSession(user.id), sessionCookieOptions());

  return NextResponse.json({ ok: true, user });
}
