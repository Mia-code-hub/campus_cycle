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

// 各类目里「纸」占物料重量的比例，用来折算节约纸张量。
// 教材几乎全是纸（封面、胶装算进去略降到 0.9），文具只有本册是纸；
// 其余类目（被褥、衣物、小家电、日用品）不计纸张，宁可少算也不虚构口径。
export const PAPER_SHARE: Record<string, number> = {
  textbook: 0.9,
  stationery: 0.5,
};

export function paperShare(category: string): number {
  return PAPER_SHARE[category] ?? 0;
}

// 每 kg 闲置物品二次利用的减排量（kgCO2e/kg）。
// 这是个**参考估算值**：纺织、纸张、小家电的再利用减排强度差很多，取一个便于答辩解释的中位系数，
// 不宣称实测。所有对外展示都必须带上这句限定语——宁可数字保守，也不要看起来像编的。
export const CO2_PER_KG = 2.1;
