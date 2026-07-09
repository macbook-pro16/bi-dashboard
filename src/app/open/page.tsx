'use client';

import { useEffect, useState } from 'react';

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

        {/* iOS/その他用：ダッシュボード直接リンク（Safariで開く） */}
        <a
          href={DASHBOARD_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block', width: '100%', padding: '14px 18px', borderRadius: 14,
            fontSize: 16, fontWeight: 600, textDecoration: 'none', textAlign: 'center',
            background: '#10b981', color: 'white', marginBottom: 12
          }}
        >
          ダッシュボードを開く
        </a>

        <button
          onClick={handleCopyUrl}
          style={{
            display: 'block', width: '100%', padding: '14px 18px', borderRadius: 14,
            fontSize: 16, fontWeight: 600, border: 'none', cursor: 'pointer',
            background: copied ? '#cbd5e1' : '#e2e8f0', color: '#334155'
          }}
        >
          {copied ? 'コピーしました！' : 'URLをコピー'}
        </button>

        <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6, marginTop: 20 }}>
          ※ 自動で開かない場合は、上記の「ダッシュボードを開く」をタップするか、<br />
          URLをコピーして <strong>Safari</strong> または <strong>Chrome</strong> に貼り付けてください。
        </p>
      </div>
    </div>
  );
}