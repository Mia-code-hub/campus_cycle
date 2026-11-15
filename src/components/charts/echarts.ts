import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TitleComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsCoreOption } from 'echarts/core';

// 按需注册：只引折线/柱状/饼图 + 网格/图例/提示框，整包 echarts 会把用不到的
// 地图、关系图、3D 全打进来。注册只做一次，放在不含 JSX 的模块里，
// 这样 option 构造函数也能被 node:test 直接引入。
echarts.use([
  LineChart,
  BarChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  CanvasRenderer,
]);

export { echarts };
export type { EChartsCoreOption };
