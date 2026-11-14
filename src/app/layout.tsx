import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";

export const metadata: Metadata = {
  title: "校园闲置物资循环 AI 平台",
  description:
    "校内闲置教材与生活用品的双通道流转：低价转售、公益捐赠给困难生，AI 辅助发布与语义匹配。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Suspense fallback={<div className="h-14 border-b border-black/5 bg-panel" />}>
          <Navbar />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
