import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REF_PRICE, buildPriceContext } from '../src/lib/ref-price.ts';

test('样本足够时用历史成交统计', () => {
  const ctx = buildPriceContext({
    stats: {
      textbook: { count: 5, avg: 17, min: 10, max: 26, insufficient: false },
    },
    refPrice: REF_PRICE,
  });
  assert.match(ctx, /教材：本校历史成交 5 件，均价 17 元，区间 \[10, 26\] 元/);
});

test('样本不足或缺失时回落到经验区间', () => {
  const ctx = buildPriceContext({
    stats: {
      textbook: { count: 2, avg: 15, min: 12, max: 18, insufficient: true },
    },
    refPrice: REF_PRICE,
  });
  assert.match(ctx, /教材：无足够成交样本，参考经验区间 \[8, 30\] 元/);
  assert.match(ctx, /小家电：无足够成交样本/);
});

test('明确标注不得当作真实成交数据', () => {
  const ctx = buildPriceContext({ stats: {}, refPrice: REF_PRICE });
  assert.match(ctx, /不得复述为真实成交数据/);
  assert.ok(ctx.includes('教材') && ctx.includes('其他'));
});
