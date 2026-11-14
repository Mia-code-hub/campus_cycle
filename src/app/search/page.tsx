import Link from 'next/link';
import { Suspense } from 'react';
import { getCurrentUser } from '@/server/auth';
import { runSemanticSearch } from '@/server/search';
import ItemCard from '@/components/ItemCard';
import EmptyState from '@/components/EmptyState';
import SearchGuide from '@/components/search/SearchGuide';

// 搜索结果依赖 searchParams，页面按请求渲染；首页也是同样的配置
export const instant = false;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = (first(sp.q) ?? '').trim().slice(0, 100);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">语义找物</h1>
        <p className="text-sm text-ink-soft">
          用一句人话描述你想要的，按意思匹配而不是抠关键词。
        </p>
        <form action="/search" method="get" className="flex gap-2">
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="有没有便宜点的高数课本"
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

      {q ? (
        <Suspense key={q} fallback={<SearchSkeleton />}>
          <SearchResults q={q} />
        </Suspense>
      ) : (
        <EmptyState
          title="输入一句话开始找，比如「有没有便宜点的高数课本」"
          actionHref="/"
          actionLabel="先逛逛全部在架"
        />
      )}
    </main>
  );
}

function SearchSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="h-24 animate-pulse rounded-card-lg bg-panel shadow-soft" />
      <p className="text-xs text-ink-soft">正在理解你的需求…</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-56 animate-pulse rounded-card bg-panel shadow-soft" />
        ))}
      </div>
    </div>
  );
}

function NoResult() {
  const tips = ['高数课本', '冬被', '台灯', '笔记本'];
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-card-lg bg-panel p-6 shadow-soft">
        <p className="text-sm leading-7 text-ink">
          没找到贴合的闲置。试着放宽描述：去掉型号、价格、品牌，只写物品本身；
          或换个说法再试一次。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {tips.map((t) => (
            <Link
              key={t}
              href={`/search?q=${encodeURIComponent(t)}`}
              className="rounded-full bg-cream px-3 py-1 text-xs text-ink-soft transition hover:bg-lilac/30 hover:text-ink"
            >
              {t}
            </Link>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/donate"
          className="rounded-card bg-blush px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-blush-deep"
        >
          去公益专区看看
        </Link>
        <Link
          href="/"
          className="rounded-card bg-panel px-5 py-2.5 text-sm text-ink shadow-soft transition hover:bg-cream"
        >
          浏览全部在架
        </Link>
        <Link href="/publish" className="text-sm text-ink-soft underline-offset-4 hover:underline">
          没有想要的？发布一条求物需求
        </Link>
      </div>
    </div>
  );
}

async function SearchResults({ q }: { q: string }) {
  const viewer = await getCurrentUser();
  const out = await runSemanticSearch(q, viewer?.id ?? null);

  if (out.items.length === 0) return <NoResult />;

  return (
    <div className="flex flex-col gap-5">
      <SearchGuide text={out.guide} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-soft">
          {out.degraded
            ? (out.reason ?? '语义检索暂不可用，已按关键词召回')
            : `语义匹配到 ${out.items.length} 件，按相关度排序`}
        </p>
        {out.degraded && (
          <span className="rounded-full bg-cream px-2 py-0.5 text-[11px] text-ink-soft">
            关键词召回
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {out.items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            matchPercent={item.similarity == null ? null : item.similarity}
          />
        ))}
      </div>
    </div>
  );
}
