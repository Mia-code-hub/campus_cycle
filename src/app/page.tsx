import Link from 'next/link';
import { listItems, toNum } from '@/server/items';
import ItemCard from '@/components/ItemCard';
import FilterBar from '@/components/FilterBar';

export const instant = false;

const PAGE_SIZE = 12;

const MODULES = [
  {
    title: '公益捐赠通道',
    desc: '闲置定向流转给通过审核的困难生，AI 生成捐赠标签与电子感谢信，全程留台账。',
    tone: 'bg-blush/25 text-blush-deep',
  },
  {
    title: 'AI 发布与语义找物',
    desc: '拍张照一句话，自动出类别、成色、文案与参考价；搜索按语义匹配而非关键词。',
    tone: 'bg-lilac/30 text-lilac-deep',
  },
  {
    title: '环保数据看板',
    desc: '流转件数、捐赠占比、折算减碳量自动统计，一键生成校园循环环保报告。',
    tone: 'bg-sky/30 text-sky-deep',
  },
];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function buildHref(
  base: { category: string; mode: string; condition: string; minPrice?: number; maxPrice?: number },
  page: number,
): string {
  const sp = new URLSearchParams();
  if (base.category) sp.set('category', base.category);
  if (base.mode) sp.set('mode', base.mode);
  if (base.condition) sp.set('condition', base.condition);
  if (base.minPrice != null) sp.set('minPrice', String(base.minPrice));
  if (base.maxPrice != null) sp.set('maxPrice', String(base.maxPrice));
  if (page > 1) sp.set('page', String(page));
  const qs = sp.toString();
  return qs ? `/?${qs}` : '/';
}

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const category = first(sp.category) ?? '';
  const mode = first(sp.mode) ?? '';
  const condition = first(sp.condition) ?? '';
  const minPrice = toNum(first(sp.minPrice));
  const maxPrice = toNum(first(sp.maxPrice));
  const page = Math.max(1, toNum(first(sp.page)) ?? 1);

  const { total, items } = listItems({
    category,
    mode,
    condition,
    minPrice,
    maxPrice,
    page,
    pageSize: PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasMore = page < totalPages;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-3">
        <span className="w-fit rounded-full bg-panel px-4 py-1 text-xs text-ink-soft shadow-soft">
          校内自用 · 线下自提 · 不涉及资金
        </span>
        <h1 className="text-3xl font-semibold tracking-tight">校园闲置物资循环 AI 平台</h1>

        <form action="/search" method="get" className="flex gap-2">
          <input
            name="q"
            type="search"
            placeholder="搜索你想要的闲置，如「高数教材」"
            className="flex-1 rounded-card-sm border border-black/10 bg-panel px-4 py-2.5 text-sm outline-none focus:border-blush-deep"
          />
          <button
            type="submit"
            className="rounded-card bg-lilac px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-lilac-deep"
          >
            搜索
          </button>
        </form>
      </header>

      <FilterBar
        category={category}
        mode={mode}
        condition={condition}
        minPrice={minPrice != null ? String(minPrice) : ''}
        maxPrice={maxPrice != null ? String(maxPrice) : ''}
      />

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card-lg bg-panel py-16 text-center shadow-soft">
          <p className="text-ink-soft">还没有闲置，去发布第一件</p>
          <Link
            href="/publish"
            className="rounded-card bg-blush px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-blush-deep"
          >
            去发布
          </Link>
        </div>
      ) : (
        <>
          <p className="text-xs text-ink-soft">共 {total} 件在架</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
          {hasMore ? (
            <div className="flex justify-center">
              <Link
                href={buildHref({ category, mode, condition, minPrice, maxPrice }, page + 1)}
                className="rounded-card bg-panel px-8 py-2.5 text-sm text-ink shadow-soft transition hover:bg-cream"
              >
                加载更多
              </Link>
            </div>
          ) : (
            <p className="text-center text-xs text-ink-soft">已经到底啦</p>
          )}
        </>
      )}

      <section className="rounded-card-lg bg-panel p-6 shadow-soft">
        <h2 className="text-base font-semibold">平台能力</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {MODULES.map((m) => (
            <article
              key={m.title}
              className="rounded-card bg-cream/70 p-5 shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-lift"
            >
              <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${m.tone}`}>
                模块
              </span>
              <h3 className="mt-3 text-base font-semibold">{m.title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-soft">{m.desc}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
