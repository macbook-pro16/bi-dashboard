// src/components/dashboard/SignageView.tsx
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Widget, Annotation, DBItem } from '../../types';
import {
  ARTBOARD_WIDTH,
  ARTBOARD_HEIGHT,
  formatLocalDate,
} from '../../utils/dashboardUtils';
import { DEFAULT_FILTER_DATE_RANGE } from '../../constants';
import { useFilter } from '../../contexts/FilterContext';
import Icons from '../Icons';
import DrilldownModal from '../DrilldownModal';
import { renderWidgetContent } from './renderWidgetContent';

interface SignageViewProps {
  layout: Widget[];
  computedValues: Record<string, number>;
  computedTargetValues: Record<string, number>;
  computedPreviousValues: Record<string, number>;
  filteredDataByIndex: Record<string, DBItem[]>;
  statusOptions: string[];
  onExit: () => void;
  handleStatusChange: any;
  filters: any;
  widgetFilteredData: Record<string, DBItem[]>;
  handleChartCrossFilter: any;
  toggleCrossFilter: any;
  pagesCount: number;
  onNextPage: () => void;
  onPrevPage: () => void;
  currentPageDisplayIndex: number;
  annotations: Annotation[];
  canvasBgColor: string;
  drilldown: any;
  setDrilldown: any;
  signageInterval: number;
  todayDiffMap?: Record<string, { added: DBItem[]; removed: DBItem[] }>;
  comparisonDiffMap?: Record<string, { onlyInActual: DBItem[]; onlyInTarget: DBItem[] }>;
  availableFields?: string[];
  handleDiffFilter?: (ids: string[], label: string) => void;
  allWidgetValues?: Record<string, number>;
  CanvasWidgetComponent: React.ComponentType<any>;
}

