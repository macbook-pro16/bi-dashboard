// src/components/Minimap.tsx
'use client';
import React from 'react';
import { Widget } from '../types';

interface MinimapProps {
  layout: Widget[];
  pan: { x: number; y: number };
  zoom: number;
  viewportW: number;
  viewportH: number;
  onNavigate: (pos: { x: number; y: number }) => void;
}

const ARTBOARD_WIDTH = 1920;
const ARTBOARD_HEIGHT = 1080;
const MAP_W = 240;
const MAP_H = 135;
const SCALE_X = MAP_W / ARTBOARD_WIDTH;
const SCALE_Y = MAP_H / ARTBOARD_HEIGHT;

export default function Minimap({ layout, pan, zoom, viewportW, viewportH, onNavigate }: MinimapProps) {
  const vpX = -pan.x / zoom;
  const vpY = -pan.y / zoom;
  const vpW = viewportW / zoom;
  const vpH = viewportH / zoom;

  const handlePointerDown = (e: React.PointerEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / SCALE_X;
    const clickY = (e.clientY - rect.top) / SCALE_Y;
    onNavigate({
      x: -(clickX * zoom - viewportW / 2),
      y: -(clickY * zoom - viewportH / 2),
    });
  };

  return (
    <div
      className="bg-slate-800/80 backdrop-blur-md border border-slate-600 rounded-2xl shadow-2xl overflow-hidden"
      style={{
        position: 'absolute',
        bottom: '32px',
        right: '32px',
        zIndex: 50,
        width: MAP_W,
        height: MAP_H
      }}
      onPointerDown={handlePointerDown}
    >
      <div className="relative w-full h-full">
        {layout.filter(w => !w.hidden).map(w => (
          <div
            key={w.id}
            className="absolute bg-indigo-400/60 border border-indigo-300 rounded-sm"
            style={{
              left: w.x * SCALE_X,
              top: w.y * SCALE_Y,
              width: w.w * SCALE_X,
              height: w.h * SCALE_Y,
            }}
          />
        ))}
        {/* ビューポート枠 */}
        <div
          className="absolute border-2 border-white/80 shadow-[0_0_8px_rgba(255,255,255,0.5)] bg-white/10 rounded-sm pointer-events-none"
          style={{
            left: vpX * SCALE_X,
            top: vpY * SCALE_Y,
            width: vpW * SCALE_X,
            height: vpH * SCALE_Y,
          }}
        />
      </div>
      <div className="absolute bottom-1 right-2 text-[8px] font-bold text-white/40 pointer-events-none">
        MINIMAP
      </div>
    </div>
  );
}