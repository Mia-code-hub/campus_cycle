import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth';
import {
  countAiLogs,
  featureStats,
  listAiLogs,
  normalizeFeature,
  overallStat,
} from '@/server/ai-logs';
import { featureLabel, formatMs, formatPercent, isOkStatus, statusLabel } from '@/lib/ai-log-view';
import EmptyState from '@/components/ui/EmptyState';
import Badge, { type BadgeTone } from '@/components/ui/Badge';

// 依赖 searchParams 做筛选，按请求渲染
export const instant = false;

const PAGE_SIZE = 20;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function buildHref(q: { feature?: string | null; status?: string | null; page?: number }): string {
  const params = new URLSearchParams();
  if (q.feature && q.feature !== 'all') params.set('feature', q.feature);
  if (q.status && q.status !== 'all') params.set('status', q.status);
  if (q.page && q.page > 1) params.set('page', String(q.page));
  const s = params.toString();
  return s ? `/admin/ai-logs?${s}` : '/admin/ai-logs';
}

/** 状态 → 语义色。ok 绿、超时/解析失败黄、接口错误红，与留痕页图例一致 */
const STATUS_TONE: Record<string, BadgeTone> = {
  ok: 'ok',
  timeout: 'warn',
  parse_error: 'warn',
  api_error: 'danger',
};

