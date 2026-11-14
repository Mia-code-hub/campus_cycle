// analyze 输出的白名单归一化：模型再飘，落到数据库的枚举值也必须合法。
// 纯函数、无依赖，便于 node:test 直接跑（见 tests/analyze-normalize.test.ts）。

export interface PriceRange {
  low: number;
  high: number;
  suggested: number;
}

export interface AnalyzeOutput {
  category: string;
  conditionLevel: string;
  title: string;
  aiDesc: string;
  tags: string[];
  // 转售时给出参考价；捐赠时为 undefined
  priceRange?: PriceRange;
  priceReason?: string;
  // 捐赠时的公益标签
  donateTag?: string;
}

const MAX_TITLE = 22;
const MAX_DESC = 200;
const MAX_TAGS = 6;
const MAX_TAG_LEN = 6;
const MAX_PRICE = 100_000;
const MAX_REASON = 40;
const MAX_DONATE_TAG = 20;

// 去掉模型爱加的包裹符号与换行，避免标题/标签里混入格式字符
function cleanText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/^["'“”‘’「」【】\s]+|["'“”‘’「」【】\s]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of value) {
    const tag = cleanText(raw).replace(/^#+/, '').slice(0, MAX_TAG_LEN);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length >= MAX_TAGS) break;
  }
  return tags;
}

function toPrice(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > MAX_PRICE) return null;
  return Math.round(n);
}

// 模型给的区间常见三类问题：字符串数字、low/high 颠倒、suggested 跑到区间外。
// 这里全部纠正；结构实在不成立就整段丢弃，宁可不显示参考价也不显示错的。
function normalizePriceRange(value: unknown): PriceRange | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  const a = toPrice(o.low);
  const b = toPrice(o.high);
  const s = toPrice(o.suggested);
  if (a === null || b === null || s === null) return null;
  const low = Math.min(a, b);
  const high = Math.max(a, b);
  if (high <= low) return null;
  return { low, high, suggested: Math.min(Math.max(s, low), high) };
}

/**
 * @param raw        safeParseJson 的结果
 * @param categories 合法类别枚举（来自 src/lib/constants.ts）
 * @param conditions 合法成色枚举
 * @returns 归一化结果；title 与 aiDesc 都为空时返回 null（视为 parse_error）
 */
export function normalizeAnalyzeOutput(
  raw: unknown,
  categories: readonly string[],
  conditions: readonly string[],
): AnalyzeOutput | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  const category = categories.includes(o.category as string) ? (o.category as string) : 'other';
  const conditionLevel = conditions.includes(o.conditionLevel as string)
    ? (o.conditionLevel as string)
    : '可用';
  const title = cleanText(o.title).slice(0, MAX_TITLE);
  const aiDesc = cleanText(o.aiDesc ?? o.description).slice(0, MAX_DESC);
  const tags = normalizeTags(o.tags);

  // 标题和文案都没出来，等于这一轮没产出，交给上层标 parse_error 走降级
  if (!title && !aiDesc) return null;

  const out: AnalyzeOutput = { category, conditionLevel, title, aiDesc, tags };

  const priceRange = normalizePriceRange(o.priceRange);
  if (priceRange) out.priceRange = priceRange;

  const priceReason = cleanText(o.priceReason).slice(0, MAX_REASON);
  if (priceReason) out.priceReason = priceReason;

  const donateTag = cleanText(o.donateTag).slice(0, MAX_DONATE_TAG);
  if (donateTag) out.donateTag = donateTag;

  return out;
}
