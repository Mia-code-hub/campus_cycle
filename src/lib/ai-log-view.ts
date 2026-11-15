// AI 留痕的「纯函数层」：功能口径、统计口径、CSV 序列化。
// 这里只有 import type，没有任何运行时依赖，node:test 可以直接导入断言。
// 写库（ai_call_logs）在 src/lib/ai/log.ts，查询在 src/server/ai-logs.ts。

// 展示顺序，同时也是 AiFeature 类型的唯一口径来源（log.ts 复用它）
export const AI_FEATURE_ORDER = [
  'analyze',
  'search',
  'moderate',
  'letter',
  'embed',
  'health',
  'report',
] as const;

export type AiFeatureName = (typeof AI_FEATURE_ORDER)[number];

export interface AiFeatureMeta {
  /** 给用户看的名字 */
  label: string;
  /** 哪一轮引入的，答辩时方便对 timeline */
  round: string;
  /** 一句话说明这个功能要模型干什么 */
  purpose: string;
}

export const AI_FEATURE_META: Record<AiFeatureName, AiFeatureMeta> = {
  analyze: {
    label: '图文识别与文案',
    round: 'R10 / R11',
    purpose: '看图和一句话描述，产出类别、成色、标题、文案、标签，转售时附参考价',
  },
  search: {
    label: '语义检索导购',
    round: 'R12',
    purpose: '把用户的口语需求翻译成导购语，只能引用候选物品里的事实',
  },
  moderate: {
    label: '发布前审核',
    round: 'R13',
    purpose: '判定违禁品、危险品、药品、活体、不良内容、疑似校外倒卖',
  },
  letter: {
    label: '捐赠感谢信',
    round: 'R14',
    purpose: '按捐赠记录写 200-300 字感谢信，平视不煽情、不泄露受赠人身份',
  },
  embed: {
    label: '物品向量化',
    round: 'R12',
    purpose: '把物品标题与描述编码成 1024 维向量，供语义召回',
  },
  health: {
    label: '连通性自检',
    round: 'R9',
    purpose: '确认 key 与模型通道可用，顺带验证留痕落库',
  },
  report: {
    label: '环保效益报告',
    round: 'R18',
    purpose:
      '把统计快照写成 600-900 字报告，数字只能原样引用；服务端逐字比对白名单，不通过即作废',
  },
};

const UNKNOWN_META: AiFeatureMeta = {
  label: '未登记功能',
  round: '—',
  purpose: '库里出现了不在枚举里的 feature，检查是否漏改 CHECK 约束',
};

export function featureMeta(feature: string): AiFeatureMeta {
  return (AI_FEATURE_META as Record<string, AiFeatureMeta>)[feature] ?? UNKNOWN_META;
}

// 未知 feature 不隐藏，标签退回原始值，避免「查不到」变成「看不见」
export function featureLabel(feature: string): string {
  const meta = featureMeta(feature);
  return meta === UNKNOWN_META ? feature : meta.label;
}

export function isOkStatus(status: string): boolean {
  return status === 'ok';
}

export const STATUS_TEXT: Record<string, string> = {
  ok: '成功',
  timeout: '超时',
  parse_error: '解析失败',
  api_error: '调用失败',
};

export function statusLabel(status: string): string {
  return STATUS_TEXT[status] ?? status;
}

// ——— 统计 ———

export interface AiLogStatRow {
  feature: string;
  status: string;
  latency_ms: number | null;
}

export interface FeatureStat {
  feature: string;
  label: string;
  round: string;
  total: number;
  ok: number;
  failed: number;
  /** 0-1；无调用时为 0 */
  successRate: number;
  /** 只统计成功调用的平均耗时：失败多在百毫秒内返回，混进去会把均值算小 */
  avgLatencyMs: number | null;
  slowestLatencyMs: number | null;
  p95LatencyMs: number | null;
  /** 最近一次调用时间，用于确认「这个功能真的被跑过」 */
  lastCalledAt: string | null;
}

// nearest-rank 分位数：升序数组，p ∈ (0,1]
export function percentile(sortedAsc: number[], p: number): number | null {
  if (sortedAsc.length === 0) return null;
  const rank = Math.ceil(p * sortedAsc.length);
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, rank - 1));
  return sortedAsc[idx];
}

