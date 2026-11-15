import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkSecret,
  decodePayload,
  encodePayload,
  formatToken,
  isExpired,
  MIN_SECRET_LENGTH,
  parseToken,
  type SessionPayload,
} from '../src/lib/session-token.ts';

const BASE: SessionPayload = { uid: 7, iat: 1_700_000_000, exp: 1_700_604_800, jti: 'abc-def-12345678' };

test('payload 编解码往返，且是 base64url 字符集', () => {
  const b64 = encodePayload(BASE);
  assert.match(b64, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodePayload(b64), BASE);
});

test('结构不合法的 payload 一律拒绝', () => {
  const bad = (obj: unknown) => decodePayload(Buffer.from(JSON.stringify(obj)).toString('base64url'));
  assert.equal(bad({ ...BASE, uid: 0 }), null, 'uid 必须为正');
  assert.equal(bad({ ...BASE, uid: -3 }), null);
  assert.equal(bad({ ...BASE, uid: 1.5 }), null, 'uid 必须整数');
  assert.equal(bad({ ...BASE, exp: BASE.iat }), null, 'exp 不能等于 iat');
  assert.equal(bad({ ...BASE, exp: BASE.iat - 1 }), null, 'exp 不能早于 iat');
  assert.equal(bad({ ...BASE, jti: 'short' }), null, 'jti 太短');
  assert.equal(bad({ ...BASE, jti: '带中文的-jti-1234' }), null, 'jti 只允许字母数字与连字符');
  assert.equal(decodePayload('not-base64!'), null, '非法字符');
  assert.equal(decodePayload(Buffer.from('not json').toString('base64url')), null);
});

test('parseToken 只认 v1 三段式，旧格式与改版本号都拒绝', () => {
  const sig = 'a'.repeat(64);
  const parsed = parseToken(formatToken('abc', sig));
  assert.ok(parsed);
  assert.equal(parsed!.version, 'v1');
  assert.equal(parsed!.signed, 'v1.abc');

  assert.equal(parseToken('7.deadbeef'), null, 'R19 的 userId.sig 旧格式必须失效');
  assert.equal(parseToken(`v2.abc.${sig}`), null);
  assert.equal(parseToken(`v1.abc.${sig}x`), null, '签名长度不对');
  assert.equal(parseToken('v1.ab$c.' + sig), null, 'payload 含非法字符');
  assert.equal(parseToken(`v1.abc.${sig}.extra`), null, '多一段也不行');
  assert.equal(parseToken(null), null);
});

test('过期按秒比较，边界那一秒即失效', () => {
  assert.equal(isExpired(BASE, BASE.exp - 1), false);
  assert.equal(isExpired(BASE, BASE.exp), true);
  assert.equal(isExpired(BASE, BASE.exp + 10_000), true);
});

test('弱密钥在启动校验里被拦下', () => {
  assert.deepEqual(checkSecret(''), { ok: false, reason: 'missing' });
  assert.deepEqual(checkSecret(undefined), { ok: false, reason: 'missing' });
  assert.deepEqual(checkSecret('short-secret'), { ok: false, reason: 'too_short' });
  assert.deepEqual(checkSecret('change-me-please-' + 'x'.repeat(32)), { ok: false, reason: 'placeholder' });
  assert.equal(checkSecret('x'.repeat(MIN_SECRET_LENGTH)).ok, true);
  assert.equal(checkSecret('7Lk2qP0vR8sT4wYz1aBc3dEf5gHj6kMn9pQr2StU4vWx6Yz8').ok, true);
});
