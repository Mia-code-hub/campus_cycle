import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeParseJson } from '../src/lib/ai/json.ts';

test('直接 JSON 对象', () => {
  assert.deepEqual(safeParseJson('{"category":"textbook"}'), { category: 'textbook' });
});

test('```json 代码块包裹', () => {
  const raw = '```json\n{"category":"bedding","title":"旧棉被"}\n```';
  assert.deepEqual(safeParseJson(raw), { category: 'bedding', title: '旧棉被' });
});

test('前后夹带解释文字', () => {
  const raw = '好的，以下是识别结果：\n{"category":"appliance"}\n希望对你有帮助。';
  assert.deepEqual(safeParseJson(raw), { category: 'appliance' });
});

test('字符串内包含括号与引号不误判', () => {
  const raw = '解释 {"title":"高数{上}下册","tags":["a}","b"]} 结束';
  assert.deepEqual(safeParseJson(raw), { title: '高数{上}下册', tags: ['a}', 'b'] });
});

test('数组形式也能解析', () => {
  assert.deepEqual(safeParseJson('前缀 ["a","b"] 后缀'), ['a', 'b']);
});

test('解析失败返回 null 不抛异常', () => {
  assert.equal(safeParseJson('这不是 JSON'), null);
  assert.equal(safeParseJson(''), null);
});
