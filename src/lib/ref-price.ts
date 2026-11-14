import type { PriceStat } from '@/server/price-stats';

// 内置参考价：校内常见成交区间（经验值，不是真实行情接口）。
// 用于「同类目历史成交样本不足」时的兜底上下文，严禁当作真实成交数据表述。
export const REF_PRICE: Record<string, { low: number; high: number; note: string }> = {
  textbook: { low: 8, high: 30, note: '教材多为原价 2-4 折' },
  bedding: { low: 20, high: 80, note: '被褥按成套与洁净度定价' },
  stationery: { low: 3, high: 20, note: '文具单价低，多按件打包' },
  appliance: { low: 15, high: 60, note: '小家电看功能是否正常' },
  daily: { low: 5, high: 30, note: '日用品以成色与剩余量为准' },
  clothing: { low: 10, high: 50, note: '衣物看季节与尺码' },
  other: { low: 5, high: 40, note: '其他类按物品实际情况' },
};

export interface PriceContextInput {
  stats: Record<string, PriceStat>;
  refPrice: typeof REF_PRICE;
}

function line(label: string, s: PriceStat): string {
  return `- ${label}：本校历史成交 ${s.count} 件，均价 ${s.avg} 元，区间 [${s.min}, ${s.max}] 元。`;
}

function refLine(label: string, r: { low: number; high: number; note: string }): string {
  return `- ${label}：无足够成交样本，参考经验区间 [${r.low}, ${r.high}] 元（${r.note}）。`;
}

const LABELS: Record<string, string> = {
  textbook: '教材',
  bedding: '被褥',
  stationery: '文具',
  appliance: '小家电',
  daily: '日用品',
  clothing: '衣物',
  other: '其他',
};

// 拼成 prompt 里的「定价参考」段：有样本用统计，样本不足用内置经验区间。
// 明确写「经验值」，防止模型把它编造成历史成交事实。
export function buildPriceContext({ stats, refPrice }: PriceContextInput): string {
  const lines: string[] = ['定价参考（仅供估算，不得复述为真实成交数据）：'];
  for (const [key, label] of Object.entries(LABELS)) {
    const s = stats[key];
    if (s && !s.insufficient) lines.push(line(label, s));
    else if (refPrice[key]) lines.push(refLine(label, refPrice[key]));
  }
  return lines.join('\n');
}
