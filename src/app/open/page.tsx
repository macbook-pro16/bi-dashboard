'use client';

import { useEffect } from 'react';

const DASHBOARD_URL = 'https://bi-dashboard-phi-five.vercel.app/dashboard';
const PLAY_STORE_CHROME = 'https://play.google.com/store/apps/details?id=com.android.chrome';

export default function OpenPage() {
  useEffect(() => {
    const isAndroid = /android/i.test(navigator.userAgent);
    if (isAndroid) {
      // Android: まず intent を試し、失敗したら Play ストアへ自動フォールバック
      window.location.href =
        'intent://bi-dashboard-phi-five.vercel.app/dashboard#Intent;scheme=https;package=com.android.chrome;end';
      setTimeout(() => {
        window.location.href = PLAY_STORE_CHROME;
      }, 2000);
    }
    // iOS/その他は自動リダイレクトせず、手動ボタンを表示
  }, []);

  const handleOpenChrome = () => {
    const isAndroid = /android/i.test(navigator.userAgent);
    if (isAndroid) {
      window.location.href =
        'intent://bi-dashboard-phi-five.vercel.app/dashboard#Intent;scheme=https;package=com.android.chrome;end';
      setTimeout(() => {
        window.location.href = PLAY_STORE_CHROME;
      }, 1500);
    } else {
      // iOS: window.open でSafariを開く試行（LINEのWebViewなどでは有効な場合がある）
      const newWindow = window.open(DASHBOARD_URL, '_blank');
      if (!newWindow) {
        // 開けなかった場合のみクリップボードにコピー
        navigator.clipboard.writeText(DASHBOARD_URL).then(() => {
          alert('Safariで開けませんでした。\nURLをコピーしましたので、Safariに貼り付けて開いてください。');
        });
      }
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(DASHBOARD_URL).then(() => {
      alert('URLをコピーしました。\n対応ブラウザで開いてください。');
    });
  };

  return (
    <div style={{ 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'flex', alignItems: 'center', justifyContent: 'center', 
      minHeight: '100vh', margin: 0, padding: 16, background: '#f1f5f9' 
    }}>
      <div style={{ 
        background: 'white', padding: '32px 24px', borderRadius: 24, 
        boxShadow: '0 12px 40px rgba(0,0,0,0.06)', textAlign: 'center', 
        maxWidth: 380, width: '100%' 
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '0 0 12px' }}>
          📊 BIダッシュボード
        </h1>
        <p style={{ fontSize: 14, color: '#475569', margin: '0 0 24px', lineHeight: 1.5 }}>
          このアプリは <strong>Google Chrome</strong>（Android）または <strong>Safari</strong>（iPhone/iPad）でご利用ください。
        </p>
        <button
          onClick={handleOpenChrome}
          style={{
            display: 'block', width: '100%', padding: '14px 18px', borderRadius: 14,
            fontSize: 16, fontWeight: 600, border: 'none', cursor: 'pointer',
            background: '#6366f1', color: 'white', marginBottom: 12
          }}
        >
          Chrome で開く
        </button>
        <button
          onClick={handleCopyUrl}
          style={{
            display: 'block', width: '100%', padding: '14px 18px', borderRadius: 14,
            fontSize: 16, fontWeight: 600, border: 'none', cursor: 'pointer',
            background: '#e2e8f0', color: '#334155'
          }}
        >
          URLをコピー
        </button>
        <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6, marginTop: 20 }}>
          ※「Chromeで開く」ボタンが反応しない場合は、<br />
          手動で Chrome を起動し、<br />
          <a href={DASHBOARD_URL} style={{ color: '#6366f1' }}>ダッシュボード</a> にアクセスしてください。
        </p>
      </div>
    </div>
  );
}