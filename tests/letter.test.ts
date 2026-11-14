import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LETTER_SIGNATURE,
  composeTemplateLetter,
  countLetters,
  ensureSignature,
  findLabelTerms,
  letterDate,
  normalizeLetterText,
  retryHint,
  validateLetter,
  type LetterContext,
} from '../src/lib/letter.ts';

const CTX: LetterContext = {
  donorNickname: '学长小林',
  receiverName: null,
  itemTitle: '高等数学 上册（有笔记）',
  categoryText: '教材',
  conditionText: '8成新',
  donatedAt: '2026年11月14日',
  weightKg: 1.2,
};

const GOOD = [
  '你好，学长小林：',
  '',
  '你送出的《高等数学 上册》已经交到一位同学手里。书页干净，笔记都在，接下来会继续被人翻着用——大概率是在期末前的自习室里，被摊在桌角，旁边压着一杯放凉了的速溶咖啡。',
  '',
  '写这封信只是想让你知道它的去向：它没有被塞进柜子深处，也没有被当成废纸卖掉，只是换了一位主人，继续做它本来该做的事。校内每年都有不少还能用的东西被闲置，一次转交就少一件被浪费的物品。',
  '',
  '等哪天你手里又有用不上的东西，记得这里还开着门。',
  '',
  LETTER_SIGNATURE,
  '2026年11月14日',
].join('\n');

test('字数统计不计空白', () => {
  assert.equal(countLetters('你好 世界\n'), 4);
  assert.equal(countLetters('  '), 0);
});

test('归一化去掉代码块、Markdown 与开场白', () => {
  const raw = '好的，这是感谢信：\n\n```text\n**你好**，同学：\n\n# 感谢\n```';
  const out = normalizeLetterText(raw);
  assert.ok(!out.includes('```'));
  assert.ok(!out.includes('**'));
  assert.ok(!out.includes('好的'));
  assert.ok(out.startsWith('你好，同学：'));
});

test('漏写落款时补上平台名与日期', () => {
  const out = ensureSignature('正文一段。', '2026年11月14日');
  assert.ok(out.includes(LETTER_SIGNATURE));
  assert.ok(out.endsWith('2026年11月14日'));
  // 已有落款不重复追加
  assert.equal(ensureSignature(GOOD, '2026年11月14日'), GOOD);
});

test('合格信件通过校验', () => {
  const check = validateLetter(GOOD, {
    anonymous: true,
    receiverName: '帮扶生小周',
    college: '计算机学院',
    grade: '2026级',
  });
  assert.equal(check.ok, true, JSON.stringify(check.issues));
  assert.equal(check.labels.length, 0);
  assert.equal(check.leaked.length, 0);
});

test('标签化词会被拦下', () => {
  assert.deepEqual(findLabelTerms('谢谢你对贫困同学的资助'), ['贫困', '资助']);
  const check = validateLetter(`${GOOD}\n\n说实话，我家条件困难。`, { anonymous: true });
  assert.ok(check.issues.includes('sensitive_label'));
  assert.ok(check.labels.includes('困难'));
});

test('匿名信出现受赠人昵称或学院即判泄露', () => {
  const withName = validateLetter(`${GOOD}\n\n我是帮扶生小周。`, {
    anonymous: true,
    receiverName: '帮扶生小周',
  });
  assert.ok(withName.issues.includes('leaked_identity'));

  const withCollege = validateLetter(`${GOOD}\n\n我在计算机学院。`, {
    anonymous: false,
    receiverName: '帮扶生小周',
    college: '计算机学院',
  });
  assert.ok(withCollege.issues.includes('leaked_identity'));
});

test('过短过长都判不合格', () => {
  assert.ok(validateLetter('谢谢。', { anonymous: true }).issues.includes('too_short'));
  const long = '你'.repeat(500) + `\n\n${LETTER_SIGNATURE}`;
  assert.ok(validateLetter(long, { anonymous: true }).issues.includes('too_long'));
});

test('重试提示指出具体问题', () => {
  const check = validateLetter(`${GOOD}\n\n家里困难。`, { anonymous: true });
  const hint = retryHint(check);
  assert.ok(hint.includes('困难'));
  assert.ok(hint.startsWith('重写要求'));
});

test('模板兜底信满足字数与禁用词约束，且不含身份信息', () => {
  const text = composeTemplateLetter(CTX);
  const check = validateLetter(text, {
    anonymous: true,
    receiverName: '帮扶生小周',
    college: '计算机学院',
    grade: '2026级',
  });
  assert.equal(check.ok, true, JSON.stringify(check.issues));
  assert.equal(countLetters(text) >= 200, true);
  assert.equal(countLetters(text) <= 300, true);
  assert.ok(text.includes('一位同学'));
  assert.ok(text.includes(LETTER_SIGNATURE));
});

test('模板在非匿名时用昵称，匿名时永远不出现昵称', () => {
  assert.ok(composeTemplateLetter(CTX).includes('一位同学'));
  assert.ok(!composeTemplateLetter(CTX).includes('帮扶生小周'));
  const named = composeTemplateLetter({ ...CTX, receiverName: '新生小陈' });
  assert.ok(named.includes('新生小陈'));
});

test('日期转成中文年月日', () => {
  assert.equal(letterDate('2026-11-14'), '2026年11月14日');
  assert.equal(letterDate('2026-01-05'), '2026年1月5日');
  assert.equal(letterDate('2026年11月14日'), '2026年11月14日');
});
