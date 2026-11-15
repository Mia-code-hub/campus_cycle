// 报告正文的文本处理：纯函数、零运行时依赖，node:test 可以直接断言。
// 清洗规则刻意保守——只去掉模型爱加的结构标记，不改动它写的字和数字，
// 否则「字数」与「数字比对」两项校验都会被清洗动作干扰。

/**
 * 去掉模型爱加的 Markdown 结构，保留正文。
 * - 代码围栏整行删掉（有的模型会把正文包进 ```）
 * - 行首 #、> 去掉
 * - **加粗**、__强调__ 去掉标记
 * - 行首的 - / * / 1. 列表符号去掉：这些符号会让「1」「2」混进数字校验，
 *   而报告本身要求是连续散文
 */
export function normalizeReportText(raw: string): string {
  const lines = raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line) => !/^\s*```/.test(line))
    .map((line) =>
      line
        .replace(/^\s{0,3}#{1,6}\s*/, '')
        .replace(/^\s*>\s?/, '')
        .replace(/^\s*(?:[-*•]|\d{1,2}[.、)])\s+/, '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/__(.+?)__/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .trimEnd(),
    );

  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * 字数口径：去掉空白后的字符数（含标点）。
 * 这与 WPS / Word 的「字符数（不计空格）」一致，也和用户说的「600-900 字」对得上。
 * 不按「汉字数」算，是因为标点在中文字数统计里本来就算字。
 */
export function countChars(text: string): number {
  return text.replace(/\s/g, '').length;
}

/** 段落：空行分段；单换行视为段内折行，合并回一段 */
export function toParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s*\n\s*/g, '').trim())
    .filter((p) => p.length > 0);
}

/** 首句摘要，给列表页当预览用，不参与校验 */
export function firstSentence(text: string, max = 60): string {
  const flat = text.replace(/\s+/g, '');
  const cut = flat.split(/[。！？；]/)[0] ?? flat;
  return cut.length <= max ? cut : `${cut.slice(0, max)}…`;
}
