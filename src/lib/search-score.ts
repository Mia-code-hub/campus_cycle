// 检索打分规则：语义相似度 + 业务加权，纯函数集中在这里，单测与检索层共用同一份口径。

// donate 物品的基础加权（公益优先曝光）
export const DONATE_BASE_WEIGHT = 0.15;

// 匹配度分档阈值：≥0.75 高度匹配 / ≥0.6 较匹配 / 其他 相关
export const MATCH_HIGH = 0.75;
export const MATCH_MID = 0.6;

// 业务加权只对「确实沾边」的结果生效：相似度低于这条线时，公益/帮扶加权会把
// 完全无关的捐赠物品顶到教材前面，反而破坏相关度。门槛取 0.5，低于此仍会出现在结果里，只是不享受加权。
export const BOOST_MIN_SIMILARITY = 0.5;

// 结果下限：余弦相似度低于这条线视为「不相关」，不进入结果列表。
// 否则语义检索永远能凑满 Top-8，用户搜「自行车头盔」也会看到教材，比空结果更糟。
export const MIN_RESULT_SIMILARITY = 0.4;

export type MatchLabel = '高度匹配' | '较匹配' | '相关' | '关键词';

export function matchLabelOf(similarity: number): '高度匹配' | '较匹配' | '相关' {
  if (similarity >= MATCH_HIGH) return '高度匹配';
  if (similarity >= MATCH_MID) return '较匹配';
  return '相关';
}

// 排序分：余弦相似度 + 业务加权。similarity 本身保持原样返回给前端展示，
// 加权只影响排序，不会把「相关」伪装成「高度匹配」。
export function relevanceScore(
  similarity: number,
  opts: { mode: string; aidBoost?: number },
): number {
  if (similarity < BOOST_MIN_SIMILARITY) return similarity;
  const base = opts.mode === 'donate' ? DONATE_BASE_WEIGHT + (opts.aidBoost ?? 0) : 0;
  return similarity + base;
}
