'use client';

import React, { useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const DASHBOARD_URL = 'https://bi-dashboard-phi-five.vercel.app/dashboard';

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isSupportedBrowser, setIsSupportedBrowser] = useState(true);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    // Chrome, Safari, Edge (Chromium) はサポート
    const isSupported = ua.includes('chrome') || ua.includes('safari') || ua.includes('edg');
    setIsSupportedBrowser(isSupported);
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/dashboard');
    }
  }, [status, router]);

  if (status === 'authenticated') {
    return null;
  }

  // 非対応ブラウザの場合：Chrome起動画面
  if (!isSupportedBrowser) {
    const isAndroid = /android/i.test(navigator.userAgent);
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">このブラウザはサポートされていません</h2>
          <p className="text-sm text-slate-500 mb-6">
            BIダッシュボードを表示するには <strong>Google Chrome</strong> または <strong>Safari</strong> が必要です。
          </p>
          <div className="space-y-3">
            <button
              onClick={() => {
                if (isAndroid) {
                  // Android: まずカスタムURLスキームでChromeを開くことを試みる
                  const chromeCustomUrl = 'googlechrome://bi-dashboard-phi-five.vercel.app/dashboard';
                  const chromeMarketUrl = 'https://play.google.com/store/apps/details?id=com.android.chrome';
                  
                  // 一定時間後にChromeが開かなければPlayストアに飛ばす
                  const timeout = setTimeout(() => {
                    window.location.href = chromeMarketUrl;
                  }, 2000);

                  // ChromeカスタムURLを試す
                  window.location.href = chromeCustomUrl;

                  // ページがバックグラウンドになったらタイマーをクリア
                  window.addEventListener('blur', () => {
                    clearTimeout(timeout);
                  });
                } else {
                  // iOS/その他: URLをクリップボードにコピー
                  navigator.clipboard
                    .writeText(DASHBOARD_URL)
                    .then(() => {
                      alert('URLをコピーしました。\nSafari または Chrome で開いてください。');
                    });
                }
              }}
              className="block w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl shadow-md hover:bg-indigo-700 transition-all"
            >
              {isAndroid ? 'Chromeで開く' : 'URLをコピーして開く'}
            </button>
            <button
              onClick={() => {
                navigator.clipboard
                  .writeText(DASHBOARD_URL)
                  .then(() => {
                    alert('URLをコピーしました。\n対応ブラウザで開いてください。');
                  });
              }}
              className="block w-full px-6 py-3 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-all"
            >
              URLをコピー
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-6">
            Chromeで開いた後、メニューから「ホーム画面に追加」すると<br />アプリのように使えます。
          </p>
        </div>
      </div>
    );
  }

  // 通常のログイン画面
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-slate-100 p-8 text-center">
        <div className="mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-xl mx-auto flex items-center justify-center mb-4 shadow-md">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Sun Auto Project BIシステム</h1>
          <p className="text-sm text-slate-500 mt-2">指定のGoogleアカウントでログインしてください</p>
        </div>

        <button
          onClick={() => signIn('google')}
          className="w-full flex items-center justify-center bg-white border border-slate-300 text-slate-700 font-medium text-lg px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
        >
          <svg className="w-6 h-6 mr-3" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Googleでログイン
        </button>

        <div className="mt-8 text-xs text-slate-400">
          <p>サイネージモードへの直接アクセスは、<br/>専用のURLとトークンをご利用ください。</p>
        </div>
      </div>
    </div>
  );
}