'use client';

import { useEffect, useRef } from 'react';
import { echarts, type EChartsCoreOption } from './echarts';

export type { EChartsCoreOption };
export { echarts };

interface Props {
  option: EChartsCoreOption;
  /** 容器高度（px），给足高度避免首次绘制被压成 0 */
  height?: number;
  /** 读屏用的一句话说明，图表本身对辅助技术不可读 */
  label: string;
}

/**
 * ECharts 容器：只负责生命周期（init / setOption / resize / dispose），
 * 具体 option 由 buildOptions 里的纯函数生成。数据由服务端组件作为 props 传入，
 * 客户端不会再发一次请求。
 */
export default function EChart({ option, height = 280, label }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof echarts.init> | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const chart = echarts.init(host, undefined, { renderer: 'canvas' });
    chartRef.current = chart;

    // 容器宽度会随栅格/窗口变化，用 ResizeObserver 比监听 window.resize 准
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(host);

    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  // 第二个 effect 在 init 之后执行（同一轮 effect 按声明顺序跑），首帧就能拿到实例
  useEffect(() => {
    chartRef.current?.setOption(option, true);
  }, [option]);

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label={label}
      style={{ height, width: '100%' }}
      // min-w-0 + overflow-hidden：栅格子项默认 min-width:auto，画布一旦按旧宽度撑开，
      // 容器就再也缩不回去（移动端表现为图表右侧被裁掉、页面横向溢出）
      className="min-w-0 select-none overflow-hidden"
    />
  );
}
