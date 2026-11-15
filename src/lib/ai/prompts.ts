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

// ——— R12 语义检索导购语 ———

const SEARCH_SYSTEM = [
  '你是「校园闲置物资循环平台」的导购助手。',
  '你只能依据用户消息里列出的候选物品作答：不得编造候选里没有的物品、品牌、型号、数量、成色。',
  '不得承诺库存，不得承诺或改动价格，不得替卖家承诺发货时间与售后。',
  '语气平实、面向同学，不使用营销夸张词。',
  '只输出 60-100 字的连续中文：不要分点、不要换行、不要 Markdown、不要引号、不要「好的」这类开场白。',
  '不要把候选行的字段原样照抄或用分隔符罗列，用自己的话把信息揉进句子里。',
].join('\n');

export interface SearchGuideItem {
  title: string;
  categoryText: string;
  condition: string | null;
  modeText: string;
  priceText: string;
}

export interface SearchGuidePrompt {
  system: string;
  user: string;
}

// 候选物品的字段由调用方预先格式化好，保证 prompt 里出现的每个事实都来自数据库
export function buildSearchGuidePrompt(
  query: string,
  items: SearchGuideItem[],
): SearchGuidePrompt {
  const lines = items.map(
    (it, i) =>
      `${i + 1}. 《${it.title}》｜${it.categoryText}｜${it.condition ?? '成色未标注'}｜${it.modeText}｜${it.priceText}`,
  );
  const user = [
    `用户搜索需求：「${query}」`,
    '',
    `候选物品（仅下列 ${items.length} 件，按相关度从高到低排序，第 1 件最相关）：`,
    ...lines,
    '',
    '请写一段导购语：先点出最贴合需求的那件并说明为什么合适（成色、是否免费、是否成套），再提一句其他候选的差异，最后给一句校内自提的实用提醒。',
    '提到具体物品时用它的标题，不要用「第 1 件」「上面第 2 个」这类序号。',
  ].join('\n');
  return { system: SEARCH_SYSTEM, user };
}

