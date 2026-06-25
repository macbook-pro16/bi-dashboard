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

const EqualIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="9" x2="19" y2="9"></line>
    <line x1="5" y1="15" x2="19" y2="15"></line>
  </svg>
);

const NotEqualIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="9" x2="19" y2="9"></line>
    <line x1="5" y1="15" x2="19" y2="15"></line>
    <line x1="19" y1="5" x2="5" y2="19"></line>
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
  targetLabel = '比較対象',
}: ComparisonWidgetProps) {
  const diff = actual - target;
  const isEqual = diff === 0;

  // 背景色の透過対応
  const bg = bgColor.startsWith('#')
    ? `rgba(${parseInt(bgColor.slice(1, 3), 16)}, ${parseInt(bgColor.slice(3, 5), 16)}, ${parseInt(bgColor.slice(5, 7), 16)}, ${bgAlpha})`
    : bgColor;

  return (
    <div
      className="w-full h-full flex flex-col p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden"
      style={{ backgroundColor: bg, fontFamily: '"Inter", "Noto Sans JP", sans-serif' }}
    >
      {/* Header: ウィジェットのタイトル */}
      {showTitle && label && (
        <div
          className="font-bold whitespace-pre-line leading-tight truncate mb-4 z-10 shrink-0 text-center"
          style={{
            fontSize: `${titleFontSize}px`,
            color: titleColor,
            transform: `translate(${titleX}px, ${titleY}px)`,
          }}
        >
          {label}
        </div>
      )}

      {/* Main Content: 2つの数値を左右対称にフラットに比較 */}
      <div className="flex-1 flex items-stretch justify-center relative">
        
        {/* Left Block (actual) */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 bg-slate-50/80 rounded-l-2xl border border-r-0 border-slate-100">
          <span className="text-sm font-semibold text-slate-500 mb-2 truncate max-w-full px-2">
            {actualLabel}
          </span>
          <span 
            className="font-black tracking-tight truncate max-w-full px-2" 
            style={{ fontSize: `${fontSize}px`, color: textColor }}
          >
            {actual.toLocaleString()}
          </span>
        </div>

        {/* Center Divider & Icon */}
        <div className="relative z-10 flex flex-col items-center justify-center w-0">
          <div className={`absolute flex items-center justify-center w-14 h-14 rounded-full border-4 border-white shadow-md transition-colors duration-300 ${
            isEqual ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
          }`}>
            {isEqual ? <EqualIcon /> : <NotEqualIcon />}
          </div>
        </div>

        {/* Right Block (target) */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 bg-slate-50/80 rounded-r-2xl border border-l-0 border-slate-100">
          <span className="text-sm font-semibold text-slate-500 mb-2 truncate max-w-full px-2">
            {targetLabel}
          </span>
          <span 
            className="font-black tracking-tight truncate max-w-full px-2" 
            style={{ fontSize: `${fontSize}px`, color: textColor }}
          >
            {target.toLocaleString()}
          </span>
        </div>

      </div>

      {/* Footer: 比較結果のステータスと差分サマリー */}
      <div className={`mt-5 shrink-0 px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-center transition-colors duration-300 ${
        isEqual 
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
          : 'bg-rose-50 text-rose-700 border border-rose-100'
      }`}>
        {isEqual ? (
          <div className="flex items-center gap-2">
            <span>数値は完全に一致しています</span>
          </div>
        ) : (
          <div className="flex items-center flex-wrap justify-center gap-x-3 gap-y-2">
            <span>ズレが生じています</span>
            <div className="flex items-center gap-1.5 bg-white px-3 py-1 rounded-lg border border-rose-200 shadow-sm text-rose-600">
              <span className="text-xs text-rose-400 font-medium">差分</span>
              <span className="font-black">
                {diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}