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

export default function ComparisonWidget({
  label,
  showTitle,
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
  const statusColor = isEqual ? '#10b981' : diff > 0 ? '#3b82f6' : '#ef4444';
  const statusText = isEqual
    ? 'OK'
    : diff > 0
      ? `+${diff} (${actualLabel} > ${targetLabel})`
      : `${diff} (${actualLabel} < ${targetLabel})`;

  const bg = bgColor.startsWith('#')
    ? `rgba(${parseInt(bgColor.slice(1,3),16)},${parseInt(bgColor.slice(3,5),16)},${parseInt(bgColor.slice(5,7),16)},${bgAlpha})`
    : bgColor;

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-2 p-4"
      style={{ backgroundColor: bg, color: textColor, fontFamily: '"Inter", "Noto Sans JP", sans-serif' }}
    >
      {showTitle && label && (
        <div
          className="font-medium whitespace-pre-line leading-tight"
          style={{
            fontSize: `${titleFontSize}px`,
            color: titleColor,
            transform: `translate(${titleX}px, ${titleY}px)`,
          }}
        >
          {label}
        </div>
      )}
      <div className="text-center">
        <div className="text-sm text-slate-500 mb-1">
          {actualLabel} {actual.toLocaleString()} vs {targetLabel} {target.toLocaleString()}
        </div>
        <div
          className="font-black leading-none"
          style={{ fontSize: `${fontSize}px`, color: statusColor }}
        >
          {statusText}
        </div>
      </div>
    </div>
  );
}