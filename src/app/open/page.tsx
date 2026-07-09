'use client';

import { useState } from 'react';

const DASHBOARD_URL = 'https://bi-dashboard-phi-five.vercel.app/dashboard';
const PLAY_STORE_CHROME = 'https://play.google.com/store/apps/details?id=com.android.chrome';

export default function OpenPage() {
  const [copied, setCopied] = useState(false);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(DASHBOARD_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // クリップボードが使えない場合、URLを表示して手動コピーを促す
      prompt('以下のURLをコピーしてください:', DASHBOARD_URL);
    }
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
        
        {/* Android用：Playストア経由でChrome起動 */}
        <a
          href={PLAY_STORE_CHROME}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block', width: '100%', padding: '14px 18px', borderRadius: 14,
            fontSize: 16, fontWeight: 600, textDecoration: 'none', textAlign: 'center',
            background: '#6366f1', color: 'white', marginBottom: 12
          }}
        >
          Chrome を開く (Android)
        </a>

        {/* URLコピーボタン（iPhone/その他共通） */}
        <button
          onClick={handleCopyUrl}
          style={{
            display: 'block', width: '100%', padding: '14px 18px', borderRadius: 14,
            fontSize: 16, fontWeight: 600, border: 'none', cursor: 'pointer',
            background: copied ? '#cbd5e1' : '#10b981', color: 'white', marginBottom: 12
          }}
        >
          {copied ? 'コピーしました！' : 'URLをコピーして Safari で開く'}
        </button>

        <div style={{ 
          background: '#f8fafc', borderRadius: 12, padding: 16, marginTop: 16,
          textAlign: 'left', fontSize: 13, color: '#334155', lineHeight: 1.6 
        }}>
          <p style={{ margin: '0 0 8px', fontWeight: 600 }}>📱 iPhone で開く手順</p>
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            <li>上のボタンで <strong>URLをコピー</strong> します</li>
            <li>ホーム画面に戻り、<strong>Safari</strong> を起動します</li>
            <li>アドレスバーにコピーしたURLを <strong>貼り付けて</strong> 開きます</li>
          </ol>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#64748b' }}>
            ※ 開いた後、共有メニューから「ホーム画面に追加」すると、次回からアプリのように使えます。
          </p>
        </div>

        <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6, marginTop: 16 }}>
          または、手動で <strong>Safari</strong> を開き、以下のURLにアクセスしてください：<br />
          <span style={{ fontSize: 11, wordBreak: 'break-all' }}>{DASHBOARD_URL}</span>
        </p>
      </div>
    </div>
  );
}