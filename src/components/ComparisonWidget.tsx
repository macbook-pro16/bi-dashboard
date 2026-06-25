// src/components/ComparisonWidget.tsx
'use client';

import React from 'react';

interface ComparisonWidgetProps {
  label: string;
  showTitle?: boolean;
  titleColor?: string;
  titleFontSize?: number;
  titleX?: number;
  titleY?: number;
  fontSize?: number;
  textColor?: string;
  bgColor?: string;
  bgAlpha?: number;
  actual: number;
  target: number;
  actualLabel?: string;
  targetLabel?: string;
}

const TrendingUp = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
    <polyline points="16 7 22 7 22 13"></polyline>
  </svg>
);

const TrendingDown = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 17 13.5 8.5 8.5 13.5 2 7"></polyline>
    <polyline points="16 17 22 17 22 11"></polyline>
  </svg>
);

const CheckCircle = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
);

export default function ComparisonWidget({
  label,
  showTitle = true,
  titleColor = '#64748b',
  titleFontSize = 14,
  titleX = 0,
  titleY = 0,
  fontSize = 48,
  textColor = '#1e293b',
  bgColor = '#ffffff',
  bgAlpha = 1,
  actual,
  target,
  actualLabel = '実績',
  targetLabel = '目標',
}: ComparisonWidgetProps) {
  const diff = actual - target;
  const isEqual = diff === 0;
  const isPositive = diff > 0;

  // 進捗率の計算
  let percent = 0;
  if (target !== 0) {
    percent = Math.round((actual / target) * 100);
  } else {
    percent = actual > 0 ? 100 : 0;
  }
  const safePercent = isNaN(percent) ? 0 : percent;
  const barPercent = Math.min(Math.max(safePercent, 0), 100);

  // ステータスに応じたテーマカラーとアイコン
  const statusConfig = isEqual
    ? {
        color: 'text-emerald-600',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        bar: 'bg-emerald-500',
        icon: <CheckCircle />,
        text: 'OK',
      }
    : isPositive
      ? {
          color: 'text-blue-600',
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          bar: 'bg-blue-500',
          icon: <TrendingUp />,
          text: `+${diff.toLocaleString()}`,
        }
      : {
          color: 'text-rose-600',
          bg: 'bg-rose-50',
          border: 'border-rose-200',
          bar: 'bg-rose-500',
          icon: <TrendingDown />,
          text: `${diff.toLocaleString()}`,
        };

  // 背景色の透過対応
  const bg = bgColor.startsWith('#')
    ? `rgba(${parseInt(bgColor.slice(1, 3), 16)}, ${parseInt(bgColor.slice(3, 5), 16)}, ${parseInt(bgColor.slice(5, 7), 16)}, ${bgAlpha})`
    : bgColor;

  return (
    <div
      className="w-full h-full flex flex-col p-5 rounded-2xl shadow-sm border border-slate-100/60 relative overflow-hidden transition-all"
      style={{ backgroundColor: bg, fontFamily: '"Inter", "Noto Sans JP", sans-serif' }}
    >
      {/* 
        背景のアクセントデコレーション（少しだけステータスカラーを反映）
        透明度を極端に下げてふんわりと右上に入れる 
      */}
      <div 
        className={`absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none ${statusConfig.bar}`} 
      />

      {/* Header: タイトルとステータスバッジ */}
      <div className="flex justify-between items-start gap-2 mb-4 z-10">
        <div className="flex-1 min-w-0">
          {showTitle && label && (
            <div
              className="font-bold whitespace-pre-line leading-tight truncate"
              style={{
                fontSize: `${titleFontSize}px`,
                color: titleColor,
                transform: `translate(${titleX}px, ${titleY}px)`,
              }}
            >
              {label}
            </div>
          )}
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold shadow-sm whitespace-nowrap shrink-0 ${statusConfig.bg} ${statusConfig.border} ${statusConfig.color}`}>
          {statusConfig.icon}
          <span>{statusConfig.text}</span>
        </div>
      </div>

      {/* Main Content: 数値とプログレスバー */}
      <div className="flex-1 flex flex-col justify-center gap-6 z-10">
        
        <div className="flex items-end justify-between">
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-slate-500 mb-1 opacity-80">{actualLabel}</span>
            <div
              className="font-black leading-none tracking-tight truncate"
              style={{ fontSize: `${fontSize}px`, color: textColor }}
            >
              {actual.toLocaleString()}
            </div>
          </div>
          <div className="flex flex-col items-end shrink-0 pl-4">
            <span className="text-[11px] font-semibold text-slate-400 mb-1">{targetLabel}</span>
            <div
              className="font-bold leading-none text-slate-400/80"
              style={{ fontSize: `${Math.max(16, fontSize * 0.45)}px` }}
            >
              {target.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 mt-auto">
          {/* Progress Bar Container */}
          <div className="relative w-full h-3 bg-slate-100/80 rounded-full overflow-hidden shadow-inner">
            <div
              className={`absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out ${statusConfig.bar}`}
              style={{ width: `${barPercent}%` }}
            />
            {/* 目標値を100%とした時のオーバー部分のインジケーター */}
            {safePercent > 100 && (
              <div 
                className="absolute top-0 bottom-0 w-0.5 bg-slate-900/15" 
                style={{ left: `${(target / actual) * 100}%` }} 
                title="目標ライン"
              />
            )}
          </div>
          
          {/* ％と達成状況のラベル */}
          <div className="flex justify-between items-center text-[11px] font-bold text-slate-400">
            <span className="opacity-70">0%</span>
            <span className={statusConfig.color}>{safePercent}%</span>
          </div>
        </div>

      </div>
    </div>
  );
}