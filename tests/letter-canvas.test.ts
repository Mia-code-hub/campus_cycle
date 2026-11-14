import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportFileName, wrapText } from '../src/lib/letter-canvas.ts';

// 每个字固定 10px 宽，方便断言断行位置
const measure = (s: string) => s.length * 10;

test('按最大宽度断行', () => {
  const lines = wrapText('一二三四五六七星', { maxWidth: 50, measure });
  assert.deepEqual(lines, ['一二三四五', '六七星']);
  assert.ok(lines.every((l) => measure(l) <= 50));
});

test('空行保留，用于段落间距', () => {
  const lines = wrapText('一\n\n二', { maxWidth: 50, measure });
  assert.deepEqual(lines, ['一', '', '二']);
});

test('标点不出现在行首（允许跟随溢出）', () => {
  const lines = wrapText('一二三四五，六', { maxWidth: 50, measure });
  assert.deepEqual(lines, ['一二三四五，', '六']);
});

test('开括号不被留在行尾', () => {
  const lines = wrapText('一二三四《五六', { maxWidth: 50, measure });
  // 贪心装到「一二三四《」正好 50，再加一个字就超宽，于是把《带到下一行
  assert.deepEqual(lines, ['一二三四', '《五六']);
  assert.equal(lines[0].endsWith('《'), false);
});

test('超长单词也能被强行切开，不会丢字', () => {
  const text = '字'.repeat(23);
  const lines = wrapText(text, { maxWidth: 70, measure });
  assert.equal(lines.join(''), text);
});

test('导出文件名去掉非法字符并限长', () => {
  assert.equal(exportFileName('高等数学 上册（有笔记）'), '感谢信-高等数学 上册（有笔记）.png');
  assert.ok(!exportFileName('a/b\\c:d*e?f"g<h>i|j').includes('/'));
  assert.equal(exportFileName('   '), '感谢信-捐赠.png');
  assert.ok(exportFileName('长'.repeat(60)).length <= '感谢信-.png'.length + 24);
});
