// 限流：滑动窗口的纯计算部分。
//
// 只算「这批时间戳里，现在还能不能放行」，不持有状态、不碰 next/server，
// 所以可以用 node:test 直接跑。状态与 HTTP 响应在 server/rate-limit.ts。

export interface RateLimitRule {
  /** 窗口内允许的次数 */
  limit: number;
  /** 窗口长度（毫秒） */
  windowMs: number;
}

export interface RateLimitState {
  ok: boolean;
  /** 窗口内已记录的次数 */
  used: number;
  remaining: number;
  /** 被拒时距离下一次可用的毫秒数；放行时为 0 */
  retryAfterMs: number;
}

/** 丢弃窗口外的旧记录（hits 按时间升序）。 */
export function pruneHits(hits: readonly number[], now: number, windowMs: number): number[] {
  const floor = now - windowMs;
  return hits.filter((t) => t > floor);
}

/** 判断一次请求是否放行；不修改入参，由调用方决定是否记账。 */
export function evaluate(
  hits: readonly number[],
  rule: RateLimitRule,
  now: number,
): RateLimitState {
  const live = pruneHits(hits, now, rule.windowMs);
  const used = live.length;
  const ok = used < rule.limit;
  // 窗口是滑动的，要等最早那一条滑出去才有位置
  const retryAfterMs = ok ? 0 : Math.max(1, (live[0] ?? now) + rule.windowMs - now);
  return { ok, used, remaining: Math.max(0, rule.limit - used), retryAfterMs };
}

export function retryAfterSeconds(ms: number): number {
  return Math.max(1, Math.ceil(ms / 1000));
}

/**
 * 取调用方 IP。
 *
 * 直连 Node 时 Request 上没有 remoteAddress，只能读头：
 * 前置 nginx 应设置 X-Real-IP（不会被客户端覆盖）；没有代理时退到 X-Forwarded-For
 * 的最左值，这个值可以伪造，所以 IP 维度只当「提高门槛」用，
 * 真正可靠的额度挂在 userId 上。
 */
export function clientIp(headers: Headers): string {
  const real = headers.get('x-real-ip')?.trim();
  if (real) return real;
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return 'local';
}

export const RULES = {
  /** 登录用户：AI 写操作（analyze/moderate/letter/report） */
  aiMinute: { limit: 10, windowMs: 60_000 },
  aiHour: { limit: 30, windowMs: 60 * 60_000 },
  /** 登录用户：AI 搜索（便宜些，单独一个桶，免得搜索挤掉发布额度） */
  searchMinute: { limit: 10, windowMs: 60_000 },
  searchHour: { limit: 60, windowMs: 60 * 60_000 },
  /** 匿名搜索：只做关键词召回，额度收紧到 3 次/分 */
  anonSearchMinute: { limit: 3, windowMs: 60_000 },
  /** 登录失败：同一「用户名 + IP」15 分钟内最多 5 次（不按用户名锁，防止恶意锁别人账号） */
  loginUser: { limit: 5, windowMs: 15 * 60_000 },
  /** 登录失败：同一 IP 15 分钟内最多 20 次，防撞库换用户名 */
  loginIp: { limit: 20, windowMs: 15 * 60_000 },
  registerIp: { limit: 5, windowMs: 60 * 60_000 },
} as const satisfies Record<string, RateLimitRule>;

/** 用户名归一化：大小写不敏感，长名字截断，避免 key 无限长 */
export function normalizeLoginName(username: string): string {
  return username.trim().toLowerCase().slice(0, 40);
}

export function loginBuckets(username: string, ip: string): { userKey: string; ipKey: string } {
  return {
    userKey: `login:u:${normalizeLoginName(username)}:${ip}`,
    ipKey: `login:ip:${ip}`,
  };
}

export function aiBucket(scope: 'search' | 'write', userId: number | null, ip: string): string {
  return userId ? `ai:${scope}:u:${userId}` : `ai:${scope}:ip:${ip}`;
}
