import { NextResponse } from 'next/server';
import {
  aiBucket,
  clientIp,
  evaluate,
  loginBuckets,
  pruneHits,
  RULES,
  retryAfterSeconds,
  type RateLimitRule,
  type RateLimitState,
} from '@/lib/rate-limit';

// 限流的「有状态」部分：一个进程内 Map，键 → 该键最近若干次请求的时间戳。
//
// 单机 SQLite 部署下够用，也符合这个项目的体量；多实例时要换成 SQLite 表或
// Redis，但只要 consume/peek 的签名不变，调用点不用改。

declare global {
  // dev 模式热重载会重新求值模块，挂到 globalThis 上避免计数被清空
  var __campusRateBuckets: Map<string, number[]> | undefined;
}

const BUCKETS: Map<string, number[]> = (globalThis.__campusRateBuckets ??= new Map());

// 最长窗口是 1 小时，超过这个时间没动静的键可以整条丢弃
const MAX_WINDOW_MS = 60 * 60_000;
let opsSinceSweep = 0;

function sweep(now: number): void {
  opsSinceSweep += 1;
  if (opsSinceSweep < 500) return;
  opsSinceSweep = 0;
  for (const [key, hits] of BUCKETS) {
    if (hits.length === 0 || hits[hits.length - 1] < now - MAX_WINDOW_MS) BUCKETS.delete(key);
  }
}

/** 只查不记账：用于「先看锁没锁」的场景。 */
export function peek(key: string, rule: RateLimitRule, now: number = Date.now()): RateLimitState {
  return evaluate(BUCKETS.get(key) ?? [], rule, now);
}

/** 记账并返回结果；被拒时不写入，避免持续请求把窗口不断往后推。 */
export function consume(
  key: string,
  rule: RateLimitRule,
  now: number = Date.now(),
): RateLimitState {
  const live = pruneHits(BUCKETS.get(key) ?? [], now, rule.windowMs);
  const before = evaluate(live, rule, now);
  if (!before.ok) {
    BUCKETS.set(key, live);
    sweep(now);
    return before;
  }
  live.push(now);
  BUCKETS.set(key, live);
  sweep(now);
  return {
    ok: true,
    used: live.length,
    remaining: Math.max(0, rule.limit - live.length),
    retryAfterMs: 0,
  };
}

export function resetKey(key: string): void {
  BUCKETS.delete(key);
}

/** 测试用：清空全部计数。 */
export function resetAll(): void {
  BUCKETS.clear();
  opsSinceSweep = 0;
}

export function rateLimitedResponse(
  state: RateLimitState,
  message = '操作太频繁',
): NextResponse {
  const seconds = retryAfterSeconds(state.retryAfterMs);
  return NextResponse.json(
    {
      ok: false,
      code: 'RATE_LIMITED',
      message: `${message}，请 ${seconds} 秒后再试`,
      retryAfter: seconds,
    },
    { status: 429, headers: { 'Retry-After': String(seconds) } },
  );
}

// ---- 登录 / 注册 ----

/**
 * 登录前置检查：被锁就返回 429，否则返回 null（放行）。
 * 只 peek 不记账——只有真正失败时才 consume，成功要清零。
 */
export function checkLoginLock(req: Request, username: string): NextResponse | null {
  const ip = clientIp(req.headers);
  const { userKey, ipKey } = loginBuckets(username, ip);
  const byUser = peek(userKey, RULES.loginUser);
  if (!byUser.ok) return rateLimitedResponse(byUser, '密码错误次数过多，账号已临时锁定');
  const byIp = peek(ipKey, RULES.loginIp);
  if (!byIp.ok) return rateLimitedResponse(byIp, '尝试次数过多');
  return null;
}

/** 登录失败记账：用户维度 + IP 维度各记一次。 */
export function recordLoginFailure(req: Request, username: string): void {
  const ip = clientIp(req.headers);
  const { userKey, ipKey } = loginBuckets(username, ip);
  consume(userKey, RULES.loginUser);
  consume(ipKey, RULES.loginIp);
}

/** 登录成功清零用户维度的失败计数（IP 维度保留，防止拿一个正确账号洗白撞库记录）。 */
export function clearLoginFailure(req: Request, username: string): void {
  const ip = clientIp(req.headers);
  resetKey(loginBuckets(username, ip).userKey);
}

export function checkRegisterLimit(req: Request): NextResponse | null {
  const ip = clientIp(req.headers);
  const state = consume(`register:ip:${ip}`, RULES.registerIp);
  return state.ok ? null : rateLimitedResponse(state, '注册太频繁');
}

// ---- AI 接口 ----

export type AiScope = 'search' | 'write';

/**
 * AI 额度：登录用户按 userId 计，匿名（仅 search 可达）按 IP 计。
 * 返回非 null 表示应当直接回这个 429。
 */
export function guardAi(
  req: Request,
  opts: { userId: number | null; scope: AiScope },
): NextResponse | null {
  const ip = clientIp(req.headers);
  const key = aiBucket(opts.scope, opts.userId, ip);

  if (!opts.userId) {
    // 匿名只有搜索，且更紧；小时桶不记账，避免匿名用户长期占用
    const minute = consume(`${key}:m`, RULES.anonSearchMinute);
    return minute.ok ? null : rateLimitedResponse(minute, '演示用搜索额度已用完，请登录后继续');
  }

  const minuteRule = opts.scope === 'search' ? RULES.searchMinute : RULES.aiMinute;
  const hourRule = opts.scope === 'search' ? RULES.searchHour : RULES.aiHour;

  const minute = consume(`${key}:m`, minuteRule);
  if (!minute.ok) return rateLimitedResponse(minute, 'AI 请求太频繁');
  const hour = consume(`${key}:h`, hourRule);
  if (!hour.ok) return rateLimitedResponse(hour, '这一小时的 AI 额度已用完');
  return null;
}
