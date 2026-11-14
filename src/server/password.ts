import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// scrypt + 16 字节随机盐，返回 "salt:hash" 的 hex 串（纯函数，供 auth 与 seed 复用）
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

// 用 timingSafeEqual 比对，避免时序侧信道
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