export function avgOf(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round(sum / values.length);
}

interface StatRowWithTime extends AiLogStatRow {
  created_at?: string | null;
}

export function summarizeByFeature(rows: StatRowWithTime[]): FeatureStat[] {
  const buckets = new Map<string, StatRowWithTime[]>();
  for (const row of rows) {
    const list = buckets.get(row.feature);
    if (list) list.push(row);
    else buckets.set(row.feature, [row]);
  }

  const order = (feature: string) => {
    const i = (AI_FEATURE_ORDER as readonly string[]).indexOf(feature);
    return i === -1 ? AI_FEATURE_ORDER.length : i;
  };

  return [...buckets.keys()]
    .sort((a, b) => order(a) - order(b) || a.localeCompare(b))
    .map((feature) => summarizeRows(feature, buckets.get(feature) ?? []));
}

export function summarizeRows(feature: string, rows: StatRowWithTime[]): FeatureStat {
  const latencies = rows
    .filter((r) => isOkStatus(r.status) && typeof r.latency_ms === 'number')
    .map((r) => r.latency_ms as number)
    .sort((a, b) => a - b);
  const ok = rows.filter((r) => isOkStatus(r.status)).length;
  const times = rows
    .map((r) => r.created_at)
    .filter((t): t is string => typeof t === 'string' && t.length > 0)
    .sort();

  return {
    feature,
    label: featureLabel(feature),
    round: featureMeta(feature).round,
    total: rows.length,
    ok,
    failed: rows.length - ok,
    successRate: rows.length === 0 ? 0 : ok / rows.length,
    avgLatencyMs: avgOf(latencies),
    slowestLatencyMs: latencies.length === 0 ? null : latencies[latencies.length - 1],
    p95LatencyMs: percentile(latencies, 0.95),
    lastCalledAt: times.length === 0 ? null : times[times.length - 1],
  };
}

// ——— 格式化 ———

export function formatMs(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

// CSV 里的长文本（prompt / 响应）按字符截断，避免一份表格几十 MB
export function clipText(text: string, max: number): string {
  if (max <= 0 || text.length <= max) return text;
  return `${text.slice(0, max)}\n…（已截断，原文共 ${text.length} 字）`;
}

// ——— CSV 导出 ———

export interface AiLogExportRow {
  id: number;
  feature: string;
  model: string;
  user_id: number | null;
  ref_item_id: number | null;
  prompt_text: string;
  response_text: string;
  parsed_result: string | null;
  latency_ms: number | null;
  status: string;
  created_at: string;
}

export const AI_LOG_CSV_COLUMNS = [
  'id',
  'created_at',
  'feature',
  'feature_label',
  'model',
  'status',
  'latency_ms',
  'user_id',
  'ref_item_id',
  'prompt_text',
  'response_text',
  'parsed_result',
] as const;

// 全部字段一律加引号：prompt 里必然有换行和逗号，部分引用一定会把表格撑坏
export function csvCell(value: unknown): string {
  if (value == null) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function toCsv(rows: AiLogExportRow[]): string {
  const lines = [AI_LOG_CSV_COLUMNS.join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.id,
        row.created_at,
        row.feature,
        featureLabel(row.feature),
        row.model,
        row.status,
        row.latency_ms,
        row.user_id,
        row.ref_item_id,
        row.prompt_text,
        row.response_text,
        row.parsed_result,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  // CRLF：Excel 与 WPS 都能直接双击打开
  return `${lines.join('\r\n')}\r\n`;
}

// 按「功能分组 + 每节统计」的 JSON 结构，给导出和快照脚本共用同一套口径
export interface AiLogExportPayload {
  exportedAt: string;
  source: string;
  filter: { feature: string | null };
  total: number;
  stats: FeatureStat[];
  logs: AiLogExportRow[];
}

export function buildExportPayload(
  rows: AiLogExportRow[],
  opts: { feature?: string | null; exportedAt: string; source?: string },
): AiLogExportPayload {
  return {
    exportedAt: opts.exportedAt,
    source: opts.source ?? 'ai_call_logs',
    filter: { feature: opts.feature ?? null },
    total: rows.length,
    stats: summarizeByFeature(rows),
    logs: rows,
  };
}
