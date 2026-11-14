import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DONATE_BASE_WEIGHT,
  matchLabelOf,
  relevanceScore,
} from '../src/lib/search-score.ts';

test('匹配度分档按 0.75 / 0.6 切', () => {
  assert.equal(matchLabelOf(0.91), '高度匹配');
  assert.equal(matchLabelOf(0.75), '高度匹配');
  assert.equal(matchLabelOf(0.74), '较匹配');
  assert.equal(matchLabelOf(0.6), '较匹配');
  assert.equal(matchLabelOf(0.59), '相关');
});

test('转售物品不打业务加权', () => {
  assert.equal(relevanceScore(0.62, { mode: 'sale' }), 0.62);
  assert.equal(relevanceScore(0.62, { mode: 'sale', aidBoost: 0.3 }), 0.62);
});

test('捐赠物品加 0.15，帮扶生再加 0.30', () => {
  assert.equal(relevanceScore(0.5, { mode: 'donate' }), 0.5 + DONATE_BASE_WEIGHT);
  assert.equal(
    relevanceScore(0.5, { mode: 'donate', aidBoost: 0.3 }),
    0.5 + DONATE_BASE_WEIGHT + 0.3,
  );
});

test('加权能改变排序但不改变 similarity 本身', () => {
  const sim = 0.64;
  const sale = relevanceScore(sim, { mode: 'sale' });
  const donate = relevanceScore(sim, { mode: 'donate', aidBoost: 0.3 });
  assert.ok(donate > sale);
  assert.equal(matchLabelOf(sim), '较匹配');
});

test('相似度低于门槛时不叠加公益加权，避免无关捐赠刷屏', () => {
  // 0.42 属于「相关」但不沾边，加权会让它越过真正匹配的教材，所以不生效
  assert.equal(relevanceScore(0.42, { mode: 'donate', aidBoost: 0.3 }), 0.42);
  // 刚好到门槛则生效
  assert.equal(
    relevanceScore(0.5, { mode: 'donate' }),
    0.5 + DONATE_BASE_WEIGHT,
  );
});
