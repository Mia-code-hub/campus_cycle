import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Link from 'next/link';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { getCurrentUser } from '@/server/auth';
import { getReport, listRecentReports } from '@/server/reports';
import { toParagraphs } from '@/lib/report/text';
import TrendChart from '@/components/charts/TrendChart';
import CategoryDonut from '@/components/charts/CategoryDonut';
import ReportButton from '@/components/charts/ReportButton';
import PrintButton from '@/components/report/PrintButton';

// 报告是「某一刻的快照」，每次都按请求读库，不进静态外壳
export const instant = false;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default function AdminReportPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-4xl flex-1 items-center px-6 py-16 text-sm text-ink-soft">
          正在读取报告…
        </div>
      }
    >
      <ReportContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ReportContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/admin/report');
  if (user.role !== 'admin') redirect('/');

  await connection();

  const sp = await searchParams;
  const rawId = Number(first(sp.id));
  const id = Number.isSafeInteger(rawId) && rawId > 0 ? rawId : null;

  if (id === null) return <ReportList />;

  const report = getReport(id);
  if (!report) return <NotFound id={id} />;

  const { snapshot, check } = report;
  const payload = snapshot.payload;
  const verified = report.verify_status === 'pass';
  const paragraphs = verified ? toParagraphs(report.content) : [];

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-6 py-8 print:max-w-none print:px-0 print:py-0">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/admin"
            className="rounded-card-sm bg-panel px-3 py-1.5 text-ink shadow-soft transition hover:bg-cream"
          >
            ← 看板
          </Link>
          <Link
            href="/admin/report"
            className="rounded-card-sm px-3 py-1.5 text-ink-soft transition hover:bg-cream hover:text-ink"
          >
            历史报告
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <ReportButton label="再生成一份" />
          <PrintButton />
        </div>
      </div>

      <article className="report-sheet flex flex-col gap-6 rounded-card-lg bg-panel px-6 py-8 shadow-soft ring-1 ring-line print:gap-4 print:rounded-none print:px-0 print:py-0 print:shadow-none print:ring-0">
        <header className="border-b border-line-strong pb-4">
          <h1 className="text-xl font-semibold tracking-tight">{report.title}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-soft">
            <span>数据截至 {payload.asOfTime ?? report.created_at}</span>
            <span aria-hidden>·</span>
            <span>统计口径版本 {snapshot.caliberVersion ?? '—'}</span>
            <span aria-hidden>·</span>
            <span>模型 {report.model}</span>
            <span aria-hidden>·</span>
            <span>{report.char_count} 字</span>
            <span aria-hidden>·</span>
            <Badge tone={verified ? 'ok' : 'danger'} size="xs">
              {verified ? '数字校验通过' : '数字校验未通过'}
            </Badge>
          </p>
        </header>

        {verified ? (
          <section className="flex flex-col gap-4 text-[15px] leading-8">
            {paragraphs.map((p, i) => (
              <p key={i} className="indent-[2em]">
                {p}
              </p>
            ))}
          </section>
        ) : (
          <FailureCard
            reportId={report.id}
            issues={check?.issues ?? []}
            unmatched={check?.unmatched ?? []}
            source={report.payload_text}
          />
        )}

        <section className="break-inside-avoid">
          <h2 className="text-sm font-medium">关键数字</h2>
          <p className="mt-1 text-[11px] text-ink-soft">
            下列数字即模型可引用的全部数字；报告正文里的每一处数字都必须能在这里找到。
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(payload.keyFigures ?? []).map((f) => (
              <div key={f.label} className="rounded-card-sm px-3 py-2 ring-1 ring-line-strong">
                <dt className="text-[11px] text-ink-soft">{f.label}</dt>
                <dd className="mt-0.5 text-base font-medium tabular-nums">
                  {f.value}
                  <span className="ml-0.5 text-[11px] font-normal text-ink-soft">{f.unit}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="grid break-inside-avoid gap-4 sm:grid-cols-2">
          <figure className="rounded-card-sm p-3 ring-1 ring-line-strong">
            <figcaption className="mb-2 text-xs text-ink-soft">
              月度完成流转（按发布月份归集）
            </figcaption>
            <TrendChart data={snapshot.charts?.trend ?? []} />
          </figure>
          <figure className="rounded-card-sm p-3 ring-1 ring-line-strong">
            <figcaption className="mb-2 text-xs text-ink-soft">类别分布（占比按完成流转件数）</figcaption>
            <CategoryDonut data={snapshot.charts?.categories ?? []} />
          </figure>
        </section>

        <footer className="border-t border-line-strong pt-3 text-[11px] leading-6 text-ink-soft">
          <p>
            口径说明：已完成流转＝转售成交＋公益捐赠，不含下架与违规物品；折算重量按件折算后求和，
            减碳量＝折算重量 × 2.1，节约纸张按类目纸张占比折算，以上均为<strong>参考估算</strong>，非实测。
          </p>
          <p>
            生成方式：统计由服务端 SQL 聚合为快照 → 整份快照送入模型 → 模型正文经服务端逐字比对数字白名单，
            未通过校验的正文不展示。本页图表与数字均取自同一份快照，不随后续数据变化。
          </p>
          <p className="mt-1">
            报告 #{report.id} · 生成于 {report.created_at} · 口径版本 {snapshot.caliberVersion ?? '—'}
          </p>
        </footer>
      </article>
    </main>
  );
}

