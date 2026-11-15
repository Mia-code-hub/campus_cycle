import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/server/db';
import { createSession, hashPassword, SESSION_COOKIE, sessionCookieOptions } from '@/server/auth';
import { checkRegisterLimit } from '@/server/rate-limit';
import type { SessionUser } from '@/lib/types';

export async function POST(req: Request) {
  // 注册不限流的话，一个脚本就能把 users 表灌满
  const limited = checkRegisterLimit(req);
  if (limited) return limited;

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
  const nickname = typeof body.nickname === 'string' ? body.nickname.trim() : '';

  if (username.length < 4 || username.length > 20) {
    return NextResponse.json(
      { ok: false, code: 'INVALID_USERNAME', message: '用户名需 4-20 个字符' },
      { status: 400 },
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { ok: false, code: 'INVALID_PASSWORD', message: '密码至少 6 位' },
      { status: 400 },
    );
  }
  if (!nickname) {
    return NextResponse.json(
      { ok: false, code: 'INVALID_NICKNAME', message: '昵称不能为空' },
      { status: 400 },
    );
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return NextResponse.json(
      { ok: false, code: 'USERNAME_TAKEN', message: '用户名已被注册' },
      { status: 409 },
    );
  }

  const isFirst = (db.prepare('SELECT count(*) AS c FROM users').get() as { c: number }).c === 0;
  const role = isFirst && process.env.FIRST_USER_IS_ADMIN === '1' ? 'admin' : 'user';

  const stored = hashPassword(password);
  const salt = stored.split(':')[0];
  const info = db
    .prepare(
      'INSERT INTO users (username, password_hash, salt, nickname, role) VALUES (?, ?, ?, ?, ?)',
    )
    .run(username, stored, salt, nickname, role);

  const user: SessionUser = { id: Number(info.lastInsertRowid), username, nickname, role };

  const cookieStore = await cookies();
  cookieStore.set(
    SESSION_COOKIE,
    createSession(user.id, req.headers.get('user-agent')),
    sessionCookieOptions(),
  );

  return NextResponse.json({ ok: true, user });
}
