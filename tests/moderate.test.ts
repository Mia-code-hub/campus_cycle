import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MODERATION_CATEGORIES,
  categoryText,
  decideModeration,
  normalizeCategory,
  normalizeModerationOutput,
} from '../src/lib/ai/moderate.ts';
import { RISK_CATEGORIES, type BannedHit } from '../src/lib/banned-terms.ts';

const HIT: BannedHit = {
  term: '消炎药',
  category: 'medical',
  label: '药品与医疗器械',
  hint: '平台禁止药品与医疗器械',
};

test('类别枚举与本地词表保持一致', () => {
  assert.deepEqual([...MODERATION_CATEGORIES], ['ok', ...RISK_CATEGORIES]);
  assert.equal(categoryText('medical'), '药品与医疗器械');
});

test('正常判词原样通过', () => {
  const v = normalizeModerationOutput({
    pass: true,
    category: 'ok',
    reason: '校内自用闲置，内容正常',
    confidence: 0.92,
  });
  assert.deepEqual(v, {
    pass: true,
    category: 'ok',
    reason: '校内自用闲置，内容正常',
    confidence: 0.92,
  });
});

test('类别别名与百分数置信度都能收敛', () => {
  assert.equal(normalizeCategory('SAFE'), 'ok');
  assert.equal(normalizeCategory('porn'), 'indecent');
  assert.equal(normalizeCategory('unknown-thing'), null);
  const v = normalizeModerationOutput({ pass: true, category: 'ok', confidence: 85 });
  assert.equal(v?.confidence, 0.85);
  const over = normalizeModerationOutput({ pass: false, category: 'medical', confidence: 1.7 });
  assert.equal(over?.confidence, 1);
});

test('pass 与 category 矛盾时以更严格的一方为准', () => {
  const a = normalizeModerationOutput({ pass: true, category: 'medical', reason: '疑似药品' });
  assert.equal(a?.pass, false);
  assert.equal(a?.category, 'medical');

  const b = normalizeModerationOutput({ pass: false, category: 'ok', reason: '不合规' });
  assert.equal(b?.pass, false);
  assert.equal(b?.category, 'prohibited');

  const c = normalizeModerationOutput({ pass: false, category: '乱七八糟', reason: '不合规' });
  assert.equal(c?.category, 'prohibited');

  // 只给 category 不给 pass：按 category 推
  assert.equal(normalizeModerationOutput({ category: 'animal' })?.pass, false);
  assert.equal(normalizeModerationOutput({ category: 'ok' })?.pass, true);
});

test('理由清掉 markdown 并截到 50 字以内，缺失时用类别兜底', () => {
  const long = normalizeModerationOutput({
    pass: false,
    category: 'offcampus',
    reason: `**${'疑似校外批量倒卖，同一账号短时间内挂出大量全新同款商品，'.repeat(4)}`,
  });
  assert.ok((long?.reason.length ?? 0) <= 50);
  assert.ok(!long?.reason.includes('*'));

  const empty = normalizeModerationOutput({ pass: false, category: 'dangerous' });
  assert.equal(empty?.reason, '判定为危险品');
  const okEmpty = normalizeModerationOutput({ pass: true, category: 'ok' });
  assert.equal(okEmpty?.reason, '未发现违规');
});

test('无法解析成判词时返回 null，交给上层走待复核', () => {
  for (const raw of ['字符串', 42, null, undefined, [], {}, { foo: 'bar' }]) {
    assert.equal(normalizeModerationOutput(raw), null);
  }
});

test('本地命中即使模型放行也拦截，并标记模型漏判', () => {
  const d = decideModeration({
    model: { pass: true, category: 'ok', reason: '未发现违规', confidence: 0.9 },
    local: [HIT],
  });
  assert.equal(d.pass, false);
  assert.equal(d.category, 'medical');
  assert.equal(d.engine, 'hybrid');
  assert.equal(d.conflict, true);
  assert.equal(d.pendingReview, false);
  assert.ok(d.reason.includes('消炎药'));
});

test('模型不可用时本地命中仍是纯本地拦截', () => {
  const d = decideModeration({ model: null, local: [HIT] });
  assert.equal(d.pass, false);
  assert.equal(d.engine, 'local');
  assert.equal(d.conflict, false);
});

test('只有模型判违规时按模型类别拦截', () => {
  const d = decideModeration({
    model: { pass: false, category: 'offcampus', reason: '疑似校外倒卖', confidence: 0.77 },
    local: [],
  });
  assert.equal(d.pass, false);
  assert.equal(d.category, 'offcampus');
  assert.equal(d.engine, 'model');
  assert.equal(d.reason, '疑似校外倒卖');
});

test('只有模型放行时正常通过', () => {
  const d = decideModeration({
    model: { pass: true, category: 'ok', reason: '正常', confidence: 0.8 },
    local: [],
  });
  assert.equal(d.pass, true);
  assert.equal(d.engine, 'model');
  assert.equal(d.pendingReview, false);
});

test('模型故障 + 本地无命中：放行但必须标记待人工复核', () => {
  const d = decideModeration({ model: null, local: [] });
  assert.equal(d.pass, true);
  assert.equal(d.engine, 'fallback');
  assert.equal(d.pendingReview, true);
  assert.equal(d.category, 'ok');
  assert.ok(d.reason.includes('人工复核'));
});
