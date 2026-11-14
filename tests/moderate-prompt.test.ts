import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildModerateLogText, buildModeratePrompt } from '../src/lib/ai/prompts.ts';

const IMG = 'data:image/png;base64,AAAA';

function textOf(prompt: ReturnType<typeof buildModeratePrompt>): string {
  return prompt.user
    .map((part) => (part.type === 'text' ? part.text : '[img]'))
    .join('\n');
}

test('审核 prompt 覆盖六类违规与平台定位', () => {
  const text = textOf(buildModeratePrompt('高数上册', '八成新，笔记齐全'));
  for (const key of ['prohibited', 'dangerous', 'medical', 'animal', 'indecent', 'offcampus']) {
    assert.ok(text.includes(key), `缺少类别 ${key}`);
  }
  assert.ok(text.includes('校内'));
  assert.ok(text.includes('药品'));
  assert.ok(text.includes('活体动物'));
});

test('审核 prompt 强制 JSON 且字段齐全', () => {
  const text = textOf(buildModeratePrompt('', ''));
  for (const field of ['"pass"', '"category"', '"reason"', '"confidence"']) {
    assert.ok(text.includes(field), `缺少字段 ${field}`);
  }
  assert.ok(text.includes('50 字'));
  assert.ok(!text.includes('```'), 'prompt 里不该出现代码块示例');
});

test('标题与描述都进 prompt，空值有占位', () => {
  const text = textOf(buildModeratePrompt('宿舍小风扇', '九成新，三档风速'));
  assert.ok(text.includes('宿舍小风扇'));
  assert.ok(text.includes('九成新，三档风速'));

  const empty = textOf(buildModeratePrompt('', ''));
  assert.ok(empty.includes('（未填写）'));
});

test('有图才有多模态片段，无图只有文本', () => {
  const withImg = buildModeratePrompt('高数', '封面如图', IMG);
  assert.equal(withImg.user.length, 2);
  assert.equal(withImg.user[0].type, 'image_url');

  const noImg = buildModeratePrompt('高数', '封面如图');
  assert.equal(noImg.user.length, 1);
  assert.equal(noImg.user[0].type, 'text');
});

test('留痕文本不把 base64 写进日志', () => {
  const prompt = buildModeratePrompt('高数', '封面如图', IMG);
  const log = buildModerateLogText(prompt);
  assert.ok(!log.includes('base64,AAAA'));
  assert.ok(log.includes('图片 dataURL'));
  assert.ok(log.includes('高数'));
});
