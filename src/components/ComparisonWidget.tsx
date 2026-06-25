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

// アイコンコンポーネント
const EqualIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="9" x2="19" y2="9"></line>
    <line x1="5" y1="15" x2="19" y2="15"></line>
  </svg>
);

const GreaterIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"></polyline>
  </svg>
);

const LessIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"></polyline>
  </svg>
);

const CheckIcon = () => (
  <svg width="1.2em" height="1.2em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const AlertIcon = () => (
  <svg width="1.2em" height="1.2em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
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
  const isGreater = diff > 0;

  // 背景色の透過対応
  const bg = bgColor.startsWith('#')
    ? `rgba(${parseInt(bgColor.slice(1, 3), 16)}, ${parseInt(bgColor.slice(3, 5), 16)}, ${parseInt(bgColor.slice(5, 7), 16)}, ${bgAlpha})`
    : bgColor;

  // 判定に応じたステータスUIの設定
  let statusConfig;
  if (isEqual) {
    statusConfig = {
      operatorIcon: <EqualIcon />,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-500',
      badgeBg: 'bg-emerald-50 border border-emerald-200',
      badgeColor: 'text-emerald-700',
      statusIcon: <CheckIcon />,
      statusText: '一致 (OK)',
    };
  } else {
    statusConfig = {
      operatorIcon: isGreater ? <GreaterIcon /> : <LessIcon />,
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-500',
      badgeBg: 'bg-rose-50 border border-rose-200',
      badgeColor: 'text-rose-700',
      statusIcon: <AlertIcon />,
      statusText: `ズレあり (${isGreater ? '+' : ''}${diff.toLocaleString()})`,
    };
  }

  return (
    <div
      className="w-full h-full flex flex-col p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden"
      style={{ backgroundColor: bg, fontFamily: '"Inter", "Noto Sans JP", sans-serif' }}
    >
      {/* ウィジェットタイトル */}
      {showTitle && label && (
        <div
          className="font-bold whitespace-pre-line leading-tight truncate shrink-0 text-center mb-2"
          style={{
            fontSize: `${titleFontSize}px`,
            color: titleColor,
            transform: `translate(${titleX}px, ${titleY}px)`,
          }}
        >
          {label}
        </div>
      )}

      {/* メインコンテンツ: 同列比較 */}
      <div className="flex-1 flex flex-col items-center justify-center w-full gap-6">
        
        <div className="flex items-center justify-between w-full px-2 gap-2">
          
          {/* A (Actual) */}
          <div className="flex flex-col items-center min-w-0 flex-1">
            <span className="text-xs font-semibold text-slate-400 mb-1.5 truncate w-full text-center">
              {actualLabel}
            </span>
            <span 
              className="font-black tracking-tight truncate w-full text-center" 
              style={{ fontSize: `${fontSize}px`, color: textColor }}
            >
              {actual.toLocaleString()}
            </span>
          </div>

          {/* 演算子アイコン */}
          <div className={`flex items-center justify-center w-12 h-12 rounded-full shrink-0 text-2xl ${statusConfig.iconBg} ${statusConfig.iconColor}`}>
            {statusConfig.operatorIcon}
          </div>

          {/* B (Target) */}
          <div className="flex flex-col items-center min-w-0 flex-1">
            <span className="text-xs font-semibold text-slate-400 mb-1.5 truncate w-full text-center">
              {targetLabel}
            </span>
            <span 
              className="font-black tracking-tight truncate w-full text-center" 
              style={{ fontSize: `${fontSize}px`, color: textColor }}
            >
              {target.toLocaleString()}
            </span>
          </div>

        </div>

        {/* 判定バッジ */}
        <div className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm shadow-sm ${statusConfig.badgeBg} ${statusConfig.badgeColor}`}>
          {statusConfig.statusIcon}
          <span>{statusConfig.statusText}</span>
        </div>

      </div>
    </div>
  );
}