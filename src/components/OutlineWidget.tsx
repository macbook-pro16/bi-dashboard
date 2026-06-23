// src/components/OutlineWidget.tsx
'use client';

import React from 'react';
import { OutlineConfig } from '../types';

interface OutlineWidgetProps {
  outlineConfig?: OutlineConfig;
  // fallback: ウィジェットの基本プロパティ
  borderColor?: string;
  borderWidth?: number;
  shape?: 'rectangle' | 'rounded' | 'circle';
  bgAlpha?: number;
  bgColor?: string;
  hasShadow?: boolean;
}

const OutlineWidget: React.FC<OutlineWidgetProps> = ({
  outlineConfig,
  borderColor = '#6366f1',
  borderWidth = 2,
  shape = 'rectangle',
  bgAlpha = 0,
  bgColor = 'transparent',
  hasShadow = false,
}) => {
  // outlineConfig があれば優先使用
  const finalShape = outlineConfig?.shape ?? shape;
  const finalBorderWidth = outlineConfig?.borderWidth ?? borderWidth;
  const finalBorderColor = outlineConfig?.borderColor ?? borderColor;
  const finalBorderStyle = outlineConfig?.borderStyle ?? 'solid';
  const finalBgColor = outlineConfig?.bgColor ?? bgColor;
  const finalBgAlpha = outlineConfig?.bgAlpha ?? bgAlpha;

  const borderRadius =
    finalShape === 'rounded' ? '16px' : finalShape === 'circle' ? '50%' : '0px';

  const bgRgba = finalBgColor.startsWith('#')
    ? `rgba(${parseInt(finalBgColor.slice(1, 3), 16)}, ${parseInt(finalBgColor.slice(3, 5), 16)}, ${parseInt(finalBgColor.slice(5, 7), 16)}, ${finalBgAlpha})`
    : finalBgColor;

  return (
    <div
      className="w-full h-full"
      style={{
        border: `${finalBorderWidth}px ${finalBorderStyle} ${finalBorderColor}`,
        borderRadius,
        backgroundColor: bgRgba,
        boxShadow: hasShadow ? '0 4px 12px -2px rgba(0,0,0,0.05)' : 'none',
      }}
    />
  );
};

export default OutlineWidget;