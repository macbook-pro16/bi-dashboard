'use client';

import React from 'react';

export default function UnsupportedPage() {
  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
  const chromeIntentUrl = `intent://${window.location.host}${window.location.pathname}#Intent;scheme=https;package=com.android.chrome;end`;
  const chromeMarketUrl = 'https://play.google.com/store/apps/details?id=com.android.chrome';
  const chromeUrl = `https://${window.location.host}${window.location.pathname}`;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">このブラウザはサポートされていません</h2>
        <p className="text-sm text-slate-500 mb-6">
          BIダッシュボードを表示するには <strong>Google Chrome</strong> または <strong>Safari</strong> が必要です。
        </p>
        {isAndroid ? (
          <div className="space-y-3">
            <a
              href={chromeIntentUrl}
              className="block w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl shadow-md hover:bg-indigo-700 transition-all"
            >
              Chromeで開く
            </a>
            <p className="text-xs text-slate-400">Chromeがインストールされていない場合は<br />下のボタンからインストールしてください。</p>
            <a
              href={chromeMarketUrl}
              className="block w-full px-6 py-3 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-all"
            >
              Chromeをインストール
            </a>
          </div>
        ) : (
          <div>
            <p className="text-sm text-slate-600 mb-4">
              Safari または Chrome ブラウザで<br />このURLを開いてください。
            </p>
            <a
              href={chromeUrl}
              className="block w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl shadow-md hover:bg-indigo-700 transition-all"
            >
              Chromeで開く
            </a>
          </div>
        )}
      </div>
    </div>
  );
}