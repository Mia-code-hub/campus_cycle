// 信件导出为图片时的排版计算：纯函数，不碰 DOM，方便单测。
// 目标不是复刻浏览器断行，而是「不出现行首标点、不把长句挤出纸面」。

// 这些标点不能出现在行首（避头）
export const NO_LINE_START = '，。、；：？！）】》」』”’%…—～·';
// 这些标点不能出现在行尾（避尾）
export const NO_LINE_END = '（【《「『“‘';

export interface WrapOptions {
  maxWidth: number;
  measure: (text: string) => number;
}

/**
 * 按宽度断行。空行保留为空串（用于段落间距）。
 * 遇到避头标点让它跟着上一行溢出一点点，遇到避尾标点就把上一行末字带下来。
 */
export function wrapText(text: string, opts: WrapOptions): string[] {
  const lines: string[] = [];
  for (const paragraph of String(text ?? '').split('\n')) {
    if (paragraph.length === 0) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const ch of paragraph) {
      if (line && opts.measure(line + ch) > opts.maxWidth) {
        if (NO_LINE_START.includes(ch)) {
          lines.push(line + ch);
          line = '';
          continue;
        }
        const last = line.slice(-1);
        if (NO_LINE_END.includes(last) && line.length > 1) {
          lines.push(line.slice(0, -1));
          line = last + ch;
        } else {
          lines.push(line);
          line = ch;
        }
      } else {
        line += ch;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

/** 导出文件名：去掉路径分隔符与首尾空白，避免浏览器把它当目录 */
export function exportFileName(itemTitle: string): string {
  const safe = itemTitle.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 24);
  return `感谢信-${safe || '捐赠'}.png`;
}