function prettyJson(raw: string | null): string | null {
  if (!raw) return null;
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export default async function AdminAiLogsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/admin/ai-logs');
  if (user.role !== 'admin') redirect('/');

  const sp = await searchParams;
  const feature = normalizeFeature(first(sp.feature));
  const statusParam = first(sp.status);
  // URL 上用 failed 更好读，落到 SQL 是 status <> 'ok'
  const status = statusParam === 'failed' ? '!ok' : statusParam === 'ok' ? 'ok' : null;
  const statusKey = statusParam === 'failed' ? 'failed' : statusParam === 'ok' ? 'ok' : null;
  const page = Math.max(1, Math.trunc(Number(first(sp.page) ?? 1)) || 1);

  const filter = { feature, status };
  const total = countAiLogs(filter);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = listAiLogs(filter, PAGE_SIZE, (current - 1) * PAGE_SIZE);

  const stats = featureStats();
  const overall = overallStat();
  const exportQuery = feature ? `&feature=${feature}` : '';

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI 调用留痕</h1>
          <p className="mt-1 text-sm text-ink-soft">
            共 {overall.total} 次调用 · 成功率 {formatPercent(overall.successRate)} · 平均耗时{' '}
            {formatMs(overall.avgLatencyMs)}
            {overall.lastCalledAt && ` · 最近一次 ${overall.lastCalledAt}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/admin/ai-logs/export?format=json${exportQuery}`}
            className="rounded-card-sm bg-panel px-3 py-1.5 text-sm text-ink shadow-soft transition hover:bg-cream"
          >
            导出 JSON
          </a>
          <a
            href={`/api/admin/ai-logs/export?format=csv${exportQuery}`}
            className="rounded-card-sm bg-panel px-3 py-1.5 text-sm text-ink shadow-soft transition hover:bg-cream"
          >
            导出 CSV
          </a>
          <Link
            href="/admin/violations"
            className="rounded-card-sm bg-panel px-3 py-1.5 text-sm text-ink shadow-soft transition hover:bg-cream"
          >
            复核队列 →
          </Link>
        </div>
      </div>

      <section className="rounded-card-lg bg-panel p-4 shadow-soft">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium">按功能统计</h2>
          <p className="text-[11px] text-ink-soft">平均耗时只统计成功的调用</p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs text-ink-soft">
              <tr className="border-b border-line">
                <th className="py-2 pr-3 font-normal">功能</th>
                <th className="py-2 pr-3 font-normal">轮次</th>
                <th className="py-2 pr-3 font-normal">调用</th>
                <th className="py-2 pr-3 font-normal">成功</th>
                <th className="py-2 pr-3 font-normal">成功率</th>
                <th className="py-2 pr-3 font-normal">平均耗时</th>
                <th className="py-2 font-normal">最慢</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.feature} className="border-b border-line last:border-0">
                  <td className="py-2 pr-3">
                    <Link
                      href={buildHref({ feature: s.feature, status: statusKey })}
                      className="text-ink hover:underline"
                    >
                      {s.label}
                    </Link>
                    <span className="ml-1.5 text-[11px] text-ink-soft">{s.feature}</span>
                  </td>
                  <td className="py-2 pr-3 text-xs text-ink-soft">{s.round}</td>
                  <td className="py-2 pr-3 tabular-nums">{s.total}</td>
                  <td className="py-2 pr-3 tabular-nums">
                    {s.ok}
                    {s.failed > 0 && (
                      <span className="ml-1 text-[11px] text-warn">（失败 {s.failed}）</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{formatPercent(s.successRate)}</td>
                  <td className="py-2 pr-3 tabular-nums">{formatMs(s.avgLatencyMs)}</td>
                  <td className="py-2 tabular-nums text-ink-soft">{formatMs(s.slowestLatencyMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-ink-soft">功能</span>
          <Link
            href={buildHref({ status: statusKey })}
            className={`rounded-full px-3 py-1 text-xs transition ${
              feature ? 'bg-panel text-ink-soft hover:text-ink' : 'bg-lilac text-ink'
            }`}
          >
            全部 {overall.total}
          </Link>
          {stats.map((s) => (
            <Link
              key={s.feature}
              href={buildHref({ feature: s.feature, status: statusKey })}
              className={`rounded-full px-3 py-1 text-xs transition ${
                feature === s.feature ? 'bg-lilac text-ink' : 'bg-panel text-ink-soft hover:text-ink'
              }`}
            >
              {s.label} {s.total}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-ink-soft">状态</span>
          {[
            { key: null, label: '全部' },
            { key: 'ok', label: '成功' },
            { key: 'failed', label: '失败 / 降级' },
          ].map((opt) => (
            <Link
              key={opt.label}
              href={buildHref({ feature, status: opt.key })}
              className={`rounded-full px-3 py-1 text-xs transition ${
                statusKey === opt.key
                  ? 'bg-sky text-ink'
                  : 'bg-panel text-ink-soft hover:text-ink'
              }`}
            >
              {opt.label}
            </Link>
          ))}
          <span className="ml-auto text-xs text-ink-soft">
            当前筛选 {total} 条
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="还没有留痕记录。跑一次发布、搜索或感谢信，这里就会有数据。"
          action={{ href: '/publish', label: '去发布一件' }}
        />
      ) : (
        <div className="overflow-hidden rounded-card-lg bg-panel shadow-soft">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-ink-soft">
              <tr className="border-b border-line">
                <th className="px-4 py-2.5 font-normal">时间</th>
                <th className="px-2 py-2.5 font-normal">功能</th>
                <th className="hidden px-2 py-2.5 font-normal sm:table-cell">模型</th>
                <th className="px-2 py-2.5 font-normal">耗时</th>
                <th className="px-2 py-2.5 font-normal">状态</th>
                <th className="px-4 py-2.5 font-normal">原文</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line align-top last:border-0">
                  <td className="px-4 py-3 text-xs text-ink-soft">
                    <div className="whitespace-nowrap">{row.created_at}</div>
                    <div className="text-[11px]">#{row.id}</div>
                  </td>
                  <td className="px-2 py-3">
                    <div className="text-xs" title={row.feature}>
                      {featureLabel(row.feature)}
                    </div>
                    {row.ref_item_id && (
                      <Link
                        href={`/items/${row.ref_item_id}`}
                        className="text-[11px] text-ink-soft hover:underline"
                      >
                        物品 #{row.ref_item_id}
                      </Link>
                    )}
                  </td>
                  <td className="hidden px-2 py-3 text-xs text-ink-soft sm:table-cell">
                    <div className="max-w-[10rem] break-all">{row.model}</div>
                  </td>
                  <td className="px-2 py-3 text-xs tabular-nums">{formatMs(row.latency_ms)}</td>
                  <td className="px-2 py-3">
                    <Badge tone={STATUS_TONE[row.status] ?? 'neutral'} size="sm">
                      {statusLabel(row.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <details className="group">
                      <summary className="cursor-pointer text-xs text-ink-soft transition group-open:text-ink hover:text-ink">
                        展开 prompt 与响应
                      </summary>
                      <div className="mt-2 flex flex-col gap-2">
                        <p className="text-[11px] text-ink-soft">
                          触发者：{row.owner_nickname ?? (row.user_id ? `#${row.user_id}` : '游客')}
                          {row.ref_item_title && ` · 关联物品《${row.ref_item_title}》`}
                          {' · '}耗时 {formatMs(row.latency_ms)}
                        </p>
                        <LogBlock title="Prompt 原文" body={row.prompt_text} />
                        <LogBlock
                          title={isOkStatus(row.status) ? '响应原文' : '响应原文（失败时记录的是错误信息）'}
                          body={row.response_text || '（空）'}
                        />
                        {prettyJson(row.parsed_result) && (
                          <LogBlock title="解析结果" body={prettyJson(row.parsed_result) as string} />
                        )}
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          {current > 1 ? (
            <Link
              href={buildHref({ feature, status: statusKey, page: current - 1 })}
              className="rounded-card-sm bg-panel px-3 py-1.5 text-ink shadow-soft transition hover:bg-cream"
            >
              ← 上一页
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-ink-soft">
            第 {current} / {pages} 页
          </span>
          {current < pages ? (
            <Link
              href={buildHref({ feature, status: statusKey, page: current + 1 })}
              className="rounded-card-sm bg-panel px-3 py-1.5 text-ink shadow-soft transition hover:bg-cream"
            >
              下一页 →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </main>
  );
}

function LogBlock({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-ink-soft">{title}</p>
      <pre className="mt-1 max-h-[26rem] overflow-auto whitespace-pre-wrap break-words rounded-card-sm bg-cream/70 p-3 text-[11px] leading-6 text-ink">
        {body}
      </pre>
    </div>
  );
}
