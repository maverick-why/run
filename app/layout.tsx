import type { Metadata } from "next";
import { Bebas_Neue } from "next/font/google";
import "./globals.css";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
});

export const metadata: Metadata = {
  title: "夏练三伏 — 时光酿造所",
  description: "跑多少，喝多少。上传上月跑量截图，兑换精酿代金券。",
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="zh-CN" className={bebasNeue.variable}>
      <body>{children}</body>
    </html>
  );
}
