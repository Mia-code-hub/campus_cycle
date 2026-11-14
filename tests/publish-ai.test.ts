import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiEditedCode, badgeFor, type AiFill } from '../src/lib/publish-ai.ts';

const filled: AiFill = {
  category: 'textbook',
  condition: '9成新',
  title: '高等数学上下册',
  aiDesc: '书页整洁，有少量笔记。',
  tags: ['教材', '数学'],
};

const same: AiFill = { ...filled, tags: [...filled.tags] };

test('AI 回填后未改动，字段显示「AI」', () => {
  assert.equal(badgeFor(filled, same, 'title'), 'AI');
  assert.equal(badgeFor(filled, same, 'tags'), 'AI');
});

test('用户改动后变「已修改」，其他字段仍是「AI」', () => {
  const edited = { ...same, title: '高数上下册（自填）' };
  assert.equal(badgeFor(filled, edited, 'title'), '已修改');
  assert.equal(badgeFor(filled, edited, 'category'), 'AI');
});

test('标签增删也判为改动', () => {
  assert.equal(badgeFor(filled, { ...same, tags: ['教材'] }, 'tags'), '已修改');
  assert.equal(badgeFor(filled, { ...same, tags: ['数学', '教材'] }, 'tags'), '已修改');
});

test('清空 AI 填的字段算改动', () => {
  assert.equal(badgeFor(filled, { ...same, aiDesc: '  ' }, 'aiDesc'), '已修改');
});

test('没用 AI 时没有徽章', () => {
  assert.equal(badgeFor(null, same, 'title'), null);
});

test('AI 没给出的字段不长徽章', () => {
  const partial: AiFill = { category: 'other', condition: '可用', title: '台灯', aiDesc: '', tags: [] };
  const cur: AiFill = { ...partial, aiDesc: '用户自己写的', tags: ['台灯'] };
  assert.equal(badgeFor(partial, cur, 'aiDesc'), null);
  assert.equal(badgeFor(partial, cur, 'tags'), null);
});

test('ai_edited 取值：0 未用 AI / 1 未改 / 2 改过', () => {
  assert.equal(aiEditedCode(null, same), 0);
  assert.equal(aiEditedCode(filled, same), 1);
  assert.equal(aiEditedCode(filled, { ...same, category: 'daily' }), 2);
});
