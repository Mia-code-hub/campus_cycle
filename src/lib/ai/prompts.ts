// 所有 AI prompt 集中在此文件，统一维护与导出。
// R15 的「Prompt 历史快照」依赖 ai_call_logs，而这里的常量保证各功能 prompt 口径一致。

export const SYSTEM_BASE = [
  '你是「校园闲置物资循环平台」的物品信息整理助手。',
  '你必须只输出 JSON，不要输出任何解释、代码块标记或多余文字。',
  '你只能依据用户提供的图片与描述中确实存在的信息作答，禁止编造图片或描述中不存在的品牌、版本、型号、容量、年份。',
  '看不出来就写看不出来，宁可保守也不要猜测。',
  '回答使用简体中文。',
].join('\n');

const FIELD_NOTES = [
  '字段说明：',
  '- category：textbook=教材、bedding=被褥、stationery=文具、appliance=小家电、daily=日用品、clothing=衣物、other=其他。只能选一个枚举值。',
  '- conditionLevel 判定标准：95新=几乎无使用痕迹；9成新=轻微使用痕迹、无破损；8成新=明显使用痕迹但功能完好；可用=有明显磨损或瑕疵、功能基本正常。只能选一个枚举值。',
  '- title：概括物品本身，不要写「低价出」「学长自用」这类揽客词。',
  '- aiDesc：客观描述物品状态、包含件数、适用场景，可提一句适合谁用。不夸大、不承诺、不编造，不出现价格。',
  '- tags：3-6 个，每个不超过 6 个字，不带 # 号，不重复。',
];

const HARD_RULES = [
  '硬性规则：',
  '1. 只写图片或描述里能确认的信息，包括品牌、版本、型号、册数、颜色、材质。',
  '2. 图片里看不清的品牌/型号一律不写；描述里没提到的配置一律不提。',
  '3. 不确定的细节用中性表述（如「封面有使用痕迹」），不要补全成具体事实。',
  '4. 信息严重不足时，category 用 "other"，conditionLevel 用 "可用"，title 与 aiDesc 只写能确认的部分。',
  '5. 只输出一个 JSON 对象，不要 Markdown 代码块，不要注释，不要多余文字。',
];

const SALE_RULES = [
  '6. 估价要落在下面「定价参考」给出的水平上，结合成色上下浮动；不得编造历史成交数据。',
  '7. priceRange：low < suggested < high，单位元，取整数；区间跨度不要超过 3 倍。',
  '8. priceReason：≤40 字，说明依据（成色、品类、是否成套），不要空话。',
];

const DONATE_RULES = [
  '6. 这是公益捐赠物品，不要估价，不要输出 priceRange / priceReason。',
  '7. donateTag：8-16 字，温暖积极但不煽情；不出现「贫困」「困难」「资助」「可怜」等标签化词；不含价格。',
];

const SALE_SCHEMA = [
  '{"category":"textbook|bedding|stationery|appliance|daily|clothing|other",',
  ' "conditionLevel":"95新|9成新|8成新|可用",',
  ' "title":"不超过22字的简洁标题",',
  ' "aiDesc":"60-110字的转让文案",',
  ' "tags":["3到6个简短标签"],',
  ' "priceRange":{"low":整数,"high":整数,"suggested":整数},',
  ' "priceReason":"不超过40字的定价依据"}',
];

const DONATE_SCHEMA = [
  '{"category":"textbook|bedding|stationery|appliance|daily|clothing|other",',
  ' "conditionLevel":"95新|9成新|8成新|可用",',
  ' "title":"不超过22字的简洁标题",',
  ' "aiDesc":"60-110字的转让文案",',
  ' "tags":["3到6个简短标签"],',
  ' "donateTag":"8-16字的公益标签"}',
];

