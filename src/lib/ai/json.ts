// 处理模型返回 JSON 的三种脏情况：
//   1. 被 ```json ... ``` 代码块包裹
//   2. 前后夹带解释文字
//   3. 字段缺失（缺失字段的兜底由调用方白名单负责）
// 解析失败一律返回 null，绝不抛异常。

function tryParse<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

// 定位首个 { 或 [ 并配对到结束，容忍字符串内出现的括号
function extractBalanced(s: string): string | null {
  const obj = s.indexOf('{');
  const arr = s.indexOf('[');
  let start = -1;
  let open = '';
  let close = '';
  if (obj !== -1 && (arr === -1 || obj < arr)) {
    start = obj;
    open = '{';
    close = '}';
  } else if (arr !== -1) {
    start = arr;
    open = '[';
    close = ']';
  }
  if (start === -1) return null;

  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

export function safeParseJson<T = unknown>(raw: string): T | null {
  if (!raw) return null;
  let text = raw.trim();

  // 1) 去掉 ```json 代码块标记
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();

  // 2) 直接解析
  const direct = tryParse<T>(text);
  if (direct !== null) return direct;

  // 3) 提取首个平衡 JSON 块再解析
  const block = extractBalanced(text);
  if (block) return tryParse<T>(block);

  return null;
}
