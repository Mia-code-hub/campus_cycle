import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import MobileTabBar from "@/components/layout/MobileTabBar";
import NavProgress from "@/components/layout/NavProgress";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "校园闲置物资循环 AI 平台",
  description:
    "校内闲置教材与生活用品的双通道流转：低价转售、公益捐赠给困难生，AI 辅助发布与语义匹配。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      {/* 底部留白给移动端标签栏，含 iOS 安全区；桌面上这笔留白归零 */}
      <body className="flex min-h-full flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0 print:pb-0">
        {/* 键盘用户的第一个可聚焦元素：跳过导航直达正文 */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-card-sm focus:bg-panel focus:px-4 focus:py-2 focus:text-sm focus:shadow-lift"
        >
          跳到主要内容
        </a>

        <ToastProvider>
          <Suspense
            fallback={<div className="h-14 border-b border-line bg-panel" aria-hidden="true" />}
          >
            <Navbar />
          </Suspense>

          <Suspense fallback={null}>
            <NavProgress />
          </Suspense>

          {/* 正文地标：页面自己的 <main> 在里面，跳转链接聚焦到这里 */}
          <div id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
            {children}
          </div>

          <MobileTabBar />
        </ToastProvider>
      </body>
    </html>
  );
}
