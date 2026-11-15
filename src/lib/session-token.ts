// 会话令牌的结构定义与编解码。
//
// 这里只做「纯」的事：拼 token 形状、base64url 编解码、字段合法性、过期判断。
// HMAC 签名与数据库读写留在 server/auth.ts —— 那部分要碰密钥与 SQL。
//
// 令牌格式：v1.<base64url(payload)>.<签名 hex>
// 签名覆盖 "v1.<payload>"，所以 uid / exp / jti 任一被改动都会验签失败。

export const SESSION_VERSION = 'v1';

export interface SessionPayload {
  /** 用户 id */
  uid: number;
  /** 签发时间（秒） */
  iat: number;
  /** 过期时间（秒） */
  exp: number;
  /** 会话标识，用于吊销；每次登录都不同 */
  jti: string;
}

export interface ParsedToken {
  version: string;
  payloadB64: string;
  signature: string;
  /** 参与签名的那一段（version + "." + payload），验签时用 */
  signed: string;
}

const B64URL_RE = /^[A-Za-z0-9_-]+$/;
const SIG_RE = /^[a-f0-9]{64}$/;
const JTI_RE = /^[A-Za-z0-9-]{8,64}$/;

export function encodePayload(p: SessionPayload): string {
  return Buffer.from(JSON.stringify(p), 'utf8').toString('base64url');
}

export function decodePayload(b64: string): SessionPayload | null {
  if (!B64URL_RE.test(b64)) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const uid = o.uid;
  const iat = o.iat;
  const exp = o.exp;
  const jti = o.jti;
  if (typeof uid !== 'number' || !Number.isSafeInteger(uid) || uid <= 0) return null;
  if (typeof iat !== 'number' || !Number.isSafeInteger(iat) || iat <= 0) return null;
  if (typeof exp !== 'number' || !Number.isSafeInteger(exp) || exp <= 0) return null;
  if (typeof jti !== 'string' || !JTI_RE.test(jti)) return null;
  // exp 早于 iat 说明被改过（签名的保护之外的额外形状校验）
  if (exp <= iat) return null;
  return { uid, iat, exp, jti };
}

export function formatToken(payloadB64: string, signature: string): string {
  return `${SESSION_VERSION}.${payloadB64}.${signature}`;
}

/** 只做结构拆分；签名是否正确由调用方验证。 */
export function parseToken(token: string | null | undefined): ParsedToken | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [version, payloadB64, signature] = parts;
  if (version !== SESSION_VERSION) return null;
  if (!B64URL_RE.test(payloadB64) || payloadB64.length > 512) return null;
  if (!SIG_RE.test(signature)) return null;
  return { version, payloadB64, signature, signed: `${version}.${payloadB64}` };
}

export function isExpired(p: SessionPayload, nowSec: number): boolean {
  return p.exp <= nowSec;
}

export function nowSeconds(date: Date = new Date()): number {
  return Math.floor(date.getTime() / 1000);
}

// ---- 密钥强度 ----

export const MIN_SECRET_LENGTH = 32;

const PLACEHOLDER_RE = /^(change|replace|your|example|test|secret|dev)/i;

export interface SecretCheck {
  ok: boolean;
  reason?: 'missing' | 'too_short' | 'placeholder';
}

/**
 * 启动期校验：SESSION_SECRET 太短等于把签名降级成可爆破。
 * 32 个字符是下限（开赛演示用的 12 位弱串会被这里拦下）。
 */
export function checkSecret(secret: string | null | undefined): SecretCheck {
  const s = (secret ?? '').trim();
  if (!s) return { ok: false, reason: 'missing' };
  if (s.length < MIN_SECRET_LENGTH) return { ok: false, reason: 'too_short' };
  if (PLACEHOLDER_RE.test(s)) return { ok: false, reason: 'placeholder' };
  return { ok: true };
}

export const SECRET_ERROR_MESSAGE: Record<
  Exclude<SecretCheck['reason'], undefined>,
  string
> = {
  missing: 'SESSION_SECRET 缺失：请在 .env.local 配置后重启',
  too_short: `SESSION_SECRET 太短：至少 ${MIN_SECRET_LENGTH} 个字符（可用 openssl rand -base64 48 生成）`,
  placeholder: 'SESSION_SECRET 仍是示例值：请替换成随机密钥后重启',
};
