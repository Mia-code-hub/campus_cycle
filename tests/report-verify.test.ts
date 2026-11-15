import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REPORT_MAX_CHARS,
  REPORT_MIN_CHARS,
  allowlistList,
  buildAllowlist,
  extractNumbers,
  normalizeNumber,
  retryHint,
  verifyReport,
} from '../src/lib/report/verify.ts';
import { countChars, normalizeReportText, toParagraphs } from '../src/lib/report/text.ts';

// 报告校验的关键行为钉在这里：
// 数字只能来自数据区、字数必须在 600-900、写法差异（7.10 / 7.1）不算失败、
// 四舍五入过的数字（7.15 → 7.2）必须算失败。

const SOURCE = [
  '累计完成流转 9 件',
  '折算重量 7.15 kg',
  '减碳量 15 kgCO₂e',
  '类别占比 33.3%',
  '类别占比 55.6%',
].join('\n');

// 一句合规的正文，重复到字数落进区间：字数由 countChars 现算，别写死重复次数
const SENTENCE = '本期完成流转 9 件，折算重量 7.15 kg，减碳量 15 kgCO₂e，类别占比 33.3% 与 55.6%。';
function bodyOf(target = 750): string {
  const per = countChars(SENTENCE);
  const times = Math.ceil(target / per);
  return Array.from({ length: times }, () => SENTENCE).join('\n\n');
}

test('数字归一化：前导零、末尾零、千分位都按同一个数处理', () => {
  assert.equal(normalizeNumber('07.10'), '7.1');
  assert.equal(normalizeNumber('1,234.50'), '1234.5');
  assert.equal(normalizeNumber('15.0'), '15');
  assert.equal(normalizeNumber('0.50'), '0.5');
  assert.equal(normalizeNumber('000'), '0');
  // 全角数字也认：模型偶尔输出「７．１５」
  assert.equal(normalizeNumber('７.１５'), '7.15');
});

test('数字抽取：小数、百分号、日期、千分位都能取出来', () => {
  const hits = extractNumbers('近 30 天 7.15 kg，占 33.3%，数据截至 2026-11-15，共 1,234 件').map(
    (h) => h.value,
  );
  assert.deepEqual(hits, ['30', '7.15', '33.3', '2026', '11', '15', '1234']);
});

test('白名单来自数据原文：数据区有的数字才放行', () => {
  const allow = buildAllowlist(SOURCE);
  assert.ok(allow.has('7.15'));
  assert.ok(allow.has('15'));
  assert.ok(allow.has('33.3'));
  assert.ok(!allow.has('7.2'));
  assert.ok(!allow.has('100'));

  const list = allowlistList(SOURCE);
  // 按数值升序，prompt 里列出来给人看
  assert.deepEqual(list, ['7.15', '9', '15', '33.3', '55.6']);
});

test('校验通过：字数达标且数字全部来自数据区', () => {
  const body = bodyOf();
  const check = verifyReport(body, { source: SOURCE });
  assert.equal(check.ok, true, check.summary);
  assert.ok(check.charCount >= REPORT_MIN_CHARS && check.charCount <= REPORT_MAX_CHARS);
  assert.equal(check.unmatched.length, 0);
  assert.equal(check.totalNumbers > 0, true);
});

test('校验不通过：编造的数字会被点名', () => {
  const body = `${bodyOf()}\n\n另有 57 件物资在途。`;
  const check = verifyReport(body, { source: SOURCE });
  assert.equal(check.ok, false);
  assert.equal(check.unmatched.length, 1);
  assert.equal(check.unmatched[0].value, '57');
  assert.match(check.summary, /57/);
  assert.deepEqual(check.issues.length, 1);
});

test('校验不通过：四舍五入过的数字也不算原样引用', () => {
  const body = bodyOf().replaceAll('7.15', '7.2');
  const check = verifyReport(body, { source: SOURCE });
  assert.equal(check.ok, false);
  assert.ok(check.unmatched.some((u) => u.value === '7.2'));
});

test('校验不通过：字数越界单独报错，不与数字错误混在一起', () => {
  const short = '本期完成流转 9 件，折算重量 7.15 kg。';
  const shortCheck = verifyReport(short, { source: SOURCE });
  assert.equal(shortCheck.ok, false);
  assert.equal(shortCheck.unmatched.length, 0);
  assert.equal(shortCheck.issues.length, 1);
  assert.match(shortCheck.issues[0], /少于 600/);

  const long = `${bodyOf(1200)}`;
  const longCheck = verifyReport(long, { source: SOURCE });
  assert.equal(longCheck.ok, false);
  assert.match(longCheck.issues[0], /超过 900/);
});

test('重写提示点名具体数字与字数，模型第二版才知道改哪里', () => {
  const body = `${bodyOf(400)} 还有 42 件待处理。`;
  const check = verifyReport(body, { source: SOURCE });
  const hint = retryHint(check);
  assert.match(hint, /42/);
  assert.match(hint, /少于 600|只有/);
});

test('正文清洗：Markdown 结构去掉，正文与数字保留', () => {
  const raw = '```\n## 一、总量\n\n- 完成流转 9 件\n1. 折算重量 7.15 kg\n```';
  const text = normalizeReportText(raw);
  assert.equal(text, '一、总量\n\n完成流转 9 件\n折算重量 7.15 kg');
  // 列表序号被去掉，所以不会被数字校验当成 1、2 这样的新数字
  const hits = extractNumbers(text).map((h) => h.value);
  assert.deepEqual(hits, ['9', '7.15']);
  assert.deepEqual(toParagraphs(text), ['一、总量', '完成流转 9 件\n折算重量 7.15 kg'].map((s) =>
    s.replace(/\n/g, ''),
  ));
});

test('字数口径：去掉空白后的字符数，含标点', () => {
  assert.equal(countChars('一二三'), 3);
  assert.equal(countChars('一二 三\n四'), 4);
  assert.equal(countChars('完成 9 件。'), 5);
});
