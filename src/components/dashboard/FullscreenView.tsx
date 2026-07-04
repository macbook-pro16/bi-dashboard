// src/components/dashboard/FullscreenView.tsx
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Widget, Annotation, DBItem } from '../../types';
import {
  ARTBOARD_WIDTH,
  ARTBOARD_HEIGHT,
} from '../../utils/dashboardUtils';
import { useFilter } from '../../contexts/FilterContext';
import Icons from '../Icons';
import DrilldownModal from '../DrilldownModal';
import { renderWidgetContent } from './renderWidgetContent';

interface FullscreenViewProps {
  layout: Widget[];
  annotations: Annotation[];
  computedValues: Record<string, number>;
  computedTargetValues: Record<string, number>;
  computedPreviousValues: Record<string, number>;
  filteredDataByIndex: Record<string, DBItem[]>;
  widgetFilteredData: Record<string, DBItem[]>;
  statusOptions: string[];
  onExit: () => void;
  handleStatusChange: any;
  filters: any;
  handleChartCrossFilter: any;
  toggleCrossFilter: any;
  canvasBgColor: string;
  drilldown: any;
  setDrilldown: (val: any) => void;
  todayDiffMap?: Record<string, { added: DBItem[]; removed: DBItem[] }>;
  availableFields?: string[];
  handleDiffFilter?: (ids: string[], label: string) => void;
  allWidgetValues?: Record<string, number>;
  comparisonDiffMap?: Record<string, { onlyInActual: DBItem[]; onlyInTarget: DBItem[] }>;
  CanvasWidgetComponent: React.ComponentType<any>;
  // 期間バー用
  updateDateRange: (partial: { start?: string; end?: string }) => void;
  periodOffsets: { day: number; week: number; month: number; year: number };
  applyPeriodOffset: (unit: 'day' | 'week' | 'month' | 'year', offset: number) => void;
  formatPeriodLabel: (unit: 'day' | 'week' | 'month' | 'year', offset: number) => string;
}

