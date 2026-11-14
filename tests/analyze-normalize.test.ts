import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAnalyzeOutput } from '../src/lib/ai/analyze.ts';

const CATS = ['textbook', 'bedding', 'stationery', 'appliance', 'daily', 'clothing', 'other'];
const CONDS = ['95新', '9成新', '8成新', '可用'];

test('合法输出原样保留', () => {
  const out = normalizeAnalyzeOutput(
    {
      category: 'textbook',
      conditionLevel: '9成新',
      title: '高等数学上下册',
      aiDesc: '高等数学上下册一套，书页整洁，有少量笔记。',
      tags: ['教材', '数学'],
    },
    CATS,
    CONDS,
  );
  assert.deepEqual(out, {
    category: 'textbook',
    conditionLevel: '9成新',
    title: '高等数学上下册',
    aiDesc: '高等数学上下册一套，书页整洁，有少量笔记。',
    tags: ['教材', '数学'],
  });
});

test('非法枚举归为 other / 可用', () => {
  const out = normalizeAnalyzeOutput(
    { category: '数码', conditionLevel: '全新', title: '台灯', aiDesc: '台灯一盏。' },
    CATS,
    CONDS,
  );
  assert.equal(out?.category, 'other');
  assert.equal(out?.conditionLevel, '可用');
});

test('标题去引号换行并截断到 22 字', () => {
  const long = '「' + '这是一个特别特别长的标题'.repeat(3) + '」';
  const out = normalizeAnalyzeOutput(
    { category: 'daily', conditionLevel: '8成新', title: long, aiDesc: 'x' },
    CATS,
    CONDS,
  );
  assert.equal(out?.title.length, 22);
  assert.ok(!out?.title.includes('「'));
  assert.ok(!out?.title.includes('\n'));
});

test('标签去重、去 #、限 6 个且每个不超过 6 字', () => {
  const out = normalizeAnalyzeOutput(
    {
      category: 'appliance',
      conditionLevel: '可用',
      title: '台灯',
      aiDesc: '台灯一盏，功能正常。',
      tags: ['#台灯', '台灯', '宿舍照明用', 'a', 'b', 'c', 'd', 'e'],
    },
    CATS,
    CONDS,
  );
  assert.deepEqual(out?.tags, ['台灯', '宿舍照明用', 'a', 'b', 'c', 'd']);
});

test('标题与文案都为空视为无产出', () => {
  assert.equal(normalizeAnalyzeOutput({ category: 'other' }, CATS, CONDS), null);
  assert.equal(normalizeAnalyzeOutput(null, CATS, CONDS), null);
  assert.equal(normalizeAnalyzeOutput('字符串', CATS, CONDS), null);
  assert.equal(normalizeAnalyzeOutput([], CATS, CONDS), null);
});

test('参考价：字符串数字转整数', () => {
  const out = normalizeAnalyzeOutput(
    {
      category: 'textbook',
      conditionLevel: '9成新',
      title: '高数',
      aiDesc: '高数上下册。',
      priceRange: { low: '12', high: '22.4', suggested: '16' },
      priceReason: '9成新教材带笔记',
    },
    CATS,
    CONDS,
  );
  assert.deepEqual(out?.priceRange, { low: 12, high: 22, suggested: 16 });
  assert.equal(out?.priceReason, '9成新教材带笔记');
});

test('参考价：low/high 颠倒自动纠正，suggested 越界收敛到区间内', () => {
  const out = normalizeAnalyzeOutput(
    {
      category: 'appliance',
      conditionLevel: '可用',
      title: '台灯',
      aiDesc: '台灯一盏。',
      priceRange: { low: 30, high: 10, suggested: 99 },
    },
    CATS,
    CONDS,
  );
  assert.deepEqual(out?.priceRange, { low: 10, high: 30, suggested: 30 });
});

test('参考价：结构不成立整段丢弃，不显示错的区间', () => {
  const base = { category: 'daily', conditionLevel: '8成新', title: '水杯', aiDesc: '水杯一个。' };
  const cases = [
    { low: 20, high: 20, suggested: 20 }, // 区间为零
    { low: 0, high: 20, suggested: 10 }, // low 非法
    { low: 10, high: 20 }, // 缺 suggested
    { low: 'abc', high: 20, suggested: 15 },
    null,
    [1, 2, 3],
  ];
  for (const priceRange of cases) {
    const out = normalizeAnalyzeOutput({ ...base, priceRange }, CATS, CONDS);
    assert.equal(out?.priceRange, undefined, JSON.stringify(priceRange));
  }
});

test('定价依据截断到 40 字', () => {
  const out = normalizeAnalyzeOutput(
    {
      category: 'daily',
      conditionLevel: '8成新',
      title: '水杯',
      aiDesc: '水杯一个。',
      priceReason: '这是一段很长的定价依据说明'.repeat(6),
    },
    CATS,
    CONDS,
  );
  assert.equal(out?.priceReason?.length, 40);
});

test('公益标签去格式字符并截断，空值不返回该字段', () => {
  const tag = normalizeAnalyzeOutput(
    {
      category: 'textbook',
      conditionLevel: '9成新',
      title: '高数',
      aiDesc: '高数上下册。',
      donateTag: '「教材援助 · 让知识继续流转」',
    },
    CATS,
    CONDS,
  );
  assert.equal(tag?.donateTag, '教材援助 · 让知识继续流转');

  const empty = normalizeAnalyzeOutput(
    { category: 'textbook', conditionLevel: '9成新', title: '高数', aiDesc: 'x', donateTag: '  ' },
    CATS,
    CONDS,
  );
  assert.equal(empty?.donateTag, undefined);
});