export default function SignageView({
  layout,
  computedValues,
  computedTargetValues,
  computedPreviousValues,
  filteredDataByIndex,
  statusOptions,
  onExit,
  handleStatusChange,
  filters: parentFilters,
  widgetFilteredData,
  toggleCrossFilter,
  pagesCount,
  onNextPage,
  onPrevPage,
  currentPageDisplayIndex,
  annotations,
  canvasBgColor,
  handleChartCrossFilter,
  drilldown,
  setDrilldown,
  signageInterval,
  todayDiffMap,
  comparisonDiffMap,
  availableFields,
  handleDiffFilter,
  allWidgetValues,
  CanvasWidgetComponent,
}: SignageViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const onDrilldown = useCallback((field: string, value: string, widgetTitle: string, data?: any[], columns?: string[], images?: string[]) => {
    setDrilldown({ field, value, widgetTitle, data, columns, images });
  }, [setDrilldown]);
  const { filters, updateDateRange, setStatuses, setDateRange, removeCrossFilter, clearCrossFilters } = useFilter();
  const todayStr = formatLocalDate(new Date());
  const [manualTrigger, setManualTrigger] = useState(0);

  useEffect(() => {
    if (pagesCount <= 1 || !signageInterval || signageInterval <= 0) return;
    const timer = setInterval(() => {
      onNextPage();
    }, signageInterval);
    return () => clearInterval(timer);
  }, [pagesCount, onNextPage, signageInterval, manualTrigger]);

  useEffect(() => {
    const onResize = () => {
      if (!containerRef.current) return;
      const vw = containerRef.current.clientWidth;
      const vh = containerRef.current.clientHeight;
      const s = Math.min(vw / ARTBOARD_WIDTH, vh / ARTBOARD_HEIGHT);
      setScale(s);
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const setQuickDate = (preset: string) => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    let start = '',
      end = '';
    if (preset === 'today') {
      const today = formatLocalDate(now);
      start = today;
      end = today;
    } else if (preset === 'thisWeek') {
      const day = now.getDay();
      const mon = new Date(now);
      mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      start = formatLocalDate(mon);
      end = formatLocalDate(sun);
    } else if (preset === 'thisMonth') {
      start = formatLocalDate(new Date(y, m, 1));
      end = formatLocalDate(new Date(y, m + 1, 0));
    } else if (preset === 'lastMonth') {
      start = formatLocalDate(new Date(y, m - 1, 1));
      end = formatLocalDate(new Date(y, m, 0));
    } else if (preset === 'thisYear') {
      start = formatLocalDate(new Date(y, 0, 1));
      end = formatLocalDate(new Date(y, 11, 31));
    }
    if (start && end) updateDateRange({ start, end });
  };

  const allBadges: { label: string; onRemove: () => void }[] = [];
  if (filters.dateRange.start !== DEFAULT_FILTER_DATE_RANGE.start || filters.dateRange.end !== DEFAULT_FILTER_DATE_RANGE.end) {
    allBadges.push({
      label: `期間: ${filters.dateRange.start} 〜 ${filters.dateRange.end}`,
      onRemove: () => setDateRange({ start: DEFAULT_FILTER_DATE_RANGE.start, end: DEFAULT_FILTER_DATE_RANGE.end }),
    });
  }
  filters.statuses.forEach((s: string) => {
    allBadges.push({
      label: `ステータス: ${s}`,
      onRemove: () => setStatuses(filters.statuses.filter((x: string) => x !== s)),
    });
  });
  Object.entries(filters.crossFilters).forEach(([field, values]) => {
    (values as string[]).forEach((v: string) => {
      allBadges.push({
        label: `${field}: ${v}`,
        onRemove: () => removeCrossFilter(field, v),
      });
    });
  });

  return (
    <div ref={containerRef} className="h-screen w-screen bg-black relative overflow-hidden select-none">
      <button
        onClick={onExit}
        className="absolute top-6 left-6 z-50 bg-slate-900/80 backdrop-blur-md text-white rounded-xl px-5 py-2.5 text-sm font-medium shadow-xl hover:bg-slate-800 flex items-center gap-2 transition-all"
      >
        <Icons.X className="w-4 h-4" /> 終了 (Esc)
      </button>

      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-black/60 backdrop-blur-lg rounded-full px-4 py-2 shadow-2xl border border-white/10">
        {[
          { label: '今日', preset: 'today' },
          { label: '今週', preset: 'thisWeek' },
          { label: '今月', preset: 'thisMonth' },
          { label: '先月', preset: 'lastMonth' },
        ].map(({ label, preset }) => (
          <button
            key={preset}
            onClick={() => setQuickDate(preset)}
            className="text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-full px-3 py-1 transition-all"
          >
            {label}
          </button>
        ))}
        <div className="w-px h-4 bg-white/20" />
        <input
          type="date"
          value={filters.dateRange.start}
          onChange={(e) => updateDateRange({ start: e.target.value })}
          className="text-xs bg-white/10 border border-white/20 rounded-full px-3 py-1 text-white outline-none focus:border-indigo-400 transition-all"
        />
        <span className="text-white/50">〜</span>
        <input
          type="date"
          value={filters.dateRange.end}
          onChange={(e) => updateDateRange({ end: e.target.value })}
          className="text-xs bg-white/10 border border-white/20 rounded-full px-3 py-1 text-white outline-none focus:border-indigo-400 transition-all"
        />
      </div>

      {allBadges.length > 0 && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-black/60 backdrop-blur-lg rounded-full shadow-2xl border border-white/10 overflow-x-auto max-w-[90vw]">
          {allBadges.map((b, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-white"
            >
              {b.label}
              <button
                onClick={b.onRemove}
                className="hover:text-rose-400 text-white/60 transition-colors"
              >
                <Icons.X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button
            onClick={clearCrossFilters}
            className="text-[10px] text-white/60 hover:text-white ml-2 underline shrink-0"
          >
            クリア
          </button>
        </div>
      )}

      {pagesCount > 1 && (
        <>
          <button
            onClick={() => {
              onPrevPage();
              setManualTrigger((t) => t + 1);
            }}
            className="absolute left-6 top-1/2 -translate-y-1/2 z-50 bg-slate-900/60 backdrop-blur-md text-white rounded-full p-3 shadow-xl hover:bg-slate-800 transition-all"
            title="前のページ"
          >
            <Icons.ArrowRight className="w-5 h-5 rotate-180" />
          </button>
          <button
            onClick={() => {
              onNextPage();
              setManualTrigger((t) => t + 1);
            }}
            className="absolute right-6 top-1/2 -translate-y-1/2 z-50 bg-slate-900/60 backdrop-blur-md text-white rounded-full p-3 shadow-xl hover:bg-slate-800 transition-all"
            title="次のページ"
          >
            <Icons.ArrowRight className="w-5 h-5" />
          </button>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2">
            {Array.from({ length: pagesCount }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentPageDisplayIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/40'
                }`}
              />
            ))}
          </div>
        </>
      )}

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
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(var(--color-grid) 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
            opacity: 0.5,
          }}
        />
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
                      id={`signage-arrowhead-${ann.id}`}
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
                      id={`signage-arrowhead-reverse-${ann.id}`}
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
                markerStart={ann.arrowStart ? `url(#signage-arrowhead-reverse-${ann.id})` : undefined}
                markerEnd={ann.arrowEnd ? `url(#signage-arrowhead-${ann.id})` : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}
        </svg>
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
              'signage',
              undefined,
              undefined,
              todayDiffMap,
              availableFields,
              handleDiffFilter,
              allWidgetValues,
              onDrilldown,
              undefined, // cacheStore
              comparisonDiffMap // ★ ここで正しく comparisonDiffMap を渡す
            )}
         </CanvasWidgetComponent>
        ))}
      </div>
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