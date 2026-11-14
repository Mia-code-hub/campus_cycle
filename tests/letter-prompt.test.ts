import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLetterLogText, buildLetterPrompt } from '../src/lib/ai/prompts.ts';

const ANON = {
  donorNickname: '学长小林',
  receiverName: null,
  itemTitle: '高等数学 上册（有笔记）',
  categoryText: '教材',
  conditionText: '8成新',
  donatedAt: '2026年11月14日',
  weightKg: 1.2,
};

test('感谢信 prompt 覆盖字数、落款与事实边界', () => {
  const { system, user } = buildLetterPrompt(ANON);
  const all = `${system}\n${user}`;
  assert.ok(all.includes('200-300 字'));
  assert.ok(all.includes('校园闲置物资循环平台'));
  assert.ok(all.includes('《高等数学 上册（有笔记）》'));
  assert.ok(all.includes('教材'));
  assert.ok(all.includes('8成新'));
  assert.ok(all.includes('2026年11月14日'));
  assert.ok(all.includes('1.2 kg'));
  assert.ok(user.includes('只能使用这些事实'));
});

test('感谢信 prompt 明令禁止标签化词与内部术语', () => {
  const all = `${buildLetterPrompt(ANON).system}\n${buildLetterPrompt(ANON).user}`;
  for (const term of ['贫困', '困难', '资助', '帮扶']) {
    assert.ok(all.includes(term), `缺少禁用词 ${term}`);
  }
  assert.ok(all.includes('AI'));
  assert.ok(all.includes('模型'));
});

test('匿名受赠人：prompt 里不出现昵称，并要求自称「一位同学」', () => {
  const all = `${buildLetterPrompt(ANON).system}\n${buildLetterPrompt(ANON).user}`;
  assert.ok(all.includes('匿名'));
  assert.ok(all.includes('一位同学'));
  assert.ok(!all.includes('帮扶生小周'));
  assert.ok(!all.includes('计算机学院'));
});

test('非匿名受赠人：可署昵称但仍禁止学院与年级', () => {
  const named = buildLetterPrompt({ ...ANON, receiverName: '新生小陈' });
  assert.ok(named.user.includes('新生小陈'));
  assert.ok(named.user.includes('学院、年级'));
});

test('重试提示会拼进 user，并保留事实段', () => {
  const p = buildLetterPrompt(ANON, '重写要求：上一版只有 120 字，太短。');
  assert.ok(p.user.includes('上一版只有 120 字'));
  assert.ok(p.user.includes('《高等数学 上册（有笔记）》'));
});

test('log 快照含 system 与 user', () => {
  const p = buildLetterPrompt(ANON);
  const log = buildLetterLogText(p);
  assert.ok(log.startsWith(p.system));
  assert.ok(log.includes(p.user));
});