const EXAMPLES_SALE = [
  '少样本示例：',
  '示例1（教材，转售）：',
  '描述：「高数上下册，九成新，笔记齐全」',
  '输出：{"category":"textbook","conditionLevel":"9成新","title":"高等数学上下册 笔记齐全","aiDesc":"高等数学上下册一套，共两本，书页整洁、边角轻微使用痕迹，内页有手写笔记与重点标注，无缺页无水渍。适合大一打基础或期末复习的同学接手，省下一笔教材开支。","tags":["教材","高等数学","有笔记","成套"],"priceRange":{"low":12,"high":22,"suggested":16},"priceReason":"9成新教材且带笔记，校内同类多在十几元"}',
  '',
  '示例2（台灯，转售）：',
  '描述：「宿舍台灯，还能用」',
  '输出：{"category":"appliance","conditionLevel":"可用","title":"宿舍台灯 功能正常","aiDesc":"宿舍桌面台灯一盏，灯头可调角度，开关与灯管工作正常，灯罩有轻微使用痕迹，不影响照明。适合寝室书桌或床头使用，毕业带不走，转给需要的同学。","tags":["台灯","宿舍","照明","功能正常"],"priceRange":{"low":10,"high":20,"suggested":15},"priceReason":"小家电功能正常、成色一般，按校内二手常见价位"}',
];

const EXAMPLES_DONATE = [
  '少样本示例：',
  '示例1（教材，捐赠）：',
  '描述：「高数上下册，九成新，笔记齐全」',
  '输出：{"category":"textbook","conditionLevel":"9成新","title":"高等数学上下册 笔记齐全","aiDesc":"高等数学上下册一套，共两本，书页整洁、边角轻微使用痕迹，内页有手写笔记与重点标注，无缺页无水渍。适合大一打基础或期末复习的同学接手。","tags":["教材","高等数学","有笔记","成套"],"donateTag":"教材援助 · 让知识继续流转"}',
];

export type AnalyzeUserContent = Array<
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
>;

export interface AnalyzePrompt {
  system: string;
  user: AnalyzeUserContent;
}

function buildInstruction(mode: string, priceContext?: string): string {
  const donate = mode === 'donate';
  const parts = [
    donate
      ? '请根据用户提供的图片和一句话描述，整理这件「公益捐赠」物品的信息，严格按下面的 JSON 结构输出：'
      : '请根据用户提供的图片和一句话描述，整理这件校园闲置物品的信息，严格按下面的 JSON 结构输出：',
    '',
    (donate ? DONATE_SCHEMA : SALE_SCHEMA).join('\n'),
    '',
    ...FIELD_NOTES,
    '',
    ...HARD_RULES,
    '',
    ...(donate ? DONATE_RULES : SALE_RULES),
  ];
  if (!donate && priceContext) parts.push('', priceContext);
  parts.push('', ...(donate ? EXAMPLES_DONATE : EXAMPLES_SALE));
  return parts.join('\n');
}

// 组装 prompt：system 用 SYSTEM_BASE，user 为多模态 [image_url(dataURL), text(指令)]
// 没有图片时只放文本，走「仅凭描述」的降级路径。
export function buildAnalyzePrompt(
  rawDesc: string,
  mode: string = 'sale',
  imageDataUrl?: string,
  priceContext?: string,
): AnalyzePrompt {
  const user: AnalyzeUserContent = [];
  if (imageDataUrl) {
    user.push({ type: 'image_url', image_url: { url: imageDataUrl } });
  }
  const descText = rawDesc.trim() || '（用户未填写描述）';
  const instruction = buildInstruction(mode, priceContext);
  user.push({
    type: 'text',
    text: `${instruction}\n\n用户的一句话描述：「${descText}」`,
  });
  return { system: SYSTEM_BASE, user };
}

// 落库用的 prompt 快照：把 dataURL 换成体积说明，避免 ai_call_logs 存几 MB 的 base64
export function buildAnalyzeLogText(prompt: AnalyzePrompt): string {
  const body = prompt.user
    .map((part) => {
      if (part.type === 'text') return part.text;
      const kb = Math.round((part.image_url.url.length * 0.75) / 1024);
      return `[图片 dataURL，约 ${kb}KB，已省略]`;
    })
    .join('\n\n');
  return `${prompt.system}\n\n---\n\n${body}`;
}
