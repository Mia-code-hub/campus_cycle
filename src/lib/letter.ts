// 捐赠感谢信的文本规约：归一化、字数、标签化词与身份泄露检查、模板兜底。
// 刻意不 import 任何 @/ 模块（node:test 不认别名），全部是纯函数，方便直接跑单测。

export const LETTER_SIGNATURE = '校园闲置物资循环平台';

// prompt 里要求的字数区间（含落款）
export const LETTER_TARGET_MIN = 200;
export const LETTER_TARGET_MAX = 300;
// 服务端验收区间：给模型一点余量，超出的直接判 parse_error 重试
export const LETTER_ACCEPT_MIN = 180;
export const LETTER_ACCEPT_MAX = 340;

// 标签化、施舍感的词：信件里一旦出现就不允许展示
export const LABEL_TERMS = [
  '贫困',
  '困难',
  '资助',
  '低保',
  '建档立卡',
  '弱势',
  '帮扶',
  '补助',
  '救济',
  '寒门',
  '特困',
  '受助',
  '爱心人士',
];

export type LetterIssue =
  | 'too_short'
  | 'too_long'
  | 'sensitive_label'
  | 'leaked_identity'
  | 'missing_signature';

export interface LetterCheck {
  ok: boolean;
  length: number;
  issues: LetterIssue[];
  /** 命中的标签化词，用于重试时告诉模型改哪里 */
  labels: string[];
  /** 命中的人名/学院/年级等可识别信息（匿名信不得出现） */
  leaked: string[];
}

export interface LetterContext {
  donorNickname: string;
  /** null 表示受赠人选择匿名，信中只能自称「一位同学」 */
  receiverName: string | null;
  itemTitle: string;
  categoryText: string;
  conditionText: string;
  /** 交割日期，YYYY-MM-DD */
  donatedAt: string;
  weightKg: number;
}

/** 2026-11-14 → 2026年11月14日（落款用，避免信件里出现 2026-11-14 这种机器格式） */
export function letterDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!m) return value.trim();
  return `${m[1]}年${Number(m[2])}月${Number(m[3])}日`;
}

/** 字数统计：不计空白字符（中文语境下「200 字」通常也不含空格换行） */
export function countLetters(text: string): number {
  return text.replace(/\s/g, '').length;
}

export function findLabelTerms(text: string): string[] {
  return LABEL_TERMS.filter((t) => text.includes(t));
}

/**
 * 模型输出的清洗：去掉代码块、Markdown 标记、开场白、整段引号。
 * 只需要处理「能救回来」的噪声，句子本身不动 —— 改句子比让模型重写风险更大。
 */
export function normalizeLetterText(raw: string): string {
  let t = String(raw ?? '');
  t = t.replace(/\r\n?/g, '\n');
  t = t.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '');
  // 开场白：「好的，这是感谢信：」
  t = t.replace(/^\s*(好的|当然|以下是|这是)[^\n]{0,24}[：:]\s*\n?/, '');
  t = t.replace(/^[ \t]*#{1,6}[ \t]*/gm, '');
  t = t.replace(/\*\*/g, '').replace(/[*_`>]/g, '');
  t = t.replace(/[ \t]+$/gm, '');
  t = t.replace(/\n{3,}/g, '\n\n');
  // 整封信被引号包起来的情况
  t = t.replace(/^["'「『]+/, '').replace(/["'」』]+$/, '');
  return t.trim();
}

/** 模型漏写落款时补上，保证每封信都有平台署名与日期 */
export function ensureSignature(text: string, dateLabel: string): string {
  if (text.includes(LETTER_SIGNATURE)) return text;
  return `${text}\n\n${LETTER_SIGNATURE}\n${dateLabel}`;
}

/**
 * 验收一封信：字数、标签化词、匿名信里的人名/学院/年级、落款。
 * 任一条不过都当作「这一版不可用」，由上层决定重试还是走模板。
 */
export function validateLetter(
  text: string,
  opts: {
    anonymous: boolean;
    receiverName?: string | null;
    college?: string | null;
    grade?: string | null;
  },
): LetterCheck {
  const length = countLetters(text);
  const issues: LetterIssue[] = [];
  const labels = findLabelTerms(text);
  const leaked: string[] = [];

  if (length < LETTER_ACCEPT_MIN) issues.push('too_short');
  if (length > LETTER_ACCEPT_MAX) issues.push('too_long');
  if (labels.length) issues.push('sensitive_label');
  if (!text.includes(LETTER_SIGNATURE)) issues.push('missing_signature');

  // 匿名信绝不出现可识别信息；署名的信也不允许出现学院与年级
  const identity = [opts.college, opts.grade].filter(
    (v): v is string => typeof v === 'string' && v.trim().length > 0,
  );
  if (opts.anonymous && opts.receiverName) identity.push(opts.receiverName);
  for (const token of identity) {
    if (text.includes(token.trim())) leaked.push(token.trim());
  }
  if (leaked.length) issues.push('leaked_identity');

  return { ok: issues.length === 0, length, issues, labels, leaked };
}

/** 重试时追加给模型的修正提示；没有问题项时返回空串 */
export function retryHint(check: LetterCheck): string {
  if (check.ok) return '';
  const parts: string[] = [];
  if (check.issues.includes('too_short')) parts.push(`上一版只有 ${check.length} 字，太短`);
  if (check.issues.includes('too_long')) parts.push(`上一版有 ${check.length} 字，太长`);
  if (check.labels.length) parts.push(`出现了不该用的词：${check.labels.join('、')}，请换成中性说法`);
  if (check.leaked.length) parts.push('出现了可识别收信人身份的信息，全部删掉');
  if (check.issues.includes('missing_signature')) parts.push('漏了落款，结尾要写平台名与日期');
  return `重写要求：${parts.join('；')}。仍然只输出信件正文。`;
}

/**
 * 模型不可用时的兜底信件：事实全部来自捐赠记录，措辞固定、可复现。
 * 它不追求文采，只保证「有人捐了东西，平台确实回了一封信」这件事不落空。
 */
export function composeTemplateLetter(ctx: LetterContext): string {
  const receiver = ctx.receiverName ?? '一位同学';
  const date = letterDate(ctx.donatedAt);
  const weight =
    ctx.weightKg > 0 ? `按平台的折算口径，这次大约让 ${ctx.weightKg} kg 物资继续留在校园里。` : '';

  const body = [
    `你好，${ctx.donorNickname}：`,
    '',
    `你送出的《${ctx.itemTitle}》已经交到${receiver}手里了。这是一件${ctx.categoryText}，成色是${ctx.conditionText}，检查过可以正常使用，接下来会继续在校园里派上用场。`,
    '',
    `写这封信不是要你记住什么，只是想让你知道它的去向：它没有被塞进柜子深处，也没有被当成垃圾扔掉，只是换了一位主人。${weight}校内每年都有不少还能用的东西被闲置，一次转交就少一件被浪费的物品。`,
    '',
    '等哪天你手里又有用不上的东西，记得这里还开着门。',
    '',
    LETTER_SIGNATURE,
    date,
  ].join('\n');

  return body;
}
