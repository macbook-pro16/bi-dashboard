'use client';
// [UX-2] スケルトンUI
import React from 'react';

interface SkeletonWidgetProps {
  x: number;
  y: number;
  w: number;
  h: number;
}

export default function SkeletonWidget({ x, y, w, h }: SkeletonWidgetProps) {
  return (
    <div
      className="absolute bg-slate-200 animate-pulse rounded-lg"
      style={{ left: x, top: y, width: w, height: h }}
    />
  );
}