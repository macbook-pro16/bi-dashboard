// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Inter は必要に応じて残す（実際は Noto Sans JP を globals.css で指定）
import "./globals.css";
import Providers from "../components/Providers";

// Inter の設定は削除しても構いませんが、後方互換のため残しています。
// 実際のフォントは globals.css で上書きされます。

export const metadata: Metadata = {
  title: "販売・在庫管理 BIアプリ",
  description: "Notion同期データ - リアルタイム表示",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}