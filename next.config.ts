import type { NextConfig } from "next";

// 全站响应头。这几项「不配就等于默认不安全」，而且加起来不到 10 行：
// - X-Frame-Options：不许被 iframe 嵌套，点击劫持最直接的防线
// - nosniff：浏览器别去猜 MIME，上传目录里混进奇怪文件也不会被当脚本跑
// - Referrer-Policy：跨站时不把完整 URL（含 id、查询串）带给第三方
// - Permissions-Policy：这个站用不到摄像头/麦克风/定位，直接关掉
//
// CSP 先用 Report-Only：Next 的 hydration 脚本与 ECharts 的 inline style 需要
// 'unsafe-inline'，直接开强制模式会把页面打白。先跑报告、看清楚再收紧。
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
];

const nextConfig: NextConfig = {
  // better-sqlite3 是原生模块，交给 Node 直接 require，别让打包器处理
  serverExternalPackages: ["better-sqlite3"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
