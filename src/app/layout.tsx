// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Inter は必要に応じて残す（実際は Noto Sans JP を globals.css で指定）
import "./globals.css";
import Providers from "../components/Providers";
import BrowserFallback from "../components/BrowserFallback";

// Inter の設定は削除しても構いませんが、後方互換のため残しています。
// 実際のフォントは globals.css で上書きされます。

export const metadata: Metadata = {
  title: "販売・在庫管理 BIアプリ",
  description: "Notion同期データ - リアルタイム表示",
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/favicon.ico',
    apple: '/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BI-Dashboard',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <BrowserFallback>
          <Providers>{children}</Providers>
        </BrowserFallback>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) {
                      console.log('SW registered: ', registration.scope);
                    },
                    function(err) {
                      console.log('SW registration failed: ', err);
                    }
                  );
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}