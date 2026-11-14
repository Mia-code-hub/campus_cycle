import { getDb } from './db';
import type { AiCallLogRow } from '@/lib/ai/log';
import {
  summarizeByFeature,
  summarizeRows,
  type FeatureStat,
} from '@/lib/ai-log-view';

// AI 留痕的查询层（管理端用）。写入在 src/lib/ai/log.ts，不要在别处再写 INSERT。

export interface AiLogFilter {
  /** 空 / 'all' 表示不过滤；'!ok' 表示只要失败记录 */
  feature?: string | null;
  status?: string | null;
}

export interface AiLogListRow extends AiCallLogRow {
  owner_nickname: string | null;
  ref_item_title: string | null;
}

const SELECT_WITH_CONTEXT = `
  SELECT l.*, u.nickname AS owner_nickname, i.title AS ref_item_title
    FROM ai_call_logs l
    LEFT JOIN users u ON u.id = l.user_id
    LEFT JOIN items i ON i.id = l.ref_item_id`;

function whereOf(filter: AiLogFilter): { sql: string; params: string[] } {
  const clauses: string[] = [];
  const params: string[] = [];
  if (filter.feature && filter.feature !== 'all') {
    clauses.push('l.feature = ?');
    params.push(filter.feature);
  }
  if (filter.status && filter.status !== 'all') {
    if (filter.status === '!ok') {
      clauses.push("l.status <> 'ok'");
    } else {
      clauses.push('l.status = ?');
      params.push(filter.status);
    }
  }
  return { sql: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '', params };
}

export function listAiLogs(filter: AiLogFilter, limit = 20, offset = 0): AiLogListRow[] {
  const where = whereOf(filter);
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 20, 1), 100);
  const safeOffset = Math.max(Math.trunc(offset) || 0, 0);
  return getDb()
    .prepare(`${SELECT_WITH_CONTEXT}${where.sql} ORDER BY l.id DESC LIMIT ? OFFSET ?`)
    .all(...where.params, safeLimit, safeOffset) as AiLogListRow[];
}

export function countAiLogs(filter: AiLogFilter = {}): number {
  const where = whereOf(filter);
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS c FROM ai_call_logs l${where.sql}`)
    .get(...where.params) as { c: number };
  return row.c;
}

// 只取四列做聚合：prompt / 响应正文几百 KB，统计不该把它们读进内存
interface StatRow {
  feature: string;
  status: string;
  latency_ms: number | null;
  created_at: string;
}

function loadStatRows(): StatRow[] {
  return getDb()
    .prepare('SELECT feature, status, latency_ms, created_at FROM ai_call_logs')
    .all() as StatRow[];
}

export function featureStats(): FeatureStat[] {
  return summarizeByFeature(loadStatRows());
}

// 功能筛选条只显示库里真有数据的功能，再加没登记过的（避免数据被藏起来）
export function featureTabs(): Array<{ feature: string; label: string; total: number }> {
  return featureStats().map((s) => ({ feature: s.feature, label: s.label, total: s.total }));
}

export function overallStat(): FeatureStat {
  return summarizeRows('all', loadStatRows());
}

// 导出用：按时间正序，方便对照「prompt 是怎么一步步改出来的」
export function listAiLogsForExport(feature?: string | null): AiCallLogRow[] {
  const where = feature && feature !== 'all' ? ' WHERE feature = ?' : '';
  const params = where ? [feature as string] : [];
  return getDb()
    .prepare(`SELECT * FROM ai_call_logs${where} ORDER BY id ASC`)
    .all(...params) as AiCallLogRow[];
}

// URL 参数归一化：只放行 feature 形状的标识（小写字母下划线），其余当「不过滤」。
// 不做枚举白名单，是因为库里可能残留枚举外的历史值，那些也该能被筛出来。
export function normalizeFeature(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (!v || v === 'all') return null;
  return /^[a-z][a-z_]{0,31}$/.test(v) ? v : null;
}

export function normalizeStatus(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (!v || v === 'all') return null;
  return ['ok', 'timeout', 'parse_error', 'api_error'].includes(v) ? v : null;
}
