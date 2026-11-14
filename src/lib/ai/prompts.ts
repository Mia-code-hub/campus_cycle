// 所有 AI prompt 集中在此文件，统一维护与导出。
// R15 的「Prompt 历史快照」依赖 ai_call_logs，而这里的常量保证各功能 prompt 口径一致。

export const SYSTEM_BASE = [
  '你是「校园闲置物资循环平台」的物品信息整理助手。',
  '你必须只输出 JSON，不要输出任何解释、代码块标记或多余文字。',
  '你只能依据用户提供的图片与描述中确实存在的信息作答，禁止编造图片或描述中不存在的品牌、版本、型号。',
  '回答使用简体中文。',
].join('\n');

// 占位：R10 接入识图后填充（rawDesc + mode → 完整 messages）
export function buildAnalyzePrompt(rawDesc: string, mode: string): { system: string; user: string } {
  void rawDesc;
  void mode;
  return { system: SYSTEM_BASE, user: '' };
}