export default function FullscreenView({
  layout,
  annotations,
  computedValues,
  computedTargetValues,
  computedPreviousValues,
  filteredDataByIndex,
  widgetFilteredData,
  statusOptions,
  onExit,
  handleStatusChange,
  filters,
  handleChartCrossFilter,
  toggleCrossFilter,
  canvasBgColor,
  drilldown,
  setDrilldown,
  todayDiffMap,
  availableFields,
  handleDiffFilter,
  allWidgetValues,
  comparisonDiffMap,
  CanvasWidgetComponent,
  updateDateRange,
  periodOffsets,
  applyPeriodOffset,
  formatPeriodLabel,
}: FullscreenViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [showPeriodPanel, setShowPeriodPanel] = useState(false);

  // コンテナサイズの観測（ResizeObserver と window resize を両方使う）
  const updateScale = useCallback(() => {
    if (!containerRef.current) return;
    const vw = containerRef.current.clientWidth;
    const vh = containerRef.current.clientHeight;
    const s = Math.min(vw / ARTBOARD_WIDTH, vh / ARTBOARD_HEIGHT);
    setScale(s);
  }, []);

  useEffect(() => {
    updateScale();
    const observer = new ResizeObserver(updateScale);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    window.addEventListener('resize', updateScale);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, [updateScale]);

  // 期間パネル外クリックで閉じる
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowPeriodPanel(false);
      }
    };
    if (showPeriodPanel) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPeriodPanel]);

  return (
    <div
      ref={containerRef}
      className="h-[100dvh] w-full bg-black relative overflow-hidden select-none"
      style={{ fontFamily: '"Inter", "Noto Sans JP", sans-serif' }}
    >
      {/* 終了ボタン */}
      <button
        onClick={onExit}
        className="absolute top-6 left-6 z-50 bg-slate-900/80 backdrop-blur-md text-white rounded-xl px-5 py-2.5 text-sm font-medium shadow-xl hover:bg-slate-800 flex items-center gap-2 transition-all"
      >
        <Icons.X className="w-4 h-4" /> 終了 (Esc)
      </button>

      {/* 期間フィルターボタン（右上） */}
      <button
        onClick={() => setShowPeriodPanel(prev => !prev)}
        className="absolute top-6 right-6 z-50 w-11 h-11 flex items-center justify-center bg-slate-900/80 backdrop-blur-md text-white rounded-full shadow-xl hover:bg-slate-800 transition-all"
        style={{ minWidth: '44px', minHeight: '44px' }}
        title="期間フィルター"
      >
        <Icons.Settings className="w-5 h-5" />
      </button>

      {/* 期間パネル（オーバーレイ） */}
      {showPeriodPanel && (
        <div
          ref={panelRef}
          className="absolute top-20 right-6 z-[60] bg-black/80 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-5 flex flex-col gap-4 min-w-[280px]"
        >
          <div className="flex items-center justify-between">
            <span className="text-white text-sm font-semibold">期間設定</span>
            <button onClick={() => setShowPeriodPanel(false)} className="text-white/60 hover:text-white">
              <Icons.X className="w-4 h-4" />
            </button>
          </div>

          {(['day', 'week', 'month', 'year'] as const).map((unit) => (
            <div key={unit} className="flex items-center gap-2 text-white">
              <button
                onClick={() => applyPeriodOffset(unit, periodOffsets[unit] - 1)}
                className="p-1 rounded-md hover:bg-white/10"
              >
                <Icons.ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-medium min-w-[80px] text-center">
                {formatPeriodLabel(unit, periodOffsets[unit])}
              </span>
              <button
                onClick={() => applyPeriodOffset(unit, periodOffsets[unit] + 1)}
                disabled={periodOffsets[unit] >= 0}
                className="p-1 rounded-md hover:bg-white/10 disabled:opacity-30"
              >
                <Icons.ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ))}

          <div className="flex items-center gap-2 mt-2">
            <input
              type="date"
              value={filters.dateRange.start}
              onChange={e => updateDateRange({ start: e.target.value })}
              className="flex-1 text-xs bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-white outline-none focus:border-indigo-400"
            />
            <span className="text-white/50">〜</span>
            <input
              type="date"
              value={filters.dateRange.end}
              onChange={e => updateDateRange({ end: e.target.value })}
              className="flex-1 text-xs bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-white outline-none focus:border-indigo-400"
            />
          </div>
        </div>
      )}

      {/* アートボード */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${scale})`,
          width: `${ARTBOARD_WIDTH}px`,
          height: `${ARTBOARD_HEIGHT}px`,
          transformOrigin: 'center center',
          background: canvasBgColor || '#ffffff',
          overflow: 'hidden',
        }}
      >
        {/* グリッド（薄く） */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(#cbd5e1 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
            opacity: 0.3,
          }}
        />

        {/* アノテーション（矢印） */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 50 }}>
          <defs>
            {annotations.map((ann: Annotation) => {
              const sizes: Record<string, number> = { small: 6, medium: 9, large: 14 };
              const size = sizes[ann.arrowSize] || 9;
              const shapePoints: Record<string, string> = {
                triangle: `0 0, ${size} ${size / 2}, 0 ${size}`,
                sharp: `0 0, ${size} ${size / 2}, 0 ${size}`,
                blunt: `0 0, ${size * 0.8} ${size / 2}, 0 ${size}`,
              };
              const points = shapePoints[ann.arrowShape] || shapePoints.triangle;
              const refXMap: Record<string, number> = { triangle: size, sharp: size * 0.8, blunt: size * 0.6 };
              const refX = refXMap[ann.arrowShape] || size;
              return (
                <React.Fragment key={ann.id}>
                  {ann.arrowEnd && (
                    <marker
                      id={`fullscreen-arrowhead-${ann.id}`}
                      markerWidth={size}
                      markerHeight={size}
                      refX={refX}
                      refY={size / 2}
                      orient="auto"
                    >
                      <polygon points={points} fill={ann.color} />
                    </marker>
                  )}
                  {ann.arrowStart && (
                    <marker
                      id={`fullscreen-arrowhead-reverse-${ann.id}`}
                      markerWidth={size}
                      markerHeight={size}
                      refX={size - refX}
                      refY={size / 2}
                      orient="auto"
                    >
                      <polygon points={points} fill={ann.color} />
                    </marker>
                  )}
                </React.Fragment>
              );
            })}
          </defs>
          {annotations.map((ann: Annotation) => {
            const { x1, y1, x2, y2 } = ann;
            let path = '';
            if (ann.routeType === 'direct') {
              path = `M ${x1} ${y1} L ${x2} ${y2}`;
            } else if (ann.routeType === 'stairHV') {
              path = `M ${x1} ${y1} L ${x2} ${y1} L ${x2} ${y2}`;
            } else if (ann.routeType === 'stairVH') {
              path = `M ${x1} ${y1} L ${x1} ${y2} L ${x2} ${y2}`;
            } else if (ann.routeType === 'stairVHV') {
              const midY = (y1 + y2) / 2;
              path = `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
            } else {
              const midX = (x1 + x2) / 2;
              path = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
            }
            let dashArray = 'none';
            if (ann.lineStyle === 'dashed') dashArray = '8 4';
            else if (ann.lineStyle === 'dotted') dashArray = '2 3';
            return (
              <path
                key={ann.id}
                d={path}
                stroke={ann.color}
                strokeWidth={ann.thickness}
                strokeDasharray={dashArray}
                fill="none"
                markerStart={ann.arrowStart ? `url(#fullscreen-arrowhead-reverse-${ann.id})` : undefined}
                markerEnd={ann.arrowEnd ? `url(#fullscreen-arrowhead-${ann.id})` : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}
        </svg>

        {/* ウィジェット */}
        {layout.map((w: Widget, idx: number) => (
          <CanvasWidgetComponent
            key={w.id}
            widget={w}
            isEditMode={false}
            isSignageMode={true}
            zoom={scale}
            zIndex={idx}
            isSelected={false}
            onSelect={() => {}}
            onSelectToggle={() => {}}
            onResizeEnd={() => {}}
            onChangeSize={() => {}}
            computedValue={computedValues[w.id]}
            selectedCount={0}
          >
            {renderWidgetContent(
              w,
              computedValues,
              computedTargetValues,
              computedPreviousValues,
              filteredDataByIndex,
              widgetFilteredData,
              statusOptions,
              handleStatusChange,
              handleChartCrossFilter,
              filters,
              toggleCrossFilter,
              filters.dateRange,
              'signage', // mode は 'signage' と同じ扱いでOK（編集不可、ドリルダウン可）
              undefined,
              undefined,
              todayDiffMap,
              availableFields,
              handleDiffFilter,
              allWidgetValues,
              setDrilldown,
              undefined,
              comparisonDiffMap
            )}
          </CanvasWidgetComponent>
        ))}
      </div>

      {/* ドリルダウンモーダル */}
      {drilldown && (
        <DrilldownModal
          open={!!drilldown}
          onClose={() => setDrilldown(null)}
          title={drilldown.widgetTitle}
          data={drilldown.data ?? filteredDataByIndex['001']}
          filterField={drilldown.field}
          filterValue={drilldown.value}
          columns={drilldown.columns}
          images={drilldown.images}
        />
      )}
    </div>
  );
}