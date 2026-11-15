import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { getDb } from './db';
import { hashPassword, verifyPassword } from './password';
import type { SessionUser } from '@/lib/types';
import {
  checkSecret,
  decodePayload,
  encodePayload,
  formatToken,
  isExpired,
  nowSeconds,
  parseToken,
  SECRET_ERROR_MESSAGE,
  SESSION_VERSION,
  type SessionPayload,
} from '@/lib/session-token';

export { hashPassword, verifyPassword };

const rawSecret = process.env.SESSION_SECRET ?? '';
const secretCheck = checkSecret(rawSecret);
if (!secretCheck.ok) {
  throw new Error(SECRET_ERROR_MESSAGE[secretCheck.reason ?? 'missing']);
}
const SESSION_SECRET = rawSecret;

export const SESSION_COOKIE = 'session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 天

function sign(data: string): string {
  return createHmac('sha256', SESSION_SECRET).update(data).digest('hex');
}

function signatureMatches(expected: string, actual: string): boolean {
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(actual, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * 验签 + 结构 + 过期，**不查数据库**。
 *
 * 令牌自带 exp 与 jti：
 * - exp 让「偷到的 cookie 永久有效」变成 7 天；
 * - jti 让服务端能单方面吊销（sessions 表）。
 * 两者都签在 HMAC 覆盖范围内，改一位就验签失败。
 */
export function readToken(
  token: string | null | undefined,
  now: number = nowSeconds(),
): SessionPayload | null {
  const parsed = parseToken(token);
  if (!parsed) return null;
  const payload = decodePayload(parsed.payloadB64);
  if (!payload) return null;
  if (!signatureMatches(sign(parsed.signed), parsed.signature)) return null;
  if (isExpired(payload, now)) return null;
  return payload;
}

/** 签发一枚新令牌并落库。每次登录都是一个新 jti，设备之间不会互相顶掉。 */
export function createSession(userId: number, userAgent?: string | null): string {
  const now = nowSeconds();
  const payload: SessionPayload = {
    uid: userId,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
    jti: randomUUID(),
  };
  const payloadB64 = encodePayload(payload);
  const db = getDb();
  db.prepare('INSERT INTO sessions (jti, user_id, expires_at, user_agent) VALUES (?, ?, ?, ?)').run(
    payload.jti,
    userId,
    payload.exp,
    (userAgent ?? '').slice(0, 200) || null,
  );
  // 顺手清掉过期超过 30 天的行，避免 sessions 只增不删
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now - 30 * 24 * 60 * 60);
  return formatToken(payloadB64, sign(`${SESSION_VERSION}.${payloadB64}`));
}

/** 吊销一枚令牌（退出登录）。非法/已过期的令牌静默忽略。 */
export function revokeSession(token: string | null | undefined): void {
  const payload = readToken(token);
  if (!payload) return;
  getDb()
    .prepare(
      "UPDATE sessions SET revoked_at = datetime('now','localtime') WHERE jti = ? AND revoked_at IS NULL",
    )
    .run(payload.jti);
}

/** 吊销某用户的全部会话（踢下线 / 改密码后调用）。 */
export function revokeAllSessions(userId: number): number {
  const info = getDb()
    .prepare(
      "UPDATE sessions SET revoked_at = datetime('now','localtime') WHERE user_id = ? AND revoked_at IS NULL",
    )
    .run(userId);
  return info.changes;
}

// 签名只证明「这枚令牌是我签的」，吊销与过期要靠这一句 JOIN。
const LIVE_SESSION_SQL = `
  SELECT u.id, u.username, u.nickname, u.role
    FROM sessions s
    JOIN users u ON u.id = s.user_id
   WHERE s.jti = ? AND s.revoked_at IS NULL AND s.expires_at > ?
`;

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}

// 从 httpOnly cookie 解析当前登录用户，未登录/令牌非法/已吊销返回 null
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const payload = readToken(token);
  if (!payload) return null;
  const row = getDb()
    .prepare(LIVE_SESSION_SQL)
    .get(payload.jti, nowSeconds()) as SessionUser | undefined;
  return row ?? null;
}

/** 读取当前请求的令牌（退出登录时用来取 jti）。 */
export async function currentSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
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