function FailureCard({
  reportId,
  issues,
  unmatched,
  source,
}: {
  reportId: number;
  issues: string[];
  unmatched: Array<{ raw: string; value: string }>;
  source: string;
}) {
  return (
    <Alert tone="danger" title="校验未通过，正文不展示">
      <p className="text-xs leading-6">
        模型这次写的正文里出现了统计数据里没有的数字，或字数不在 600-900 之间。
        按规则这份正文作废——它已留档（报告 #{reportId}），但不会出现在任何对外的页面与打印件上。
      </p>
      {issues.length > 0 && (
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-xs text-danger">
          {issues.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      )}
      {unmatched.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-danger">未命中白名单：</span>
          {unmatched.slice(0, 12).map((u) => (
            <code
              key={u.value}
              className="rounded bg-raise px-1.5 py-0.5 text-[11px] text-danger ring-1 ring-danger-line"
            >
              {u.raw}
            </code>
          ))}
          {unmatched.length > 12 && (
            <span className="text-[11px] text-danger">等 {unmatched.length} 个</span>
          )}
        </div>
      )}
      <div className="mt-3 print:hidden">
        <details>
          <summary className="cursor-pointer text-[11px] text-danger">展开本次送进模型的统计数据</summary>
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-card-sm bg-raise/80 p-3 text-[11px] leading-6 text-ink">
            {source}
          </pre>
        </details>
      </div>
      <div className="mt-3">
        <ReportButton label="再生成一份" />
      </div>
    </Alert>
  );
}

function ReportList() {
  const rows = listRecentReports(12);
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">环保报告</h1>
          <p className="mt-1 text-sm text-ink-soft">
            统计快照交给模型写成 600-900 字报告，数字必须原样引用；校验不通过的正文不展示。
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/admin"
            className="rounded-card-sm px-3 py-1.5 text-ink-soft transition hover:bg-cream hover:text-ink"
          >
            ← 看板
          </Link>
          <ReportButton label="生成一份报告" />
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-card-lg bg-panel px-5 py-10 text-center text-sm text-ink-soft shadow-soft">
          还没有生成过报告。点右上角「生成一份报告」，或从看板底部一键生成。
        </div>
      ) : (
        <div className="overflow-hidden rounded-card-lg bg-panel shadow-soft">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-ink-soft">
              <tr className="border-b border-line">
                <th className="px-4 py-2.5 font-normal">#</th>
                <th className="px-2 py-2.5 font-normal">生成时间</th>
                <th className="px-2 py-2.5 font-normal">字数</th>
                <th className="px-2 py-2.5 font-normal">校验</th>
                <th className="px-4 py-2.5 font-normal">模型</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/admin/report?id=${r.id}`} className="text-ink hover:underline">
                      #{r.id}
                    </Link>
                  </td>
                  <td className="px-2 py-3 text-xs text-ink-soft">{r.created_at}</td>
                  <td className="px-2 py-3 tabular-nums">{r.char_count}</td>
                  <td className="px-2 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        r.verify_status === 'pass'
                          ? 'bg-ok-soft text-ok'
                          : 'bg-danger-soft text-danger'
                      }`}
                    >
                      {r.verify_status === 'pass' ? '通过' : '未通过'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-soft">{r.model}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function NotFound({ id }: { id: number }) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-3 px-6 py-16">
      <h1 className="text-xl font-semibold tracking-tight">报告 #{id} 不存在</h1>
      <p className="text-sm text-ink-soft">可能已经被清理，或者链接里的编号不对。</p>
      <Link href="/admin/report" className="text-sm text-ink underline">
        看历史报告
      </Link>
    </main>
  );
}
