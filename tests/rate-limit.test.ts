import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aiBucket,
  clientIp,
  evaluate,
  loginBuckets,
  normalizeLoginName,
  pruneHits,
  retryAfterSeconds,
  RULES,
} from '../src/lib/rate-limit.ts';

test('窗口裁剪只保留窗口内的记录', () => {
  const now = 100_000;
  const hits = [now - 61_000, now - 59_000, now - 1];
  assert.deepEqual(pruneHits(hits, now, 60_000), [now - 59_000, now - 1]);
});

test('未达上限放行，达到上限拒绝并给出等待时间', () => {
  const rule = { limit: 3, windowMs: 60_000 };
  const now = 1_000_000;

  assert.equal(evaluate([now - 10], rule, now).ok, true);
  assert.equal(evaluate([now - 30, now - 20], rule, now).remaining, 1);

  const blocked = evaluate([now - 30_000, now - 20_000, now - 10_000], rule, now);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.used, 3);
  assert.equal(blocked.remaining, 0);
  // 最早那条滑出窗口时才腾出位置
  assert.equal(blocked.retryAfterMs, 30_000);
});

test('窗口外的记录不参与计数', () => {
  const rule = { limit: 2, windowMs: 60_000 };
  const now = 5_000_000;
  const stale = [now - 120_000, now - 90_000, now - 70_000];
  assert.equal(evaluate(stale, rule, now).ok, true);
});

test('Retry-After 向上取整且至少 1 秒', () => {
  assert.equal(retryAfterSeconds(0), 1);
  assert.equal(retryAfterSeconds(1), 1);
  assert.equal(retryAfterSeconds(1000), 1);
  assert.equal(retryAfterSeconds(1001), 2);
  assert.equal(retryAfterSeconds(60_000), 60);
});

test('登录失败按「用户名 + IP」记账，不按用户名锁号', () => {
  const a = loginBuckets('Admin', '1.1.1.1');
  const b = loginBuckets('admin', '2.2.2.2');

  assert.equal(a.userKey, 'login:u:admin:1.1.1.1', '用户名大小写归一');
  assert.equal(a.ipKey, 'login:ip:1.1.1.1');
  assert.notEqual(a.userKey, b.userKey, '换 IP 不共享锁定，别人锁不了你的账号');
  assert.equal(b.userKey, 'login:u:admin:2.2.2.2');
  assert.equal(normalizeLoginName('  AReallyLongUserNameThatGoesOn  '), 'areallylongusernamethatgoeson');
});

test('clientIp 优先 x-real-ip，其次取 XFF 最左值', () => {
  const withReal = new Headers({ 'x-real-ip': '10.0.0.9', 'x-forwarded-for': '1.2.3.4' });
  assert.equal(clientIp(withReal), '10.0.0.9');

  const onlyFwd = new Headers({ 'x-forwarded-for': '5.6.7.8, 10.0.0.1' });
  assert.equal(clientIp(onlyFwd), '5.6.7.8');

  assert.equal(clientIp(new Headers()), 'local');
});

test('AI 桶：登录按 userId，匿名按 IP', () => {
  assert.equal(aiBucket('write', 9, '1.1.1.1'), 'ai:write:u:9');
  assert.equal(aiBucket('search', null, '1.1.1.1'), 'ai:search:ip:1.1.1.1');
});

test('规则常量符合本轮设定', () => {
  assert.equal(RULES.loginUser.limit, 5);
  assert.equal(RULES.loginUser.windowMs, 15 * 60_000);
  assert.equal(RULES.loginIp.limit, 20);
  assert.equal(RULES.registerIp.limit, 5);
  assert.equal(RULES.aiMinute.limit, 10);
  assert.equal(RULES.aiHour.limit, 30);
  assert.equal(RULES.anonSearchMinute.limit, 3, '匿名搜索收紧到 3 次/分');
  assert.ok(RULES.searchHour.limit > RULES.aiHour.limit, '搜索额度应比写操作宽松');
});
