// analyze 输出的白名单归一化：模型再飘，落到数据库的枚举值也必须合法。
// 纯函数、无依赖，便于 node:test 直接跑（见 tests/analyze-normalize.test.ts）。

export interface AnalyzeOutput {
  category: string;
  conditionLevel: string;
  title: string;
  aiDesc: string;
  tags: string[];
}

const MAX_TITLE = 22;
const MAX_DESC = 200;
const MAX_TAGS = 6;
const MAX_TAG_LEN = 6;

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

  return { category, conditionLevel, title, aiDesc, tags };
}