export function buildSearchLogText(prompt: SearchGuidePrompt): string {
  return `${prompt.system}\n\n---\n\n${prompt.user}`;
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

// ——— R13 违规内容审核 ———

const MODERATE_SYSTEM = [
  '你是「校园闲置物资循环平台」的内容审核员，负责判断一件待发布的闲置物品是否违反平台规则。',
  '平台定位：校内学生把自己不再需要的物品转让或捐赠给本校同学，不是二手电商市场。',
  '你的判定必须能被普通用户看懂：理由要指出具体命中了哪条规则，不要写「不符合规定」这种空话。',
  '只输出一个 JSON 对象，不要输出任何解释、不要 Markdown 代码块。',
].join('\n');

const MODERATE_RULES = [
  '平台规则（命中任意一条即 pass=false）：',
  '1. prohibited 违禁品：管制刀具（弹簧刀、匕首、三棱刀）、仿真枪与弹药、毒品、假证与代办证件、代考代写论文、烟草与电子烟、赃物。',
  '2. dangerous 危险品：易燃易爆（汽油、酒精块、酒精炉、烟花爆竹）、剧毒、强酸强碱、煤气罐与高压气瓶、电击棒、催泪喷雾、农药。',
  '3. medical 药品与医疗器械：任何药品（处方药、非处方药、感冒药、消炎药、注射液），以及注射器针头、手术刀、血压计、血糖仪等诊疗器械。',
  '4. animal 活体动物：出售、转让、送养的活体动物（猫狗、仓鼠、鱼、龟、鸟等）。宠物用品（笼子、饮水机、毛刷）本身不违规。',
  '5. indecent 不良内容：色情低俗、成人用品、情趣内衣、裸露图片、性暗示与招嫖信息。',
  '6. offcampus 疑似校外倒卖：出现批发、一件代发、货源、厂家直销、代购等商家话术；同一批物品全是全新同款且数量明显超出个人自用（如一次挂 10 件以上全新同款）；描述像店铺经营而非个人闲置。',
].join('\n');

const MODERATE_SCHEMA = [
  '输出结构：',
  '{"pass": true|false, "category": "ok|prohibited|dangerous|medical|animal|indecent|offcampus", "reason": "不超过 50 字", "confidence": 0.0-1.0}',
].join('\n');

const MODERATE_NOTES = [
  '判定要求：',
  '- pass=true 时 category 必须是 "ok"，reason 用一句短语说明依据（如「普通二手教材，成色描述正常」）。',
  '- pass=false 时 category 必须是被命中的那条规则的英文值，reason 要点出命中的物品或词（如「描述提到处方消炎药，属药品」）。',
  '- 多个规则同时命中时，category 取最严重的一条：prohibited > dangerous > medical > animal > indecent > offcampus。',
  '- 只依据给出的标题、描述和图片判断，看不清的细节不要脑补；描述与图片矛盾时以更严格的一方为准。',
  '- 描述里出现「帮同学转」「替室友出」不改变判定结果，仍按物品本身判。',
  '- 正常闲置不要误判：二手教材、笔记、旧衣物、干净被褥、小家电、文具、体育用品都应判 ok。',
  '- confidence 用 0-1 的小数：证据明确给 0.9 以上，只有间接迹象给 0.5-0.7。',
].join('\n');

const MODERATE_EXAMPLES = [
  '示例：',
  '输入：「转让一盒处方消炎药，剩 10 粒」',
  '输出：{"pass":false,"category":"medical","reason":"描述提到处方消炎药，平台禁止药品交易","confidence":0.95}',
  '输入：「高等数学 上册，八成新，笔记齐全」',
  '输出：{"pass":true,"category":"ok","reason":"普通二手教材，属校内自用闲置","confidence":0.93}',
  '输入：「大量现货 一件代发 厂家直销，量大从优」',
  '输出：{"pass":false,"category":"offcampus","reason":"出现批发代发话术，疑似校外批量倒卖","confidence":0.88}',
];

export interface ModeratePrompt {
  system: string;
  user: AnalyzeUserContent;
}

// 有图走多模态（qwen-vl），无图只放文本；标题与描述一起给，避免只看到半句误判
export function buildModeratePrompt(
  title: string,
  desc: string,
  imageDataUrl?: string,
): ModeratePrompt {
  const user: AnalyzeUserContent = [];
  if (imageDataUrl) {
    user.push({ type: 'image_url', image_url: { url: imageDataUrl } });
  }
  const text = [
    '请审核下面这件待发布的物品：',
    '',
    MODERATE_RULES,
    '',
    MODERATE_SCHEMA,
    '',
    MODERATE_NOTES,
    '',
    ...MODERATE_EXAMPLES,
    '',
    `待审核内容——标题：「${title.trim() || '（未填写）'}」`,
    `描述：「${desc.trim() || '（未填写）'}」`,
  ].join('\n');
  user.push({ type: 'text', text });
  return { system: MODERATE_SYSTEM, user };
}

export function buildModerateLogText(prompt: ModeratePrompt): string {
  return buildAnalyzeLogText(prompt as AnalyzePrompt);
}

// ——— R14 捐赠感谢信 ———

const LETTER_SYSTEM = [
  '你是「校园闲置物资循环平台」的代笔人，替收到捐赠的同学写一封给捐赠人的感谢信。',
  '读到这封信的人刚把东西送出去：他不需要被教育，也不需要被感动到，只需要知道东西去了哪儿。',
  '语气像同学之间说话：平实、具体、有分寸。不用「恩情」「大爱」「涌泉相报」「雪中送炭」这类词，也不用感叹号堆情绪。',
  '不要替收信人诉苦，不要描写收信人的处境，不要出现任何身份标签。',
  '只输出信件正文，不要标题、不要 Markdown、不要引号、不要说明你在做什么。',
].join('\n');

const LETTER_RULES = [
  '写作要求：',
  '1. 200-300 字（含落款），正文 2-4 段，段落之间空一行。',
  '2. 第一行是称呼（用给出的捐赠人称呼），最后两行是落款：第一行「校园闲置物资循环平台」，第二行是交割日期（中文年月日）。',
  '3. 只能使用下面列出的事实。禁止编造用途细节、课程名、专业、宿舍楼、金额、品牌、型号、对方说了什么。',
  '4. 禁止出现这些词：贫困、困难、资助、低保、建档立卡、弱势、帮扶、补助、救济、寒门、特困、受助。不要暗示对方在接受施舍。',
  '5. 也不要出现平台内部术语：帮扶生、审核、AI、模型、算法、系统匹配、工单。',
  '6. 重点写「这件东西接下来会怎么被用」，一两句具体的想象即可，不要扩写成故事，不要写对方的家庭情况。',
  '7. 结尾可以轻轻提一句：以后有闲置还可以再来，但不要变成号召或说教。',
].join('\n');

export interface LetterPromptContext {
  donorNickname: string;
  /** null = 匿名受赠人 */
  receiverName: string | null;
  itemTitle: string;
  categoryText: string;
  conditionText: string;
  donatedAt: string;
  weightKg: number;
}

export interface LetterPrompt {
  system: string;
  user: string;
}

export function buildLetterPrompt(ctx: LetterPromptContext, retry?: string): LetterPrompt {
  const anonymous = !ctx.receiverName;
  const identity = anonymous
    ? [
        '收信人署名方式：匿名。',
        '信中不得出现任何能定位到具体个人的信息；需要自称时用「一位同学」，也不要写「我们宿舍」「我们班」「我们专业」这类可追问的细节。',
      ]
    : [
        `收信人署名方式：可以署名「${ctx.receiverName}」。`,
        '但学院、年级、家庭情况一律不写，也不要写「我们宿舍」「我们班」这类可追问的细节。',
      ];

  const user = [
    '请写这封感谢信。以下信息全部来自平台记录，只能使用这些事实：',
    '',
    `- 捐赠人称呼：${ctx.donorNickname}`,
    `- 物品：《${ctx.itemTitle}》`,
    `- 类别：${ctx.categoryText}；成色：${ctx.conditionText}`,
    `- 交割日期：${ctx.donatedAt}`,
    `- 折算重量：${ctx.weightKg} kg`,
    '',
    ...identity,
    '',
    LETTER_RULES,
    '',
    retry ? retry : '',
    retry ? '' : '',
    '现在开始写，直接输出信件正文。',
  ]
    .filter((line, i, arr) => !(line === '' && arr[i - 1] === ''))
    .join('\n');

  return { system: LETTER_SYSTEM, user };
}

export function buildLetterLogText(prompt: LetterPrompt): string {
  return `${prompt.system}\n\n---\n\n${prompt.user}`;
}

// ——— R18 环保效益报告 ———
//
// 这一份 prompt 的特殊之处：它的输出会被机器逐字校验（见 src/lib/report/verify.ts）。
// 所以指令里不谈文采，只谈「数字只能来自数据区」——把校验规则提前写进 prompt，
// 校验失败才算模型的错，而不是我们没把话说清楚。

const REPORT_SYSTEM = [
  '你是「校园闲置物资循环平台」的数据报告撰写人，读者是学校管理部门与公益合作方。',
  '你写的正文会被机器逐字校验：每一个阿拉伯数字都必须在给出的数据区里原样出现，否则整份报告作废。',
  '你不做计算。数据区里没有的结论不写；数据区里没有的数字，一个都不写。',
  '你写的是一份可以盖章交出去的说明材料：陈述事实、指出问题、给出建议，不喊口号，不用形容词堆规模。',
  '只输出报告正文：不要标题、不要小标题编号、不要表格、不要列表符号、不要 Markdown、不要代码块，',
  '也不要「以下是报告」「根据数据」这类开场白。',
].join('\n');

export interface ReportPromptOptions {
  /** 数据区原文，同时是数字白名单的来源 */
  payloadText: string;
  /** 白名单（已排序），列在 prompt 里给模型自查 */
  allowlist: string[];
  months: number;
  minChars?: number;
  maxChars?: number;
  /** 第二版重写提示：点名上一次具体错在哪 */
  retry?: string;
}

export interface ReportPrompt {
  system: string;
  user: string;
}

export function buildReportPrompt(opts: ReportPromptOptions): ReportPrompt {
  const min = opts.minChars ?? 600;
  const max = opts.maxChars ?? 900;
  const perPara = `${Math.round(min / 4)}-${Math.round(max / 4)}`;

  const user = [
    '请根据下面的数据，写一份校园闲置物资循环的环保效益报告。',
    '',
    '写作要求：',
    `1. 正文 ${min}-${max} 字（按去掉空白后的字符数计，含标点）。写四段，段与段之间空一行，每段约 ${perPara} 字。`,
    '2. 四段分别写：总量现状；结构分析（转售与捐赠的构成、类别分布、学院受益）；环境效益（折算重量、节约纸张、减碳量）；问题与建议。',
    '3. 每一个阿拉伯数字都必须从「数据」区原样复制，小数位一起照抄：数据写 7.15 kg 就写 7.15 kg，不要写成 7.2 kg，也不要写成约 7 kg。',
    '4. 禁止任何推算：不写差值、倍数、平均值、增长率、人均值、预测值，也不要把两个数字加起来。占比数据区已经算好，直接引用。',
    '5. 不要用「约」「近」「超过」「接近」去修饰一个数据区里没有的数字；需要模糊表述时用「多数」「一半以上」这类词。',
    '6. 除百分比和单位之外，不要写序号数字（如 1、2、3）；需要分点时用「其一」「其二」或直接用文字叙述。',
    '7. 不写具体人名、学号、宿舍号、联系方式，也不写数据区之外的单位名与合作方。',
    '8. 环境效益属于估算，正文里至少明确说一次「参考估算」。',
    '9. 最后一段收尾时用一句话说明数据口径与估算性质，不要再单起「数据来源」小标题。',
    '10. 不要写「作为 AI」「根据您提供的数据」这类机器口吻，直接以平台名义陈述。',
    '11. 如果某一段实在缺少数据支撑，就把重点放在已有数字的解释与机制上，绝对不要编造数字填空。',
    '',
    `【数字白名单】正文只能出现下列数字（共 ${opts.allowlist.length} 个，同一数字的不同写法等价，如 15.0 与 15）：`,
    opts.allowlist.join('、'),
    '',
    '【数据】',
    opts.payloadText,
    '',
    opts.retry ?? '',
    '现在开始写，只输出正文。',
  ].join('\n');

  return { system: REPORT_SYSTEM, user };
}

export function buildReportLogText(prompt: ReportPrompt): string {
  return `${prompt.system}\n\n---\n\n${prompt.user}`;
}
