import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BANNED_TERM_GROUPS,
  RISK_CATEGORIES,
  scanBannedTerms,
} from '../src/lib/banned-terms.ts';

function categoriesOf(text: string): string[] {
  return [...new Set(scanBannedTerms(text).map((h) => h.category))];
}

test('处方消炎药命中药品类，并带上命中词与规则', () => {
  const hits = scanBannedTerms('转让一盒处方消炎药，还没过期');
  assert.deepEqual(categoriesOf('转让一盒处方消炎药'), ['medical']);
  const first = hits[0];
  assert.ok(first.term === '处方药' || first.term === '消炎药');
  assert.equal(first.label, '药品与医疗器械');
  assert.ok(first.hint.includes('药品'));
});

test('正常二手物品一个词都不命中', () => {
  const cases = [
    '高等数学 上册，八成新，笔记齐全',
    '宿舍小风扇，九成新，静音三档',
    '猫咪抱枕一个，洗干净了',
    '剪刀两把 + 水果刀一把，厨房用',
    '硫酸纸一张，绘图没用完',
    '药盒收纳盒，分装一周的量',
  ];
  for (const text of cases) {
    assert.deepEqual(scanBannedTerms(text), [], `不该命中：${text}`);
  }
});

test('危险品与活体按类归位', () => {
  assert.deepEqual(categoriesOf('宿舍不能用酒精炉和酒精块'), ['dangerous']);
  assert.deepEqual(categoriesOf('送养两只仓鼠，笼子一起送'), ['animal']);
  assert.deepEqual(categoriesOf('防狼喷雾一支，没拆封'), ['dangerous']);
});

test('校外批量倒卖能识别，且与自用表述区分', () => {
  assert.deepEqual(categoriesOf('大量现货 一件代发 厂家直销'), ['offcampus']);
  assert.deepEqual(scanBannedTerms('我自己用的一件外套，穿了几次'), []);
});

test('多个类别同时命中时按词表顺序返回且不重复', () => {
  const hits = scanBannedTerms('医用酒精 配 处方药 一起处理');
  const cats = hits.map((h) => h.category);
  assert.ok(cats.includes('dangerous'));
  assert.ok(cats.includes('medical'));
  const terms = hits.map((h) => h.term);
  assert.equal(new Set(terms).size, terms.length);
  // 词表顺序：违禁品 → 危险品 → 药品 …，越靠前优先级越高
  assert.ok(cats.indexOf('dangerous') < cats.indexOf('medical'));
});

test('英文词大小写都能命中', () => {
  assert.equal(scanBannedTerms('BB弹一包')[0]?.category, 'prohibited');
  assert.equal(scanBannedTerms('bb弹一包')[0]?.category, 'prohibited');
});

test('空文本与纯空白不命中', () => {
  assert.deepEqual(scanBannedTerms(''), []);
  assert.deepEqual(scanBannedTerms('   \n\t '), []);
});

test('词表内部结构自检：类别合法、无重复词、无单字词', () => {
  for (const g of BANNED_TERM_GROUPS) {
    assert.ok(RISK_CATEGORIES.includes(g.category), `未知类别：${g.category}`);
    assert.ok(g.label.length > 0);
    assert.ok(g.hint.length > 0);
    for (const t of g.terms) {
      assert.ok(t.trim().length >= 2, `词条过短易误杀：${t}`);
    }
  }
  const all = BANNED_TERM_GROUPS.flatMap((g) => g.terms);
  assert.equal(new Set(all).size, all.length, '词条在多个类别里重复');
});
