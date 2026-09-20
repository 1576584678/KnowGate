import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@/app/globals.css";
import { BottomNav } from "@/components/bottom-nav";
import { ProgressProvider } from "@/components/progress-provider";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "知关 KnowGate",
  description: "把每个年级的核心能力压缩成 10 个闯关里程碑。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#eff6ff",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <a className="skip-link" href="#main-content">
          跳到主要内容
        </a>
        <ProgressProvider>
          <SiteHeader />
          <main id="main-content">{children}</main>
          <BottomNav />
        </ProgressProvider>
      </body>
    </html>
  );
}
