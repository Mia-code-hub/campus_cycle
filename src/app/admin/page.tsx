import Link from 'next/link';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { getCurrentUser } from '@/server/auth';
import { getDb } from '@/server/db';
import { getPlatformStats, statsCaliber } from '@/server/stats';
import { METRIC_CALIBER, PERIOD_CALIBER } from '@/lib/stats-defs';
import MetricCard from '@/components/charts/MetricCard';
import ChartCard from '@/components/charts/ChartCard';
import TrendChart from '@/components/charts/TrendChart';
import CategoryDonut from '@/components/charts/CategoryDonut';
import ModeBars from '@/components/charts/ModeBars';
import CollegeBars from '@/components/charts/CollegeBars';
import ReportButton from '@/components/charts/ReportButton';

export const instant = false;

const TREND_MONTHS = 6;

export default function AdminDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-6xl flex-1 items-center px-6 py-16 text-sm text-ink-soft">
          正在汇总数据…
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/admin');
  if (user.role !== 'admin') redirect('/');

  // 看板要的是「此刻」的数据：先声明这是按请求渲染的，不能进静态外壳。
  // 否则 Next 16 的 cacheComponents 会在预渲染阶段碰到 new Date() 直接报错，
  // 表现是页面骨架出来了、四个图表全空。
  await connection();

  // 服务端一次查全：四张图的数据都在这里算好，作为 props 传给客户端图表组件，
  // 页面打开后客户端不再发第二次请求，首屏就是完整图表。
  const stats = getPlatformStats(getDb(), { months: TREND_MONTHS });
  const caliber = statsCaliber(TREND_MONTHS);
  const { overview, trend, categories, modeSplit, modeByCategory, collegeBenefit } = stats;

  const donationShare = Math.round(modeSplit.donateShare * 100);
  const saleShare = Math.round(modeSplit.saleShare * 100);
  const topCollege = collegeBenefit[0];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">运营看板</h1>
          <p className="mt-1 text-sm text-ink-soft">
            数据截至 {stats.generatedAt} · 口径版本 {caliber.version} · 全部数字由服务端 SQL 聚合
          </p>
        </div>
        <div className="flex items-center gap-1 text-sm">
          <Link
            href="/admin/ai-logs"
            className="rounded-card-sm bg-panel px-3 py-1.5 text-ink shadow-soft transition hover:bg-cream"
          >
            AI 留痕 →
          </Link>
          <Link
            href="/admin/donations"
            className="rounded-card-sm px-3 py-1.5 text-ink transition hover:bg-cream"
          >
            捐赠台账
          </Link>
          <Link
            href="/admin/report"
            className="rounded-card-sm px-3 py-1.5 text-ink transition hover:bg-cream"
          >
            报告
          </Link>
          <Link
            href="/admin/violations"
            className="rounded-card-sm px-3 py-1.5 text-ink transition hover:bg-cream"
          >
            复核队列
          </Link>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="累计流转件数"
          value={overview.completedItems}
          unit="件"
          tone="blush"
          hint={`转售 ${overview.saleCount} 件 + 捐赠 ${overview.donateCount} 件`}
        />
        <MetricCard
          label="捐赠件数"
          value={overview.donateCount}
          unit="件"
          tone="sky"
          hint={`占完成流转 ${donationShare}% · 受益学生 ${overview.benefitedStudents} 人`}
        />
        <MetricCard
          label="节约纸张"
          value={overview.paperSavedKg}
          unit="kg"
          decimals={2}
          tone="lilac"
          hint="教材与文具按纸张占比折算"
        />
        <MetricCard
          label="减碳量"
          value={overview.co2SavedKg}
          unit="kgCO₂e"
          decimals={1}
          tone="blend"
          hint={`折算重量 ${overview.greenWeightKg} kg × 2.1，参考估算`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title={`月度完成流转（近 ${TREND_MONTHS} 个月）`}
          hint={`${PERIOD_CALIBER.trend.note}；合计 ${trend.reduce((s, p) => s + p.count, 0)} 件`}
        >
          <TrendChart data={trend} />
        </ChartCard>

        <ChartCard
          title="类别分布"
          hint={`${PERIOD_CALIBER.categories.note}；共 ${categories.length} 个类别`}
        >
          <CategoryDonut data={categories} />
        </ChartCard>

        <ChartCard
          title="转售与捐赠对比"
          hint={`完成流转 ${overview.completedItems} 件中，转售 ${saleShare}% · 捐赠 ${donationShare}%`}
        >
          <ModeBars data={modeByCategory} />
        </ChartCard>

        <ChartCard
          title="学院受益人数"
          hint={
            topCollege
              ? `${PERIOD_CALIBER.collegeBenefit.note}；受益最多的是${topCollege.college}`
              : PERIOD_CALIBER.collegeBenefit.note
          }
        >
          <CollegeBars data={collegeBenefit} />
        </ChartCard>
      </div>

      <section className="rounded-card-lg bg-panel p-5 shadow-soft ring-1 ring-black/5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">环保报告</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
              把上面这份统计快照交给模型写成 600-900 字报告，数字原样引用、不许推算；
              服务端逐字比对白名单，不通过的正文不展示。
            </p>
          </div>
          <ReportButton />
        </div>
      </section>

      <details className="rounded-card bg-cream/60 px-4 py-3 text-xs text-ink-soft ring-1 ring-black/5">
        <summary className="cursor-pointer select-none text-ink">统计口径（点开看每个数字怎么算的）</summary>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          {(
            [
              ['累计流转件数', METRIC_CALIBER.completedItems],
              ['捐赠件数', METRIC_CALIBER.donateCount],
              ['节约纸张', METRIC_CALIBER.paperSavedKg],
              ['减碳量', METRIC_CALIBER.co2SavedKg],
              ['折算重量', METRIC_CALIBER.greenWeightKg],
            ] as const
          ).map(([name, item]) => (
            <div key={name} className="rounded-card-sm bg-panel/70 px-3 py-2">
              <dt className="text-ink">{name}（{item.unit}）</dt>
              <dd className="mt-0.5 leading-relaxed">
                <code className="break-all text-[11px] text-ink-soft">{item.formula}</code>
                {item.note && <span className="mt-0.5 block">{item.note}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </main>
  );
}
