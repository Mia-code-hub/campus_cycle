'use client';

/**
 * 打印 / 导出 PDF。
 * 浏览器原生 window.print() 就是最稳的 PDF 出口：不引第三方渲染库、
 * 中文与图表都由浏览器自己排版，打印对话框里选「另存为 PDF」即可。
 * 报告页另有 @media print 样式（见 globals.css），保证导航、按钮、阴影不进纸面。
 */
export default function PrintButton({ label = '打印 / 导出 PDF' }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-card-sm bg-panel px-3 py-1.5 text-sm text-ink shadow-soft transition hover:bg-cream print:hidden"
    >
      {label}
    </button>
  );
}
