import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 设计令牌守门测试。
 *
 * 背景：R19 之前全站散着 bg-red-100 / border-black/10 / #ece3d3 这类硬编码色值，
 * 改一次配色要全文搜索，做深色模式更是无从下手。这一轮把颜色收敛到 globals.css 的 @theme，
 * 组件只允许写令牌类名。约定写在文档里没人守，所以让它变成一条会失败的测试：
 *   1. globals.css 必须定义这些语义令牌；
 *   2. src 下的组件源码里不许出现十六进制、rgb()/hsl()、Tailwind 默认调色板类名。
 */

const ROOT = join(import.meta.dirname, '..');
const CSS = readFileSync(join(ROOT, 'src/app/globals.css'), 'utf-8');

/** 组件层必须能用的语义令牌：缺一个，对应界面就会退回硬编码 */
const REQUIRED_TOKENS = [
  // 表面
  '--color-cream',
  '--color-panel',
  '--color-raise',
  '--color-sunken',
  // 描边
  '--color-line',
  '--color-line-strong',
  // 品牌
  '--color-blush',
  '--color-blush-deep',
  '--color-sky',
  '--color-sky-deep',
  '--color-lilac',
  '--color-lilac-deep',
  // 文字
  '--color-ink',
  '--color-ink-soft',
  // 语义
  '--color-ok',
  '--color-ok-soft',
  '--color-ok-line',
  '--color-warn',
  '--color-warn-soft',
  '--color-warn-line',
  '--color-danger',
  '--color-danger-deep',
  '--color-danger-soft',
  '--color-danger-line',
  // 遮罩与焦点
  '--color-scrim',
  '--color-focus',
  // 信纸
  '--color-paper',
  '--color-paper-line',
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(name)) out.push(full);
  }
  return out;
}

/** 只扫界面层：lib 里的 chart-theme / ui/tokens 是令牌镜像，允许持有兜底色值 */
function uiFiles(): string[] {
  return [...walk(join(ROOT, 'src/app')), ...walk(join(ROOT, 'src/components'))];
}

const FORBIDDEN: Array<{ name: string; re: RegExp }> = [
  { name: '十六进制色值', re: /#[0-9a-fA-F]{3,8}\b/g },
  { name: 'rgb()/hsl() 字面量', re: /\b(?:rgb|rgba|hsl|hsla)\s*\(/g },
  {
    name: 'Tailwind 默认调色板',
    re: /(?:^|[\s"'`])(?:bg|text|border|ring|from|via|to|fill|stroke|divide|outline|decoration|caret|accent)-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|blue|indigo|violet|purple|fuchsia|pink|rose)(?:\/[\d.]+)?/g,
  },
];

test('globals.css 定义了全部语义令牌', () => {
  const missing = REQUIRED_TOKENS.filter((t) => !CSS.includes(`${t}:`));
  assert.deepEqual(missing, [], `缺少令牌：${missing.join(', ')}`);
});

test('组件源码里没有硬编码色值', () => {
  const offenders: string[] = [];
  for (const file of uiFiles()) {
    const text = readFileSync(file, 'utf-8');
    for (const rule of FORBIDDEN) {
      for (const match of text.matchAll(rule.re)) {
        const line = text.slice(0, match.index).split('\n').length;
        offenders.push(`${file.replace(ROOT, '')}:${line} ${rule.name} → ${match[0].trim()}`);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `以下位置写死了颜色，请改用 tokens（globals.css @theme）：\n${offenders.join('\n')}`,
  );
});

test('画布取色走令牌镜像而不是就地写死', () => {
  // canvas 拿不到 CSS 类名，只能读具体颜色；这两处必须经 readPaintTokens()
  const letter = readFileSync(
    join(ROOT, 'src/components/letters/LetterExportButton.tsx'),
    'utf-8',
  );
  assert.ok(letter.includes('readPaintTokens'), '感谢信导出应从主题令牌取色');
  assert.ok(!letter.includes('rgba('), '印章的半透明应改用 globalAlpha，不写 rgba');

  const form = readFileSync(join(ROOT, 'src/components/publish/PublishForm.tsx'), 'utf-8');
  assert.ok(form.includes('readPaintTokens().raise'), '图片压缩垫底应取主题的抬起面');
});
