'use client';
import React, { useEffect, useState } from 'react';

export default function BrowserFallback({ children }: { children: React.ReactNode }) {
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    // PWAの主要機能（Service Worker）が使えるかチェック
    if (typeof window !== 'undefined' && !('serviceWorker' in navigator)) {
      setIsSupported(false);
    }
  }, []);

  if (!isSupported) {
    const chromeIntentUrl = `intent://${window.location.host}${window.location.pathname}#Intent;scheme=https;package=com.android.chrome;end`;
    const chromeUrl = `https://${window.location.host}${window.location.pathname}`;
    const isAndroid = /android/i.test(navigator.userAgent);

    return (
      <div className="h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="text-4xl mb-4">📱</div>
          <h2 className="text-lg font-bold text-slate-800 mb-4">このアプリはChromeでご利用ください</h2>
          <p className="text-sm text-slate-500 mb-6">
            現在お使いのブラウザではアプリが正しく動作しません。<br />
            Chromeブラウザで開き直してください。
          </p>
          {isAndroid ? (
            <a
              href={chromeIntentUrl}
              className="inline-block px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl shadow-md hover:bg-indigo-700 transition-all"
            >
              Chromeで開く
            </a>
          ) : (
            <>
              <p className="text-xs text-slate-400 mb-4">
                Chromeがインストールされていない場合は、<br />App Storeからインストールしてください。
              </p>
              <a
                href={chromeUrl}
                className="inline-block px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl shadow-md hover:bg-indigo-700 transition-all"
              >
                Chromeで開く
              </a>
            </>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}