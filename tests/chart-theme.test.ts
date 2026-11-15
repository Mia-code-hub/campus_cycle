import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHART_TOKEN_FALLBACK,
  TOKEN_VARS,
  buildPalette,
  mixHex,
  normalizeHex,
  tokensFrom,
  withAlpha,
} from '../src/lib/chart-theme.ts';

// 图表配色的关键性质在这里钉住：颜色只能来自主题令牌，混色/透明不能被写成任意字符串，
// 否则 ECharts 会静默画成黑色而页面上看不出来。

test('归一化：#abc 展开、大写转小写、脏值退回兜底', () => {
  assert.equal(normalizeHex('#F7B2BD', '#000000'), '#f7b2bd');
  assert.equal(normalizeHex('  #abc  ', '#000000'), '#aabbcc');
  assert.equal(normalizeHex('blush', '#f7b2bd'), '#f7b2bd');
  assert.equal(normalizeHex('', CHART_TOKEN_FALLBACK.sky), '#a8d8ea');
  assert.equal(normalizeHex(undefined, '#A8D8EA'), '#a8d8ea');
});

test('混色：ratio 0 取左、1 取右、0.5 取中间，越界被夹住', () => {
  assert.equal(mixHex('#000000', '#ffffff', 0), '#000000');
  assert.equal(mixHex('#000000', '#ffffff', 1), '#ffffff');
  assert.equal(mixHex('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(mixHex('#000000', '#ffffff', 5), '#ffffff');
  assert.equal(mixHex('#000000', '#ffffff', -1), '#000000');
});

test('透明度：输出合法的 rgba，alpha 被夹在 0–1', () => {
  assert.equal(withAlpha('#4a4a55', 0.06), 'rgba(74, 74, 85, 0.06)');
  assert.equal(withAlpha('#ffffff', 2), 'rgba(255, 255, 255, 1)');
  assert.equal(withAlpha('#000000', -3), 'rgba(0, 0, 0, 0)');
});

test('色板：长度正确、全是合法十六进制、7 个类别两两不同', () => {
  const palette = buildPalette(CHART_TOKEN_FALLBACK, 7);
  assert.equal(palette.length, 7);
  assert.ok(palette.every((c) => /^#[0-9a-f]{6}$/.test(c)), palette.join(','));
  assert.equal(new Set(palette).size, 7);
  // 前三色就是主题三色，顺序固定，图表颜色不会每次构建都变
  assert.deepEqual(palette.slice(0, 3), ['#f7b2bd', '#a8d8ea', '#c7ceea']);
  assert.equal(buildPalette(CHART_TOKEN_FALLBACK, 0).length, 0);
});

test('令牌读取：缺失的变量逐个退回兜底，不整块丢弃', () => {
  const tokens = tokensFrom((name) => {
    if (name === TOKEN_VARS.blush) return '#FF0000';
    if (name === TOKEN_VARS.ink) return 'not-a-color';
    return '';
  });
  assert.equal(tokens.blush, '#ff0000');
  assert.equal(tokens.ink, CHART_TOKEN_FALLBACK.ink);
  assert.equal(tokens.sky, CHART_TOKEN_FALLBACK.sky);
  assert.equal(tokens.panel, CHART_TOKEN_FALLBACK.panel);
  // 令牌表与实际使用的键一一对应，漏一个就会出现 undefined 颜色
  assert.deepEqual(
    Object.keys(TOKEN_VARS).sort(),
    Object.keys(CHART_TOKEN_FALLBACK).sort(),
  );
});
