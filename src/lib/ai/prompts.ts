// 所有 AI prompt 集中在此文件，统一维护与导出。
// R15 的「Prompt 历史快照」依赖 ai_call_logs，而这里的常量保证各功能 prompt 口径一致。

export const SYSTEM_BASE = [
  '你是「校园闲置物资循环平台」的物品信息整理助手。',
  '你必须只输出 JSON，不要输出任何解释、代码块标记或多余文字。',
  '你只能依据用户提供的图片与描述中确实存在的信息作答，禁止编造图片或描述中不存在的品牌、版本、型号。',
  '回答使用简体中文。',
].join('\n');

const ANALYZE_INSTRUCTION = [
  '请根据用户提供的图片和一句话描述，判断这件校园闲置物品的信息，严格按下面的 JSON 结构输出：',
  '',
  '{"category":"textbook|bedding|stationery|appliance|daily|clothing|other",',
  ' "conditionLevel":"95新|9成新|8成新|可用",',
  ' "title":"不超过22字的简洁标题",',
  ' "aiDesc":"60-110字的转让文案，突出物品状态与卖点",',
  ' "tags":["3到6个简短标签"]}',
  '',
  '规则：',
  '1. 只描述图片与文字描述中确实存在的信息；看不清的细节不要猜。',
  '2. 禁止编造图片或描述中不存在的品牌、版本、型号。',
  '3. category 只能从给定枚举里选，conditionLevel 只能从给定枚举里选。',
  '4. 信息不足时 category 用 "other"、conditionLevel 用 "可用"。',
  '5. 所有输出使用简体中文。',
  '',
  '少样本示例：',
  '示例1（教材）：',
  '描述：「高数上下册，九成新，笔记齐全」',
  '输出：{"category":"textbook","conditionLevel":"9成新","title":"高等数学上下册","aiDesc":"高等数学上下册，九成新，书页整洁、笔记齐全，适合复习备考的同学，低价出给有需要的学弟学妹。","tags":["教材","数学","九成新","备考"]}',
  '',
  '示例2（台灯）：',
  '描述：「宿舍台灯，还能用」',
  '输出：{"category":"appliance","conditionLevel":"可用","title":"宿舍护眼台灯","aiDesc":"宿舍用台灯一盏，功能正常，光线柔和不伤眼，适合寝室书桌照明，毕业带不走，低价转让给需要的同学。","tags":["台灯","宿舍","照明","实用"]}',
].join('\n');

export type AnalyzeUserContent = Array<
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
>;

export interface AnalyzePrompt {
  system: string;
  user: AnalyzeUserContent;
}

// 组装识图 prompt：system 用 SYSTEM_BASE，user 为多模态 [image_url(dataURL), text(指令)]
// R11 会基于 mode 追加估价/公益标签段
export function buildAnalyzePrompt(
  rawDesc: string,
  mode: string = 'sale',
  imageDataUrl?: string,
): AnalyzePrompt {
  void mode;
  const user: AnalyzeUserContent = [];
  if (imageDataUrl) {
    user.push({ type: 'image_url', image_url: { url: imageDataUrl } });
  }
  const descText = rawDesc.trim() || '（用户未填写描述）';
  user.push({ type: 'text', text: `${ANALYZE_INSTRUCTION}\n\n用户的一句话描述：「${descText}」` });
  return { system: SYSTEM_BASE, user };
}
