import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/server/db';
import {
  createSession,
  verifyPassword,
  SESSION_COOKIE,
  sessionCookieOptions,
} from '@/server/auth';
import { checkLoginLock, clearLoginFailure, recordLoginFailure } from '@/server/rate-limit';
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

  // 先看有没有被锁：连续失败 5 次后这个「用户名 + IP」组合要等 15 分钟，
  // 同一 IP 15 分钟内总失败超过 20 次也会被拦（防换用户名撞库）。
  const locked = checkLoginLock(req, username);
  if (locked) return locked;

  const row =
    username && password
      ? (getDb()
          .prepare(
            'SELECT id, username, nickname, role, password_hash FROM users WHERE username = ?',
          )
          .get(username) as (SessionUser & { password_hash: string }) | undefined)
      : undefined;

  // 不区分「用户名不存在」与「密码错误」，但两者都计入失败次数
  if (!row || !verifyPassword(password, row.password_hash)) {
    recordLoginFailure(req, username);
    return NextResponse.json(
      { ok: false, code: 'INVALID_CREDENTIALS', message: '用户名或密码错误' },
      { status: 401 },
    );
  }

  clearLoginFailure(req, username);

  const user: SessionUser = {
    id: row.id,
    username: row.username,
    nickname: row.nickname,
    role: row.role,
  };

  const cookieStore = await cookies();
  cookieStore.set(
    SESSION_COOKIE,
    createSession(user.id, req.headers.get('user-agent')),
    sessionCookieOptions(),
  );

  return NextResponse.json({ ok: true, user });
}
