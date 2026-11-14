import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAnalyzeLogText, buildAnalyzePrompt } from '../src/lib/ai/prompts.ts';

const IMG = 'data:image/png;base64,AAAA';

function textOf(prompt: ReturnType<typeof buildAnalyzePrompt>): string {
  const part = prompt.user.find((p) => p.type === 'text');
  return part && part.type === 'text' ? part.text : '';
}

test('转售 prompt 要求估价，不要求公益标签', () => {
  const t = textOf(buildAnalyzePrompt('高数上下册', 'sale'));
  assert.ok(t.includes('"priceRange"'));
  assert.ok(t.includes('"priceReason"'));
  assert.ok(!t.includes('"donateTag"'));
});

test('捐赠 prompt 只要公益标签，不要估价', () => {
  const t = textOf(buildAnalyzePrompt('一床冬被', 'donate'));
  assert.ok(t.includes('"donateTag"'));
  // 只要求「结构里没有估价字段」，规则里提一句「不要输出 priceRange」是允许的
  assert.ok(!t.includes('"priceRange"'));
  assert.ok(!t.includes('"priceReason"'));
  assert.ok(!t.includes('定价参考'));
});

test('转售 prompt 注入定价参考上下文', () => {
  const ctx = '定价参考（仅供估算，不得复述为真实成交数据）：\n- 教材：本校历史成交 5 件，均价 17 元，区间 [10, 26] 元。';
  const t = textOf(buildAnalyzePrompt('高数上下册', 'sale', undefined, ctx));
  assert.ok(t.includes('本校历史成交 5 件'));
});

test('有图时图片在前、文字在后', () => {
  const p = buildAnalyzePrompt('台灯', 'sale', IMG);
  assert.deepEqual(
    p.user.map((x) => x.type),
    ['image_url', 'text'],
  );
});

test('无图时只有文字，便于纯文本降级', () => {
  const p = buildAnalyzePrompt('台灯', 'sale');
  assert.deepEqual(
    p.user.map((x) => x.type),
    ['text'],
  );
});

test('落库 prompt 不含 base64', () => {
  const log = buildAnalyzeLogText(buildAnalyzePrompt('台灯', 'sale', IMG));
  assert.ok(!log.includes(IMG));
  assert.ok(log.includes('已省略'));
  assert.ok(log.includes('用户的一句话描述：「台灯」'));
});
