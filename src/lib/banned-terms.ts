// 本地违禁词表：模型不可用时的最后一道防线，也是模型漏判时的二次兜底。
//
// 收词原则：只收「高置信度、单看词面就能定性」的词。
// 单字「刀」「药」「烟」「猫」一律不收 —— 否则剪刀、药盒收纳、油烟机、猫咪抱枕
// 都会被误拦，而误拦会让正常用户卡在发布页（被拦的记录不入库，管理员也无法恢复）。
// 模糊情况交给模型判，本地表只兜「拦错也比放过好」的硬违规。

export const RISK_CATEGORIES = [
  'prohibited',
  'dangerous',
  'medical',
  'animal',
  'indecent',
  'offcampus',
] as const;

export type RiskCategory = (typeof RISK_CATEGORIES)[number];

export interface BannedTermGroup {
  category: RiskCategory;
  /** 展示用类别名 */
  label: string;
  /** 平台规则一句话，拼进拦截理由 */
  hint: string;
  terms: string[];
}

export const BANNED_TERM_GROUPS: BannedTermGroup[] = [
  {
    category: 'prohibited',
    label: '违禁品',
    hint: '平台禁止交易管制与违禁物品',
    terms: [
      '管制刀具',
      '弹簧刀',
      '三棱刀',
      '匕首',
      '开山刀',
      '仿真枪',
      '气枪',
      '水弹枪',
      'bb弹',
      '枪支',
      '弹药',
      '毒品',
      '冰毒',
      '大麻',
      '迷药',
      '听话水',
      '催情药',
      '假证',
      '办证',
      '代写论文',
      '论文代写',
      '代写作业',
      '代考',
      '刷单',
      '赌博',
      '香烟',
      '电子烟',
      '烟弹',
      '赃物',
      '偷来的',
    ],
  },
  {
    category: 'dangerous',
    label: '危险品',
    hint: '平台禁止易燃易爆、剧毒、强腐蚀等危险品',
    terms: [
      '易燃易爆',
      '汽油',
      '柴油',
      '煤油',
      '酒精块',
      '酒精炉',
      '无水乙醇',
      '工业酒精',
      '医用酒精',
      '烟花爆竹',
      '鞭炮',
      '烟花',
      '摔炮',
      '强酸',
      '强碱',
      '浓硫酸',
      '浓盐酸',
      '剧毒',
      '农药',
      '杀虫剂',
      '灭鼠药',
      '煤气罐',
      '液化气罐',
      '高压气瓶',
      '电击棒',
      '防狼喷雾',
      '催泪瓦斯',
    ],
  },
  {
    category: 'medical',
    label: '药品与医疗器械',
    hint: '平台禁止药品与医疗器械',
    terms: [
      '处方药',
      '非处方药',
      '消炎药',
      '抗生素',
      '抗菌药',
      '头孢',
      '阿莫西林',
      '布洛芬',
      '对乙酰氨基酚',
      '阿司匹林',
      '感冒药',
      '退烧药',
      '止咳药',
      '止痛药',
      '安眠药',
      '镇静剂',
      '激素药',
      '注射液',
      '注射剂',
      '输液',
      '药品',
      '医疗器械',
      '血压计',
      '血糖仪',
      '注射器',
      '针头',
      '手术刀',
      '雾化器',
      '制氧机',
    ],
  },
  {
    category: 'animal',
    label: '活体动物',
    hint: '平台禁止活体动物交易',
    terms: [
      '活体',
      '活物',
      '宠物出售',
      '出售宠物',
      '转让宠物',
      '送养',
      '幼猫',
      '幼犬',
      '仓鼠',
      '出售仓鼠',
      '兔子出售',
      '活兔',
    ],
  },
  {
    category: 'indecent',
    label: '不良内容',
    hint: '平台禁止色情低俗内容',
    terms: [
      '成人用品',
      '情趣用品',
      '情趣内衣',
      '色情',
      '黄片',
      '裸照',
      '一夜情',
      '约炮',
      '原味内衣',
    ],
  },
  {
    category: 'offcampus',
    label: '疑似校外倒卖',
    hint: '平台只允许校内自用闲置流转，疑似批量倒卖需人工核实',
    terms: [
      '批发',
      '一件代发',
      '厂家直销',
      '货源',
      '囤货',
      '批量出售',
      '大量现货',
      '全场清仓',
      '代购',
    ],
  },
];

const GROUP_BY_CATEGORY = new Map<RiskCategory, BannedTermGroup>(
  BANNED_TERM_GROUPS.map((g) => [g.category, g]),
);

/** 含 ok 的完整类别标签表，供接口与管理员页统一取词 */
export const MODERATION_CATEGORY_LABEL: Record<string, string> = {
  ok: '正常',
  ...Object.fromEntries(BANNED_TERM_GROUPS.map((g) => [g.category, g.label])),
};

export function moderationCategoryLabel(category: string): string {
  return MODERATION_CATEGORY_LABEL[category] ?? category;
}

export function riskHint(category: string): string {
  return GROUP_BY_CATEGORY.get(category as RiskCategory)?.hint ?? '平台规则不允许该内容';
}

export interface BannedHit {
  term: string;
  category: RiskCategory;
  label: string;
  /** 命中的平台规则，命中时直接拼进拦截理由 */
  hint: string;
}

/**
 * 扫描文本命中情况：同一词只记一次，多个词命中时按词表顺序（越靠前的类别优先级越高）。
 * 返回空数组表示本地未命中。
 */
export function scanBannedTerms(text: string): BannedHit[] {
  const haystack = text.toLowerCase();
  if (!haystack.trim()) return [];

  const seen = new Set<string>();
  const hits: BannedHit[] = [];
  for (const group of BANNED_TERM_GROUPS) {
    for (const term of group.terms) {
      const key = term.toLowerCase();
      if (seen.has(key)) continue;
      if (!haystack.includes(key)) continue;
      seen.add(key);
      hits.push({ term, category: group.category, label: group.label, hint: group.hint });
    }
  }
  return hits;
}

/** 多条命中取第一条（词表顺序即优先级），供决定最终类别 */
export function primaryHit(hits: BannedHit[]): BannedHit | null {
  return hits.length > 0 ? hits[0] : null;
}
