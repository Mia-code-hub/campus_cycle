import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_FEATURE_ORDER,
  buildExportPayload,
  clipText,
  csvCell,
  featureLabel,
  formatMs,
  formatPercent,
  percentile,
  statusLabel,
  summarizeByFeature,
  summarizeRows,
  toCsv,
  type AiLogExportRow,
} from '../src/lib/ai-log-view.ts';

function log(feature: string, status: string, latency: number | null, id = 1) {
  return { feature, status, latency_ms: latency, created_at: `2026-11-14 22:0${id}:00` };
}

const sample: AiLogExportRow = {
  id: 7,
  feature: 'analyze',
  model: 'qwen-vl-max',
  user_id: 1,
  ref_item_id: null,
  prompt_text: '你是助手。\n输出 JSON，含 "category" 字段',
  response_text: '```json\n{"category":"textbook"}\n```',
  parsed_result: '{"category":"textbook"}',
  latency_ms: 1780,
  status: 'ok',
  created_at: '2026-11-14 22:10:03',
};

test('成功率按 ok 计，失败不剔除', () => {
  const stat = summarizeRows('moderate', [
    log('moderate', 'ok', 900, 1),
    log('moderate', 'ok', 1100, 2),
    log('moderate', 'api_error', 30, 3),
    log('moderate', 'timeout', 15000, 4),
  ]);
  assert.equal(stat.total, 4);
  assert.equal(stat.ok, 2);
  assert.equal(stat.failed, 2);
  assert.equal(stat.successRate, 0.5);
});

test('平均耗时只算成功调用，失败的超时不会把均值拉高', () => {
  const stat = summarizeRows('letter', [
    log('letter', 'ok', 1000, 1),
    log('letter', 'ok', 2000, 2),
    log('letter', 'timeout', 15000, 3),
  ]);
  assert.equal(stat.avgLatencyMs, 1500);
  assert.equal(stat.slowestLatencyMs, 2000);
});

test('全是失败时平均耗时为 null 而不是 0', () => {
  const stat = summarizeRows('letter', [log('letter', 'api_error', 120, 1)]);
  assert.equal(stat.avgLatencyMs, null);
  assert.equal(stat.slowestLatencyMs, null);
  assert.equal(stat.successRate, 0);
});

test('按功能分组后按 AI_FEATURE_ORDER 排序，未知功能排最后', () => {
  const stats = summarizeByFeature([
    log('letter', 'ok', 100, 1),
    log('search', 'ok', 2000, 2),
    log('zzz_new', 'ok', 10, 3),
    log('analyze', 'ok', 1800, 4),
  ]);
  assert.deepEqual(
    stats.map((s) => s.feature),
    ['analyze', 'search', 'letter', 'zzz_new'],
  );
});

test('percentile 用 nearest-rank，边界取两端', () => {
  assert.equal(percentile([], 0.95), null);
  assert.equal(percentile([42], 0.95), 42);
  assert.equal(percentile([10, 20, 30, 40], 0.5), 20);
  assert.equal(percentile([10, 20, 30, 40], 0.95), 40);
  assert.equal(percentile([10, 20, 30, 40], 1), 40);
});

test('CSV 转义：引号翻倍、换行原样保留、null 变空串', () => {
  assert.equal(csvCell('a"b'), '"a""b"');
  assert.equal(csvCell('第一行\n第二行'), '"第一行\n第二行"');
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell(0), '"0"');
});

test('CSV 表头固定，每行字段数与表头一致', () => {
  const csv = toCsv([sample]);
  const lines = csv.split('\r\n');
  assert.equal(lines[0], 'id,created_at,feature,feature_label,model,status,latency_ms,user_id,ref_item_id,prompt_text,response_text,parsed_result');
  assert.equal(lines[lines.length - 1], '');
  // 一个数据行里含换行，所以按引号外换行切分来数记录
  const records = csv.trimEnd().split(/\r\n(?=")/);
  assert.equal(records.length, 2);
  const cols = records[1].match(/"(?:[^"]|"")*"/g) ?? [];
  assert.equal(cols.length, 12);
  assert.ok(records[1].includes('""category""'));
});

test('JSON 导出包含统计与原文，prompt 不被截断', () => {
  const payload = buildExportPayload([sample], { exportedAt: '2026-11-14T23:00:00', feature: 'analyze' });
  assert.equal(payload.total, 1);
  assert.equal(payload.filter.feature, 'analyze');
  assert.equal(payload.stats[0].feature, 'analyze');
  assert.equal(payload.logs[0].prompt_text, sample.prompt_text);
  assert.equal(payload.logs[0].response_text, sample.response_text);
});

test('未登记的功能回落原始标识，不显示为空', () => {
  assert.equal(featureLabel('analyze'), '图文识别与文案');
  assert.equal(featureLabel('weird_one'), 'weird_one');
  assert.equal(statusLabel('parse_error'), '解析失败');
  assert.equal(statusLabel('unknown_status'), 'unknown_status');
});

test('展示用的耗时与百分比格式', () => {
  assert.equal(formatMs(null), '—');
  assert.equal(formatMs(940), '940 ms');
  assert.equal(formatMs(2340), '2.3 s');
  assert.equal(formatPercent(0.8333), '83.3%');
  assert.equal(formatPercent(1), '100.0%');
});

test('clipText 超长才截断，并标注原文长度', () => {
  assert.equal(clipText('abc', 10), 'abc');
  const clipped = clipText('x'.repeat(30), 10);
  assert.ok(clipped.startsWith('x'.repeat(10)));
  assert.ok(clipped.includes('原文共 30 字'));
});

test('功能枚举顺序作为唯一口径，7 个功能都在', () => {
  assert.equal(AI_FEATURE_ORDER.length, 7);
  assert.ok(AI_FEATURE_ORDER.includes('moderate'));
  assert.ok(AI_FEATURE_ORDER.includes('letter'));
});
