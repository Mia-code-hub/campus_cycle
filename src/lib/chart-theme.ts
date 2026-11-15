// 图表配色的唯一来源：颜色从 CSS 主题令牌（@theme 里的 --color-*）读出来，
// 不在图表里再写死一套十六进制色板——否则改主题时图表会留在旧配色上。
// 纯函数、零 DOM 依赖：读令牌的动作由调用方传进来，node:test 可以直接断言混色结果。

export interface ChartTokens {
  /** 品牌粉 */
  blush: string;
  /** 品牌蓝 */
  sky: string;
  /** 品牌紫 */
  lilac: string;
  ink: string;
  inkSoft: string;
  panel: string;
  cream: string;
}

/** 令牌名 → CSS 变量名，客户端 hook 按这张表去读 */
export const TOKEN_VARS: Record<keyof ChartTokens, string> = {
  blush: '--color-blush',
  sky: '--color-sky',
  lilac: '--color-lilac',
  ink: '--color-ink',
  inkSoft: '--color-ink-soft',
  panel: '--color-panel',
  cream: '--color-cream',
};

/** 令牌读不到时的兜底，与 globals.css 里的值保持一致 */
export const CHART_TOKEN_FALLBACK: ChartTokens = {
  blush: '#f7b2bd',
  sky: '#a8d8ea',
  lilac: '#c7ceea',
  ink: '#4a4a55',
  inkSoft: '#8b8b96',
  panel: '#fffdfa',
  cream: '#fdf6f0',
};

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** #abc / #AABBCC / ' #aabbcc ' 都能收敛成小写六位；非法值退回 fallback */
export function normalizeHex(value: string | null | undefined, fallback: string): string {
  const v = (value ?? '').trim();
  if (!HEX_RE.test(v)) return normalizeHex(fallback, CHART_TOKEN_FALLBACK.ink);
  const body = v.slice(1).toLowerCase();
  if (body.length === 6) return `#${body}`;
  return `#${body[0]}${body[0]}${body[1]}${body[1]}${body[2]}${body[2]}`;
}

function toRgb(hex: string): [number, number, number] {
  const h = normalizeHex(hex, CHART_TOKEN_FALLBACK.ink).slice(1);
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ];
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const toHexByte = (n: number) => Math.round(clamp01(n / 255) * 255).toString(16).padStart(2, '0');

/** 按比例把 a 往 b 混，ratio=0 得 a，ratio=1 得 b */
export function mixHex(a: string, b: string, ratio: number): string {
  const t = clamp01(ratio);
  const [r1, g1, b1] = toRgb(a);
  const [r2, g2, b2] = toRgb(b);
  return `#${toHexByte(r1 + (r2 - r1) * t)}${toHexByte(g1 + (g2 - g1) * t)}${toHexByte(
    b1 + (b2 - b1) * t,
  )}`;
}

/** 半透明版本：网格线、面积的底色都用它 */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp01(alpha)})`;
}

/**
 * 阶梯色板：三色轮转，每轮往白色混一点。
 * 类别环形图最多 7 个扇区，色板必须保证相邻两色看得出区别，不能靠随机。
 */
export function buildPalette(tokens: ChartTokens, count: number): string[] {
  const bases = [
    normalizeHex(tokens.blush, CHART_TOKEN_FALLBACK.blush),
    normalizeHex(tokens.sky, CHART_TOKEN_FALLBACK.sky),
    normalizeHex(tokens.lilac, CHART_TOKEN_FALLBACK.lilac),
  ];
  const n = Math.max(0, Math.trunc(count));
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const base = bases[i % bases.length];
    const tier = Math.floor(i / bases.length);
    out.push(tier === 0 ? base : mixHex(base, '#ffffff', Math.min(0.24 * tier, 0.6)));
  }
  return out;
}

/** 从任意「变量名 → 值」的读取函数组装令牌，客户端传 CSS 变量读取器即可 */
export function tokensFrom(read: (cssVar: string) => string): ChartTokens {
  const pick = (key: keyof ChartTokens) =>
    normalizeHex(read(TOKEN_VARS[key]), CHART_TOKEN_FALLBACK[key]);
  return {
    blush: pick('blush'),
    sky: pick('sky'),
    lilac: pick('lilac'),
    ink: pick('ink'),
    inkSoft: pick('inkSoft'),
    panel: pick('panel'),
    cream: pick('cream'),
  };
}
