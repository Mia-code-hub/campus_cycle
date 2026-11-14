// AI 导购语：逐字显示的打字机效果。
// 用纯 CSS 给每个字一个递增的 animation-delay，服务端就把整段文字渲染进 HTML，
// 不依赖 JS，也不会出现「先空白再打字」的水合闪烁。
const CHAR_DELAY_MS = 45;

export default function SearchGuide({ text }: { text: string }) {
  if (!text) return null;
  const chars = [...text];

  return (
    <section className="rounded-card-lg bg-lilac/20 p-5 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-lilac/50 px-2 py-0.5 text-[11px] font-medium text-ink">
          AI 导购
        </span>
        <span className="text-xs text-ink-soft">
          只依据在架物品信息生成，不含库存与价格承诺
        </span>
      </div>
      <p className="mt-3 text-sm leading-7 text-ink" aria-label={text}>
        {chars.map((ch, i) => (
          <span
            key={`${i}-${ch}`}
            className="guide-char"
            style={{ animationDelay: `${i * CHAR_DELAY_MS}ms` }}
            aria-hidden="true"
          >
            {ch}
          </span>
        ))}
      </p>
    </section>
  );
}
