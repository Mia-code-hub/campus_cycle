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
