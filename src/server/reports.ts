import { getDb } from './db';
import { chat, hasModelKey } from '@/lib/ai/client';
import { withAiLog } from '@/lib/ai/withAiLog';
import { buildReportLogText, buildReportPrompt } from '@/lib/ai/prompts';
import {
  buildReportSnapshot,
  reportTitle,
  type ReportSnapshot,
} from '@/lib/report/payload';
import {
  REPORT_MAX_CHARS,
  REPORT_MIN_CHARS,
  allowlistList,
  retryHint,
  verifyReport,
  type ReportCheck,
} from '@/lib/report/verify';
import { normalizeReportText } from '@/lib/report/text';
import { getPlatformStats } from './stats';

// 环保报告编排层。
// 流程：SQL 聚合 → 快照 → prompt → 模型 → 服务端逐字校验 → 落库。
// 「校验不通过就不展示」在这里落成数据：verify_status 写 fail，页面读到 fail 就不渲染正文。

export type VerifyStatus = 'pass' | 'fail';

export interface ReportRow {
  id: number;
  title: string;
  content: string;
  model: string;
  months: number;
  char_count: number;
  verify_status: VerifyStatus;
  verify_json: string | null;
  snapshot_json: string;
  payload_text: string;
  created_by: number | null;
  created_at: string;
}

export interface ReportDetail extends ReportRow {
  snapshot: ReportSnapshot;
  check: ReportCheck | null;
}

/** 报告正文长，给足超时；可用 AI_REPORT_TIMEOUT_MS 覆盖 */
export const REPORT_TIMEOUT_MS = Number(process.env.AI_REPORT_TIMEOUT_MS ?? 120_000);
/** 第一次不过就带着具体问题重写一次；两次都不过就落一条 fail 记录 */
const MAX_ATTEMPTS = 2;

export function reportModel(): string {
  return process.env.LLM_MODEL ?? 'qwen-plus';
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getReport(id: number): ReportDetail | null {
  const row = getDb().prepare('SELECT * FROM reports WHERE id = ?').get(id) as ReportRow | undefined;
  if (!row) return null;
  return {
    ...row,
    snapshot: parseJson<ReportSnapshot>(row.snapshot_json, {} as ReportSnapshot),
    check: parseJson<ReportCheck | null>(row.verify_json, null),
  };
}

export function listRecentReports(limit = 10): ReportRow[] {
  const safe = Math.min(Math.max(Math.trunc(limit) || 10, 1), 50);
  return getDb()
    .prepare('SELECT * FROM reports ORDER BY id DESC LIMIT ?')
    .all(safe) as ReportRow[];
}

export type GenerateReportResult =
  | { ok: false; code: 'NO_MODEL' | 'api_error' | 'timeout'; message: string; logIds?: number[] }
  | {
      ok: true;
      report: ReportDetail;
      attempts: number;
      verified: boolean;
      message: string;
      logIds: number[];
    };

/**
 * 生成一份环保报告。
 * 只要模型返回了文本就一定落库（含校验失败的），因为「失败样本」也是这套机制的证据；
 * 通道级失败（超时、401、欠费）不落库，那种情况没有正文可留。
 */
export async function generateReport(
  opts: { userId?: number | null; months?: number } = {},
): Promise<GenerateReportResult> {
  const db = getDb();
  const months = Math.min(24, Math.max(1, Math.trunc(opts.months ?? 6)));
  const stats = getPlatformStats(db, { months });
  const snapshot = buildReportSnapshot(stats, months);
  const allowlist = allowlistList(snapshot.payloadText);
  const model = reportModel();

  if (!hasModelKey(model)) {
    return { ok: false, code: 'NO_MODEL', message: '未配置模型密钥，报告生成暂不可用' };
  }

  // 校验结果在 withAiLog 的 parse 回调里产生，用可变容器接住：
  // 用两个裸 let 会被 TS 的控制流分析判成「永远是 null」，容器属性不会被这样收窄
  const state: { check: ReportCheck | null; body: string } = { check: null, body: '' };
  let channelError: 'api_error' | 'timeout' | null = null;
  let attempts = 0;
  const logIds: number[] = [];

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    attempts = attempt + 1;
    const prompt = buildReportPrompt({
      payloadText: snapshot.payloadText,
      allowlist,
      months,
      minChars: REPORT_MIN_CHARS,
      maxChars: REPORT_MAX_CHARS,
      retry: attempt > 0 && state.check ? retryHint(state.check) : undefined,
    });

    const result = await withAiLog<{ text: string; check: ReportCheck }>({
      feature: 'report',
      model,
      userId: opts.userId ?? null,
      buildPrompt: () => buildReportLogText(prompt),
      run: () =>
        chat({
          model,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
          ],
          // 报告要稳：温度低一点，别让它在数字上自由发挥
          temperature: 0.3,
          maxTokens: 2400,
          timeoutMs: REPORT_TIMEOUT_MS,
          thinking: false,
        }),
      parse: (raw) => {
        const text = normalizeReportText(raw);
        const c = verifyReport(text, { source: snapshot.payloadText });
        state.check = c;
        state.body = text;
        // 返回 null 让 withAiLog 把这次调用记成 parse_error：
        // 留痕表里的失败率因此包含「模型答了但数字对不上」，这才是我们想看的失败率
        return c.ok ? { text, check: c } : null;
      },
    });

    logIds.push(result.logId);
    if (result.ok) break;
    if (result.kind !== 'parse_error') {
      channelError = result.kind === 'timeout' ? 'timeout' : 'api_error';
      break;
    }
    // parse_error = 内容不合格，值得带着具体问题再写一次
  }

  if (channelError) {
    return {
      ok: false,
      code: channelError,
      message:
        channelError === 'timeout'
          ? '模型响应超时，报告未生成，请稍后重试'
          : '模型通道暂时不可用，报告未生成',
      logIds,
    };
  }

  const { check, body } = state;
  if (!body || !check) {
    return { ok: false, code: 'api_error', message: '模型没有返回可用的正文', logIds };
  }

  const verified = check.ok;
  const info = db
    .prepare(
      `INSERT INTO reports
         (title, content, model, months, char_count, verify_status, verify_json, snapshot_json, payload_text, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      reportTitle(snapshot.payload),
      body,
      model,
      months,
      check.charCount,
      verified ? 'pass' : 'fail',
      JSON.stringify(check),
      JSON.stringify(snapshot),
      snapshot.payloadText,
      opts.userId ?? null,
    );

  const report = getReport(Number(info.lastInsertRowid));
  if (!report) {
    return { ok: false, code: 'api_error', message: '报告落库失败', logIds };
  }

  return {
    ok: true,
    report,
    attempts,
    verified,
    message: verified
      ? '报告已生成，数字全部来自统计快照'
      : '模型写的正文没有通过数字校验，已留档但不展示，可再生成一次',
    logIds,
  };
}
