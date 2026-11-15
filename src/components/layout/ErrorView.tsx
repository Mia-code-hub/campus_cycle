import type { ReactNode } from 'react';

/** 异常页插画：两只粉彩色块 + 一只歪掉的纸箱，纯 SVG，不依赖图片资源 */
function ErrorArt() {
  return (
    <svg viewBox="0 0 160 120" className="h-28" fill="none" aria-hidden="true" focusable="false">
      <circle cx="52" cy="52" r="34" className="fill-blush/35" />
      <circle cx="106" cy="44" r="24" className="fill-lilac/40" />
      <path
        d="M44 78h72v30a4 4 0 0 1-4 4H48a4 4 0 0 1-4-4z"
        className="fill-sunken stroke-line-strong"
        strokeWidth="2"
      />
      <path d="M44 78 58 62h44l14 16" className="fill-panel stroke-line-strong" strokeWidth="2" />
      <path d="M44 78h72" className="stroke-line-strong" strokeWidth="2" />
      <path d="m96 62 8 16" className="stroke-line-strong" strokeWidth="2" strokeDasharray="3 4" />
      <circle cx="118" cy="30" r="4" className="fill-sky" />
      <circle cx="36" cy="26" r="3" className="fill-blush-deep/70" />
    </svg>
  );
}

interface ErrorViewProps {
  /** 小号标签：404 / 500 / 出错了 */
  code: string;
  title: string;
  description: ReactNode;
  /** 主次操作按钮，由调用方给（重试必须能拿到 reset） */
  actions: ReactNode;
  /** Next 的错误摘要，方便查日志；没有就不显示 */
  details?: string;
}

/**
 * 404 与运行时错误共用的版式：插画 + 一句话解释 + 出口。
 * 只讲「发生了什么、你能做什么」，不把堆栈甩给用户；技术细节留给 digest。
 */
export default function ErrorView({ code, title, description, actions, details }: ErrorViewProps) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <ErrorArt />
      <p className="mt-1 text-[11px] font-medium tracking-[0.3em] text-ink-soft uppercase">
        {code}
      </p>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      <p className="max-w-md text-sm leading-7 text-ink-soft">{description}</p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">{actions}</div>
      {details && <p className="mt-1 text-[11px] text-ink-soft">错误编号：{details}</p>}
    </main>
  );
}
