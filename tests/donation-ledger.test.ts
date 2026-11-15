import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEDGER_COLUMNS,
  csvCell,
  escapeFormula,
  formatWeight,
  ledgerFileName,
  ledgerTotals,
  maskName,
  normalizeDateParam,
  toLedgerCsv,
  type LedgerRow,
} from '../src/lib/donation-ledger.ts';
import { toParagraphs } from '../src/lib/report/text.ts';

// 台账导出是给 Excel / WPS 直接双击的，坏一个引号就会整列错位，
// 所以这里连表头顺序、汇总行、公式注入都钉死。

function row(over: Partial<LedgerRow> = {}): LedgerRow {
  return {
    id: 1,
    donatedAt: '2026-11-10 09:30:00',
    applicationId: 7,
    itemId: 12,
    itemTitle: '高等数学 上册',
    category: 'textbook',
    categoryLabel: '教材',
    conditionLevel: '9成新',
    donorId: 2,
    donorNickname: '毕业生甲',
    donorCollege: '计算机学院',
    receiverId: 4,
    receiverNickname: '新生甲',
    receiverCollege: '外国语学院',
    weightKg: 2.5,
    letterId: 3,
    letterSource: 'ai',
    ...over,
  };
}

test('CSV 单元格：全部加引号，内部引号翻倍', () => {
  assert.equal(csvCell('教材'), '"教材"');
  assert.equal(csvCell('他说"好"'), '"他说""好"""');
  assert.equal(csvCell(''), '""');
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell(12), '"12"');
  // 带逗号与换行的字段不会把表格撑坏
  assert.equal(csvCell('a,b\nc'), '"a,b\nc"');
});

test('公式注入防护：= + - @ 开头的单元格垫单引号', () => {
  assert.equal(escapeFormula('=1+1'), "'=1+1");
  assert.equal(escapeFormula('+86'), "'+86");
  assert.equal(escapeFormula('-5'), "'-5");
  assert.equal(escapeFormula('@sum'), "'@sum");
  assert.equal(escapeFormula('毕业生甲'), '毕业生甲');
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
});

test('重量统一两位小数，台账能直接求和', () => {
  assert.equal(formatWeight(2.5), '2.50');
  assert.equal(formatWeight(0.95), '0.95');
  assert.equal(formatWeight(0), '0.00');
});

test('汇总：去重捐赠人与受赠人，重量按明细求和', () => {
  const totals = ledgerTotals([
    row({ id: 1, weightKg: 2.5 }),
    row({ id: 2, weightKg: 1.25, donorId: 2, receiverId: 5, letterSource: 'template', letterId: 9 }),
    row({ id: 3, weightKg: 3.4, donorId: 3, receiverId: 5, letterSource: null, letterId: null }),
  ]);
  assert.equal(totals.count, 3);
  assert.equal(totals.weightKg, 7.15);
  assert.equal(totals.donors, 2);
  assert.equal(totals.receivers, 2);
  assert.equal(totals.aiLetters, 1);
  assert.equal(totals.templateLetters, 1);
  assert.equal(totals.noLetter, 1);
});

test('CSV 结构：表头 + 按时间正序的明细 + 一行汇总 + CRLF', () => {
  const rows = [
    row({ id: 2, donatedAt: '2026-11-12 10:00:00', itemTitle: '台灯', category: 'appliance', categoryLabel: '小家电', weightKg: 1.2 }),
    row({ id: 1, donatedAt: '2026-11-10 09:30:00' }),
  ];
  const csv = toLedgerCsv(rows);
  const lines = csv.trimEnd().split('\r\n');

  assert.equal(lines[0], LEDGER_COLUMNS.join(','));
  assert.equal(lines.length, 4); // 表头 + 2 条明细 + 汇总
  // 导出的顺序与台账页相反：表按时间正序，方便逐行累加对账
  assert.match(lines[1], /"1","2026-11-10 09:30:00"/);
  assert.match(lines[2], /"2","2026-11-12 10:00:00"/);
  assert.match(lines[1], /"教材","9成新","2\.50"/);
  assert.match(lines[3], /"合计","2 条"/);
  assert.match(lines[3], /"3\.70"/);
  assert.ok(csv.endsWith('\r\n'));
});

test('缺字段的台账也要导出，不能因为没填学院就少一行', () => {
  const csv = toLedgerCsv([
    row({ letterId: null, letterSource: null, donorCollege: null, receiverCollege: null, conditionLevel: null }),
  ]);
  assert.match(csv, /"未标注"/);
  assert.match(csv, /"未填写"/);
  assert.match(csv, /"未生成"/);
  assert.match(csv, /^.*"未生成".*$/m);
});

test('受赠人姓名导出脱敏，捐赠人保留原名', () => {
  assert.equal(maskName('新生甲'), '新**');
  assert.equal(maskName('李'), '李');
  assert.equal(maskName('欧阳小明'), '欧***');
  assert.equal(maskName(''), '未填写');
  assert.equal(maskName(null), '未填写');

  const csv = toLedgerCsv([row()]);
  assert.match(csv, /"新\*\*"/);
  assert.match(csv, /"毕业生甲"/);
});

test('文件名带时间范围与导出时刻，且必须是纯 ASCII（中文会让响应头 500）', () => {
  assert.equal(
    ledgerFileName({ from: '2026-09-01', to: '2027-01-31', stamp: '20261115-1530' }),
    'donation-ledger-2026-09-01_2027-01-31-20261115-1530.csv',
  );
  assert.equal(
    ledgerFileName({ from: null, to: null, stamp: '20261115-1530' }),
    'donation-ledger-all-20261115-1530.csv',
  );
  const name = ledgerFileName({ from: null, to: '2026-11-15', stamp: 'x' });
  assert.match(name, /^[\x20-\x7e]+$/);
});

test('日期参数只认 YYYY-MM-DD', () => {
  assert.equal(normalizeDateParam('2026-11-15'), '2026-11-15');
  assert.equal(normalizeDateParam(' 2026-11-15 '), '2026-11-15');
  assert.equal(normalizeDateParam('2026-11-15; DROP TABLE donations'), null);
  assert.equal(normalizeDateParam('2026/11/15'), null);
  assert.equal(normalizeDateParam(''), null);
  assert.equal(normalizeDateParam(null), null);
});

test('段落切分：空行分段，段内折行合并', () => {
  assert.deepEqual(toParagraphs('第一段第一行\n第一段第二行\n\n第二段'), [
    '第一段第一行第一段第二行',
    '第二段',
  ]);
});
