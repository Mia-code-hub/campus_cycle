// 报告数字校验：报告里的每个阿拉伯数字都必须能在「送进 prompt 的数据原文」里找到。
// 纯函数、零运行时依赖，node:test 直接断言；服务端与测试共用同一份实现。
//
// 为什么用白名单而不是「校验模型有没有算错」：
// 模型算对了也算不出来——它没有我们的 SQL。唯一能确证的事实是「这个数字的来源在不在数据里」。
// 于是规则定成：报告里的数字必须逐字来自数据区，一个都不许新造。
// 误杀（把合法数字判成非法）只影响展示，漏杀（编造数字）会毁掉整份材料的可信度，
// 所以这里宁可严一点。

import { countChars, normalizeReportText } from './text.ts';

export const REPORT_MIN_CHARS = 600;
export const REPORT_MAX_CHARS = 900;
/** 失败时最多列出多少个未命中数字：够定位问题，又不至于把页面刷满 */
const MAX_SHOWN = 8;

// 全角数字：模型偶尔会输出「１４」，先转成半角再比对
const FULLWIDTH_DIGITS = /[０-９]/g;

export function toHalfWidthDigits(text: string): string {
  return text.replace(FULLWIDTH_DIGITS, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

// 数字与千分位、小数。故意不匹配中文数字与「六千」这类写法——那些由写作要求约束，
// 不进入数字校验（中文数字无法被机器确证来源，也没法被模型用来伪造统计结论）。
const NUMBER_RE = /\d[\d,]*(?:\.\d+)?/g;

/**
 * 归一化：去千分位、去前导零、去小数末尾的零。
 * 目的是让「7.10 / 7.1 / 07.1」判成同一个数——这是同一个数字的不同写法，不该因此判失败；
 * 但「7.15 → 7.2」这种四舍五入不会通过，因为 7.2 不在白名单里。
 */
export function normalizeNumber(token: string): string {
  const raw = toHalfWidthDigits(token).replace(/,/g, '');
  if (!raw) return '';
  const [intPart = '', decPart] = raw.split('.');
  const intNorm = intPart.replace(/^0+(?=\d)/, '') || '0';
  if (decPart === undefined) return intNorm;
  const decNorm = decPart.replace(/0+$/, '');
  return decNorm ? `${intNorm}.${decNorm}` : intNorm;
}

export interface NumberHit {
  /** 原文里的写法，用来给人看 */
  raw: string;
  /** 归一化后的值，用来比对 */
  value: string;
  index: number;
}

export function extractNumbers(text: string): NumberHit[] {
  const hits: NumberHit[] = [];
  const source = toHalfWidthDigits(text);
  for (const m of source.matchAll(NUMBER_RE)) {
    const raw = m[0];
    hits.push({ raw, value: normalizeNumber(raw), index: m.index ?? 0 });
  }
  return hits;
}

/** 白名单：数据原文里出现过的所有数字（归一化后去重） */
export function buildAllowlist(source: string): Set<string> {
  return new Set(extractNumbers(source).map((h) => h.value));
}

/** 按数值排序的白名单，prompt 里列出来给人看 */
export function allowlistList(source: string): string[] {
  return [...buildAllowlist(source)].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
}

export interface ReportCheck {
  ok: boolean;
  charCount: number;
  minChars: number;
  maxChars: number;
  /** 正文里出现的数字总数（含重复） */
  totalNumbers: number;
  allowlistSize: number;
  /** 去重后的未命中数字，按出现顺序 */
  unmatched: Array<{ raw: string; value: string }>;
  issues: string[];
  /** 一句话结论，页面与接口直接展示 */
  summary: string;
}

export interface VerifyOptions {
  /** 送进 prompt 的数据原文：白名单唯一来源 */
  source: string;
  minChars?: number;
  maxChars?: number;
}

export function verifyReport(text: string, opts: VerifyOptions): ReportCheck {
  const body = normalizeReportText(text);
  const minChars = opts.minChars ?? REPORT_MIN_CHARS;
  const maxChars = opts.maxChars ?? REPORT_MAX_CHARS;

  const charCount = countChars(body);
  const hits = extractNumbers(body);
  const allow = buildAllowlist(opts.source);

  const seen = new Set<string>();
  const unmatched: Array<{ raw: string; value: string }> = [];
  for (const h of hits) {
    if (allow.has(h.value) || seen.has(h.value)) continue;
    seen.add(h.value);
    unmatched.push({ raw: h.raw, value: h.value });
  }

  const issues: string[] = [];
  if (charCount < minChars) issues.push(`字数 ${charCount}，少于 ${minChars}`);
  if (charCount > maxChars) issues.push(`字数 ${charCount}，超过 ${maxChars}`);
  if (unmatched.length > 0) {
    const shown = unmatched.slice(0, MAX_SHOWN).map((u) => u.raw);
    const more = unmatched.length > MAX_SHOWN ? ` 等 ${unmatched.length} 个` : '';
    issues.push(`出现数据里没有的数字：${shown.join('、')}${more}`);
  }

  return {
    ok: issues.length === 0,
    charCount,
    minChars,
    maxChars,
    totalNumbers: hits.length,
    allowlistSize: allow.size,
    unmatched,
    issues,
    summary:
      issues.length === 0
        ? `校验通过：${charCount} 字，${hits.length} 处数字全部来自数据区`
        : `校验未通过：${issues.join('；')}`,
  };
}

/**
 * 重写提示：把上一次的具体问题点出来。
 * 只说「请重写」模型会重犯同一个错；点名到具体数字与字数，第二版基本能一次过。
 */
export function retryHint(check: ReportCheck): string {
  const lines = ['上一次的报告没有通过校验，必须重写：'];
  if (check.charCount < check.minChars) {
    lines.push(
      `- 字数只有 ${check.charCount}，要求 ${check.minChars}-${check.maxChars}，请把每一段写得更具体（补数据对比与原因分析），不要靠重复凑字。`,
    );
  } else if (check.charCount > check.maxChars) {
    lines.push(
      `- 字数 ${check.charCount}，超过 ${check.maxChars}，请删掉铺陈与形容词，保留结论与数据。`,
    );
  }
  if (check.unmatched.length > 0) {
    const shown = check.unmatched.slice(0, MAX_SHOWN).map((u) => u.raw).join('、');
    lines.push(
      `- 这些数字在数据里不存在，必须删掉或替换成数据里真实存在的数字：${shown}。不要为了避开它们而改写结论，直接改成数据里的原值。`,
    );
  }
  lines.push('请只输出重写后的完整正文，不要解释原因。');
  return lines.join('\n');
}
