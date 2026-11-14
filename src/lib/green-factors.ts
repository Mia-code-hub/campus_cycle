// 参考估算值（用于 Demo 环保统计，非实测数据）
export const GREEN_WEIGHT_KG: Record<string, number> = {
  textbook: 0.35,
  bedding: 2.5,
  stationery: 0.15,
  appliance: 1.2,
  daily: 0.4,
  clothing: 0.3,
};

// 未列明类别（other 等）的兜底重量
const DEFAULT_WEIGHT_KG = 0.4;

export function greenWeightKg(category: string): number {
  return GREEN_WEIGHT_KG[category] ?? DEFAULT_WEIGHT_KG;
}
