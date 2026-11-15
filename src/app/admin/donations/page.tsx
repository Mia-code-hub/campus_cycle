import Link from 'next/link';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { getCurrentUser } from '@/server/auth';
import { listDonationLedger } from '@/server/donations';
import {
  formatWeight,
  ledgerTotals,
  normalizeDateParam,
} from '@/lib/donation-ledger';
import { CATEGORIES } from '@/lib/constants';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';

// 捐赠台账：一件捐赠一行，给对账与公益材料用。
// 导出走 /api/admin/donations/export，页面上的筛选条件原样带过去，看到什么就导出什么。

export const instant = false;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default function DonationsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-6xl flex-1 items-center px-6 py-16 text-sm text-ink-soft">
          正在读取台账…
        </div>
      }
    >
      <LedgerContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LedgerContent({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/admin/donations');
  if (user.role !== 'admin') redirect('/');

  await connection();

  const sp = await searchParams;
  const from = normalizeDateParam(first(sp.from));
  const to = normalizeDateParam(first(sp.to));
  const rawCategory = (first(sp.category) ?? '').trim();
  const category = CATEGORIES.some((c) => c.value === rawCategory) ? rawCategory : null;

  const rows = listDonationLedger({ from, to, category });
  const totals = ledgerTotals(rows);

  const query = new URLSearchParams();
  if (from) query.set('from', from);
  if (to) query.set('to', to);
  if (category) query.set('category', category);
  const suffix = query.toString() ? `&${query.toString()}` : '';

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">捐赠台账</h1>
          <p className="mt-1 text-sm text-ink-soft">
            共 {totals.count} 条 · 折算重量 {formatWeight(totals.weightKg)} kg · 捐赠人 {totals.donors} 人 ·
            受赠学生 {totals.receivers} 人 · 感谢信 AI {totals.aiLetters} 封 / 模板 {totals.templateLetters} 封
            {totals.noLetter > 0 && ` / 未生成 ${totals.noLetter} 封`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <a
            href={`/api/admin/donations/export?format=csv${suffix}`}
            className="rounded-card-sm bg-blush px-3 py-1.5 font-medium text-ink shadow-soft transition hover:bg-blush-deep"
          >
            导出 CSV
          </a>
          <a
            href={`/api/admin/donations/export?format=json${suffix}`}
            className="rounded-card-sm bg-panel px-3 py-1.5 text-ink shadow-soft transition hover:bg-cream"
          >
            导出 JSON
          </a>
          <Link
            href="/admin"
            className="rounded-card-sm px-3 py-1.5 text-ink-soft transition hover:bg-cream hover:text-ink"
          >
            ← 看板
          </Link>
        </div>
      </header>

      <form
        action="/admin/donations"
        method="get"
        aria-label="台账筛选"
        className="flex flex-wrap items-end gap-3 rounded-card bg-sunken px-4 py-3 text-sm ring-1 ring-line"
      >
        <Input
          label="起始日期"
          type="date"
          name="from"
          defaultValue={from ?? ''}
          wrapperClassName="w-36"
          className="py-1"
        />
        <Input
          label="截止日期"
          type="date"
          name="to"
          defaultValue={to ?? ''}
          wrapperClassName="w-36"
          className="py-1"
        />
        <Select label="类别" name="category" defaultValue={category ?? ''} wrapperClassName="w-40" className="py-1">
          <option value="">全部类别</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary" size="sm">
          筛选
        </Button>
        {(from || to || category) && (
          <Link href="/admin/donations" className="px-2 py-1.5 text-xs text-ink-soft hover:text-ink">
            清空条件
          </Link>
        )}
        <span className="ml-auto text-[11px] text-ink-soft">导出的就是当前筛选结果</span>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-card-lg bg-panel px-5 py-12 text-center text-sm text-ink-soft shadow-soft">
          这个条件下没有捐赠记录。
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card-lg bg-panel shadow-soft">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs text-ink-soft">
              <tr className="border-b border-line">
                <th className="px-4 py-2.5 font-normal">#</th>
                <th className="px-2 py-2.5 font-normal">交割时间</th>
                <th className="px-2 py-2.5 font-normal">物品</th>
                <th className="px-2 py-2.5 font-normal">类别</th>
                <th className="px-2 py-2.5 font-normal">重量</th>
                <th className="px-2 py-2.5 font-normal">捐赠人</th>
                <th className="px-2 py-2.5 font-normal">受赠人</th>
                <th className="px-2 py-2.5 font-normal">感谢信</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line align-top last:border-0">
                  <td className="px-4 py-3 text-xs text-ink-soft">{r.id}</td>
                  <td className="px-2 py-3 text-xs text-ink-soft">
                    <div className="whitespace-nowrap">{r.donatedAt.slice(0, 16)}</div>
                  </td>
                  <td className="px-2 py-3">
                    <Link href={`/items/${r.itemId}`} className="text-ink hover:underline">
                      {r.itemTitle}
                    </Link>
                    <div className="text-[11px] text-ink-soft">
                      #{r.itemId} · {r.conditionLevel ?? '成色未标注'}
                    </div>
                  </td>
                  <td className="px-2 py-3 text-xs">{r.categoryLabel}</td>
                  <td className="px-2 py-3 text-xs tabular-nums">{formatWeight(r.weightKg)} kg</td>
                  <td className="px-2 py-3 text-xs">
                    {r.donorNickname}
                    <div className="text-[11px] text-ink-soft">{r.donorCollege ?? '学院未填写'}</div>
                  </td>
                  <td className="px-2 py-3 text-xs">
                    {r.receiverNickname}
                    <div className="text-[11px] text-ink-soft">{r.receiverCollege ?? '学院未填写'}</div>
                  </td>
                  <td className="px-2 py-3">
                    {r.letterId ? (
                      <Link href={`/letters/${r.letterId}`} className="inline-block">
                        <Badge tone={r.letterSource === 'ai' ? 'ok' : 'warn'} size="sm">
                          {r.letterSource === 'ai' ? 'AI 生成' : '模板兜底'}
                        </Badge>
                      </Link>
                    ) : (
                      <span className="text-[11px] text-ink-soft">未生成</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="text-xs text-ink-soft">
                <td className="px-4 py-3" colSpan={4}>
                  合计 {totals.count} 条
                </td>
                <td className="px-2 py-3 tabular-nums">{formatWeight(totals.weightKg)} kg</td>
                <td className="px-2 py-3">{totals.donors} 人</td>
                <td className="px-2 py-3" colSpan={2}>
                  {totals.receivers} 名受赠学生
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="text-[11px] leading-6 text-ink-soft">
        台账口径：一条记录对应一次交割，重量取捐赠落库时的快照值（没有快照的老数据为 0，需要重算请见看板的折算口径）。
        导出的 CSV 带 UTF-8 BOM，WPS / Excel 双击即可正常显示中文；末尾附一行汇总；
        受赠人姓名在导出件里做脱敏（只保留首字），捐赠人保留原名以便致谢与对账。
      </p>
    </main>
  );
}
