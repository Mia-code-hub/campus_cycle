/**
 * AI 思考中的三点跳动。
 * 纯 CSS 动画（--animate-dot），三层延迟错开；prefers-reduced-motion 交给全局兜底。
 * 对读屏不可见——按钮文案本身已经说了「AI 正在思考…」。
 */
export default function ThreeDots({ className }: { className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      <span className="inline-flex items-end gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="inline-block h-1 w-1 rounded-full bg-current animate-dot"
            style={{ animationDelay: `${i * 130}ms` }}
          />
        ))}
      </span>
    </span>
  );
}
