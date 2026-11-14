import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { getDb } from './db';
import { hashPassword, verifyPassword } from './password';
import type { SessionUser } from '@/lib/types';

export { hashPassword, verifyPassword };

const SESSION_SECRET = process.env.SESSION_SECRET ?? '';
if (!SESSION_SECRET) {
  throw new Error('SESSION_SECRET 环境变量缺失：请在 .env.local 配置后重启');
}

export const SESSION_COOKIE = 'session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 天

// HMAC 签名 token：payload.signature
export function signSession(userId: number): string {
  const payload = String(userId);
  const sig = createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifySession(token: string): number | null {
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  const sigBuf = Buffer.from(sig, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
  const id = Number(payload);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}

// 从 httpOnly cookie 解析当前登录用户，未登录/令牌非法返回 null
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = verifySession(token);
  if (userId == null) return null;
  const row = getDb()
    .prepare('SELECT id, username, nickname, role FROM users WHERE id = ?')
    .get(userId) as SessionUser | undefined;
  return row ?? null;
}

// 守卫：未登录返回 null（调用方据此返回 401）
export async function requireUser(): Promise<SessionUser | null> {
  return getCurrentUser();
}

// 守卫：非管理员返回 null（调用方据此返回 401/403）
export async function requireAdmin(): Promise<SessionUser | null> {
  const user = await getCurrentUser();
  return user && user.role === 'admin' ? user : null;
}
