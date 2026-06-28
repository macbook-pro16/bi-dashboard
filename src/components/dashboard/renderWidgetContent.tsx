'use client';

import React, { useState, useEffect } from 'react';
import {
  Widget,
  DBItem,
  DataConfig,
  WidgetType,
  ShapeType,
} from '../../types';
import { resolveDateFilterField, extractStringValue, evaluateConditions } from '../../utils/dashboardUtils';
import Icons from '../Icons';
import TableWidget from '../TableWidget';
import KpiWidget from '../KpiWidget';
import GaugeWidget from '../GaugeWidget';
import TextBlockWidget from '../TextBlockWidget';
import OutlineWidget from '../OutlineWidget';
import ChartWidget from '../ChartWidget';
import ComparisonWidget from '../ComparisonWidget';
import FlowNodeWidget from '../FlowNodeWidget';
import TextWidget from '../TextWidget';
import WidgetErrorBoundary from '../WidgetErrorBoundary';

// ============================================================
// 内部コンポーネント: SlideshowWidgetContent
// ============================================================
function SlideshowWidgetContent({
  widget,
  mode,
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
  dateRange,
  editWidgets,
  layout,
  onChildSelect,
  todayDiffMap,
  availableFields,
  handleDiffFilter,
  allWidgetValues,
}: {
  widget: Widget;
  mode: 'view' | 'edit' | 'signage';
  computedValues: Record<string, number>;
  computedTargetValues: Record<string, number>;
  computedPreviousValues: Record<string, number>;
  filteredDataByIndex: Record<string, DBItem[]>;
  widgetFilteredData: Record<string, DBItem[]>;
  statusOptions: string[];
  handleStatusChange: any;
  handleChartCrossFilter: any;
  filters: any;
  toggleCrossFilter: any;
  dateRange: { start: string; end: string };
  editWidgets?: (layout: Widget[]) => void;
  layout?: Widget[];
  onChildSelect?: (childId: string) => void;
  todayDiffMap?: Record<string, { added: DBItem[]; removed: DBItem[] }>;
  availableFields?: string[];
  handleDiffFilter?: (ids: string[], label: string) => void;
  allWidgetValues?: Record<string, number>;
}) {
  const dc = widget.dataConfig || ({} as DataConfig);
  const children = widget.children || [];
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (mode === 'edit') return;
    if (!dc.slideshowAuto) return;
    if (children.length <= 1) return;
    const interval = dc.slideshowInterval ?? 5000;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % children.length);
    }, interval);
    return () => clearInterval(timer);
  }, [mode, dc.slideshowAuto, dc.slideshowInterval, children.length]);

  if (mode === 'edit') {
    if (children.length === 0) {
      return (
        <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-50 border border-dashed border-slate-300 rounded-lg flex-col gap-2">
          <Icons.Play className="w-8 h-8" />
          <span className="text-sm">スライドショー（子ウィジェットを追加してください）</span>
        </div>
      );
    }
    return (
      <div className="relative w-full h-full">
        {children.map((child) => (
          <div
            key={child.id}
            onClick={(e) => {
              e.stopPropagation();
              onChildSelect?.(child.id);
            }}
            style={{
              position: 'absolute',
              left: child.x,
              top: child.y,
              width: child.w,
              height: child.h,
              cursor: 'pointer',
            }}
          >
            {renderWidgetContent(
              child,
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
              dateRange,
              mode,
              editWidgets,
              layout,
              todayDiffMap,
              availableFields,
              handleDiffFilter,
              allWidgetValues,
            )}
          </div>
        ))}
      </div>
    );
  }

  const child = children[currentIndex];
  if (!child) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-400">
        スライドがありません
      </div>
    );
  }
  return (
    <div className="relative w-full h-full">
      {renderWidgetContent(
        child,
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
        dateRange,
        mode,
        editWidgets,
        layout,
        todayDiffMap,
        availableFields,
        handleDiffFilter,
        allWidgetValues,
      )}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2 z-30">
        {children.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              idx === currentIndex ? 'bg-indigo-600' : 'bg-slate-300'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// メイン関数: renderWidgetContent
// ============================================================
export function renderWidgetContent(
  w: Widget,
  computedValues: Record<string, number>,
  computedTargetValues: Record<string, number>,
  computedPreviousValues: Record<string, number>,
  filteredDataByIndex: Record<string, DBItem[]>,
  widgetFilteredData: Record<string, DBItem[]>,
  statusOptions: string[],
  handleStatusChange: any,
  handleChartCrossFilter: any,
  filters: any,
  toggleCrossFilter: any,
  dateRange: { start: string; end: string },
  mode: 'view' | 'edit' | 'signage',
  editWidgets?: (layout: Widget[]) => void,
  layout?: Widget[],
  todayDiffMap?: Record<string, { added: DBItem[]; removed: DBItem[] }>,
  availableFields?: string[],
  handleDiffFilter?: (ids: string[], label: string) => void,
  allWidgetValues?: Record<string, number>,
  onDrilldown?: (field: string, value: string, widgetTitle: string, data?: any[], columns?: string[], images?: string[]) => void,
) {
  const dc = w.dataConfig || ({} as DataConfig);
  const srcIdx = dc.sourceIndex || w.dataSourceIndex || '001';
  const isNone = srcIdx === 'none';
  const dateFilterField = resolveDateFilterField(w);

  if (w.type === 'table-details') {
    const ds = widgetFilteredData[w.id] || [];
    return (
      <TableWidget
        data={ds}
        config={w.tableConfig}
        statusOptions={statusOptions}
        onStatusChange={handleStatusChange}
        widget={w}
        onColumnsReorder={(columns) => {
          if (mode === 'edit' && editWidgets && layout) {
            editWidgets(
              layout.map((widget) =>
                widget.id === w.id
                  ? { ...widget, tableConfig: { ...widget.tableConfig, columns } }
                  : widget,
              ),
            );
          }
        }}
      />
    );
  }

  if (w.type === 'slideshow') {
    return (
      <SlideshowWidgetContent
        widget={w}
        mode={mode}
        computedValues={computedValues}
        computedTargetValues={computedTargetValues}
        computedPreviousValues={computedPreviousValues}
        filteredDataByIndex={filteredDataByIndex}
        widgetFilteredData={widgetFilteredData}
        statusOptions={statusOptions}
        handleStatusChange={handleStatusChange}
        handleChartCrossFilter={handleChartCrossFilter}
        filters={filters}
        toggleCrossFilter={toggleCrossFilter}
        dateRange={dateRange}
        editWidgets={editWidgets}
        layout={layout}
        onChildSelect={undefined}
        todayDiffMap={todayDiffMap}
        availableFields={availableFields}
        handleDiffFilter={handleDiffFilter}
        allWidgetValues={allWidgetValues}
      />
    );
  }

  const ds = filteredDataByIndex[srcIdx] || [];

  switch (w.type) {
        case 'scorecard': {
      const val = computedValues[w.id];
      if (val === undefined && !isNone) {
        return (
          <div className="w-full h-full flex items-center justify-center text-sm text-slate-400">
            指標未選択
          </div>
        );
      }

      // ★ 既存の特殊ケース（写真なし車両）用のクリックハンドラ（外側のdiv用）
      const handleScorecardClick = () => {
        if (mode !== 'view' && mode !== 'signage') return;
        const wpData = filteredDataByIndex['wp_inventory_without_photo'] || [];
        if (wpData.length > 0) {
          handleChartCrossFilter('写真なし車両', String(wpData.length), w.title, wpData);
        }
      };

      // ★ 新規：メイン数値クリック時のドリルダウンハンドラ（画像対応版）
                  const handleMainValueClick = () => {
        if (mode !== 'view' && mode !== 'signage') return;
        if (!onDrilldown) return;

        const srcIdx = dc.sourceIndex || w.dataSourceIndex || '001';
        const allSrc = filteredDataByIndex[srcIdx] || [];
        const dateField = resolveDateFilterField(w);
        const dateFilter = dc.dateFilter ?? 'range';
        const { start, end } = dateRange;

        let baseData = allSrc;
        if (dateFilter === 'range') {
          baseData = allSrc.filter((item) => {
            const d = item[dateField];
            if (!d) return false;
            return d >= start && d <= end;
          });
        } else if (dateFilter === 'today') {
          const todayStr = new Date().toISOString().split('T')[0];
          baseData = allSrc.filter((item) => item[dateField] === todayStr);
        }

        const applyGlobalFilters = (data: DBItem[]) => {
          return data.filter((item) => {
            if (filters.statuses && filters.statuses.length > 0) {
              if (!filters.statuses.includes(item.status)) return false;
            }
            if (filters.crossFilters) {
              for (const [field, values] of Object.entries(filters.crossFilters)) {
                const valuesArray = values as string[];
                if (valuesArray && valuesArray.length > 0) {
                  const val = extractStringValue(item[field]);
                  if (!valuesArray.includes(val)) return false;
                }
              }
            }
            return true;
          });
        };
        const crossFiltered = applyGlobalFilters(baseData);

        const conditions = dc.filterConditions || [];
        const logic = dc.conditionLogic || 'and';
        const filteredByConditions = crossFiltered.filter((item) => {
          const passCross = evaluateConditions(item, conditions, logic);
          const passIndicator = (() => {
            if (!dc.field) return true;
            const val = extractStringValue(item[dc.field]);
            if (dc.filterOperator === 'empty') return !val || val === '' || val === 'undefined';
            if (dc.filterOperator === 'not_empty') return !!val && val !== '' && val !== 'undefined';
            if (!dc.filterValue) return true;
            if (dc.filterOperator === 'neq') return val !== dc.filterValue;
            return val === dc.filterValue;
          })();
          return passCross && passIndicator;
        });

        const drilldownColumns = dc.drilldownFields && dc.drilldownFields.length > 0
          ? dc.drilldownFields
          : undefined;

        // ★★★ 画像取得ロジック（デバッグコード付き） ★★★
        const wpData = filteredDataByIndex['wp_inventory'] || [];
        let images: string[] = [];

        const manageIdCandidates = ['v_manage_id', '管理番号', 'manage_id', 'vehicle_id'];
        let manageId: string | null = null;

        // ★ デバッグ1: フィルタリング結果の最初のアイテムを確認
        console.log('=== DEBUG: filteredByConditions[0] ===', filteredByConditions[0]);

        if (filteredByConditions.length > 0) {
          const firstItem = filteredByConditions[0];
          for (const candidate of manageIdCandidates) {
            if (firstItem[candidate]) {
              manageId = String(firstItem[candidate]);
              break;
            }
          }
          if (!manageId) {
            for (const [key, value] of Object.entries(firstItem)) {
              if (typeof value === 'string' && /^\d+$/.test(value) && value.length >= 4) {
                manageId = value;
                break;
              }
            }
          }
        }

        // ★ デバッグ2: 抽出した管理番号を確認
        console.log('=== DEBUG: manageId ===', manageId);

        if (manageId) {
          const matchedWp = wpData.find((item: any) => {
            for (const candidate of manageIdCandidates) {
              if (String(item[candidate]) === manageId) {
                return true;
              }
            }
            return false;
          });
          // ★ デバッグ3: マッチしたWPデータを確認
          console.log('=== DEBUG: matchedWp ===', matchedWp);
          if (matchedWp && Array.isArray(matchedWp.images)) {
            images = matchedWp.images;
          }
        }

        // ★ デバッグ4: 最終的な images を確認
        console.log('=== DEBUG: images (before onDrilldown) ===', images);

        onDrilldown(
          undefined as any,
          undefined as any,
          w.title,
          filteredByConditions,
          drilldownColumns,
          images,
        );
      };

      return (
        <div onClick={handleScorecardClick} style={{ cursor: 'pointer', width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <KpiWidget
            value={val ?? 0}
            hideValue={isNone}
            fontSize={w.fontSize}
            label={w.title}
            showTitle={w.showTitle !== false}
            textAlign={w.textAlign}
            textColor={w.textColor}
            conditionalTextRules={dc.conditionalTextRules}
            conditionalBgRules={dc.conditionalBgRules}
            showTrendIcon={dc.showTrendIcon}
            trendTarget={dc.trendTarget}
            targetValue={dc.targetValue ?? w.targetValue}
            previousValue={computedPreviousValues[w.id]}
            showTodayValue={dc.showTodayValue}
            colorDelta={dc.colorDelta}
            colorDeltaMinus={dc.colorDeltaMinus}
            titleFontSize={dc.titleFontSize}
            titleColor={dc.titleColor}
            titleAlign={dc.titleAlign}
            titleX={dc.titleX}
            titleY={dc.titleY}
            valueX={dc.valueX}
            valueY={dc.valueY}
            todayFontSize={dc.todayFontSize}
            todayX={dc.todayX}
            todayY={dc.todayY}
            addedX={dc.addedX}
            addedY={dc.addedY}
            removedX={dc.removedX}
            removedY={dc.removedY}
            todayDiff={dc.showTodayValue ? todayDiffMap?.[w.id] : undefined}
            todayPopupFields={dc.todayPopupFields}
            onDiffFilter={handleDiffFilter}
            onClick={handleMainValueClick}
          />
        </div>
      );
    }
    case 'gauge': {
      const actualValue = computedValues[w.id] ?? 0;
      const targetValue = computedTargetValues[w.id] ?? 1;
      const previousValue = computedPreviousValues[w.id];
      const minVal = dc.gaugeMinValue ?? 0;
      const maxVal = dc.gaugeMaxValue ?? undefined;
      return (
        <GaugeWidget
          value={actualValue}
          target={targetValue}
          minValue={minVal}
          maxValue={maxVal}
          previousValue={previousValue !== undefined ? previousValue : undefined}
          label={w.title}
          unit={dc.gaugeUnit || ''}
          showTitle={w.showTitle !== false}
          textAlign={w.textAlign}
          textColor={w.textColor}
          fontSize={w.fontSize}
          colorDefault={dc.colorDefault}
          colorCurrent={dc.colorCurrent}
          colorUnderTarget={dc.colorUnderTarget}
          colorOverTarget={dc.colorOverTarget}
          colorTargetMarker={dc.colorTargetMarker}
          colorDelta={dc.colorDelta}
          titleFontSize={dc.titleFontSize}
          titleColor={dc.titleColor}
          titleAlign={dc.titleAlign}
          titleX={dc.titleX}
          titleY={dc.titleY}
          statsLabelFontSize={dc.statsLabelFontSize}
          statsValueFontSize={dc.statsValueFontSize}
        />
      );
    }
    case 'kpi-total':
    case 'kpi-today':
    case 'kpi-filtered':
      return (
        <KpiWidget
          value={computedValues[w.id] ?? 0}
          hideValue={isNone}
          fontSize={w.fontSize}
          label={
            w.type === 'kpi-total'
              ? 'ALL ROWS'
              : w.type === 'kpi-today'
                ? 'TODAY'
                : 'FILTERED'
          }
          showTitle={w.showTitle !== false}
          textAlign={w.textAlign}
          textColor={w.textColor}
          targetValue={dc.targetValue ?? w.targetValue}
          previousValue={computedPreviousValues[w.id]}
          showTodayValue={dc.showTodayValue}
          colorDelta={dc.colorDelta}
          colorDeltaMinus={dc.colorDeltaMinus}
          titleFontSize={dc.titleFontSize}
          titleColor={dc.titleColor}
          titleAlign={dc.titleAlign}
          titleX={dc.titleX}
          titleY={dc.titleY}
          valueX={dc.valueX}
          valueY={dc.valueY}
          todayFontSize={dc.todayFontSize}
          todayX={dc.todayX}
          todayY={dc.todayY}
          addedX={dc.addedX}
          addedY={dc.addedY}
          removedX={dc.removedX}
          removedY={dc.removedY}
          todayDiff={dc.showTodayValue ? todayDiffMap?.[w.id] : undefined}
          todayPopupFields={dc.todayPopupFields}
          onDiffFilter={handleDiffFilter}
        />
      );
    case 'flow-node':
      return (
        <FlowNodeWidget
          statusTarget={w.statusTarget || ''}
          filterField={dc.filterField}
          count={computedValues[w.id] ?? 0}
          fontSize={w.fontSize}
        />
      );
    case 'text-only':
      return <TextWidget title={w.title} fontSize={w.fontSize} />;
    case 'text-block':
      return (
        <TextBlockWidget
          textContent={w.textContent || dc.textContent || ''}
          fontSize={w.fontSize}
          textColor={w.textColor}
          textAlign={w.textAlign}
          bgColor={w.bgColor}
          bgAlpha={w.bgAlpha ?? 0}
          onTextChange={(newText) => {
            if (mode === 'edit' && editWidgets && layout) {
              editWidgets(
                layout.map((widget) =>
                  widget.id === w.id
                    ? {
                        ...widget,
                        textContent: newText,
                        dataConfig: {
                          ...widget.dataConfig,
                          textContent: newText,
                        } as DataConfig,
                      }
                    : widget,
                ),
              );
            }
          }}
          isEditMode={mode === 'edit'}
        />
      );
    case 'outline':
      return (
        <OutlineWidget
          outlineConfig={w.outlineConfig}
          borderColor={w.borderColor}
          borderWidth={w.borderWidth}
          shape={
            w.shape === 'circle'
              ? 'circle'
              : w.shape === 'rounded'
                ? 'rounded'
                : 'rectangle'
          }
          bgAlpha={w.bgAlpha ?? 0}
          bgColor={w.bgColor}
          hasShadow={w.hasShadow}
        />
      );
    case 'chart': {
      const barSrcIdx = dc.barSourceIndex || srcIdx;
      const lineSrcIdx = dc.lineSourceIndex || barSrcIdx;
      return (
        <div className="relative w-full h-full">
          {mode === 'edit' && <div className="absolute inset-0 z-10" />}
          <ChartWidget
            widget={w}
            data={{} as Record<string, number>}
            rawData={filteredDataByIndex[barSrcIdx] || ds}
            rawDataLine={filteredDataByIndex[lineSrcIdx] || undefined}
            onBarClick={(field, value) =>
              handleChartCrossFilter(field, value, w.title)
            }
            dateRange={dateRange}
          />
        </div>
      );
    }
    case 'comparison': {
      const compDc = w.dataConfig || ({} as DataConfig);

      const calcSum = (
        items: { widgetId: string; operator: 'plus' | 'minus' }[] | undefined,
      ) =>
        (items || []).reduce((sum, item) => {
          const val = allWidgetValues?.[item.widgetId] ?? 0;
          return item.operator === 'minus' ? sum - val : sum + val;
        }, 0);

      const actual = calcSum(compDc.compareActualItems);
      const target = calcSum(compDc.compareTargetItems);

      return (
        <ComparisonWidget
          label={w.title}
          showTitle={w.showTitle !== false}
          titleColor={compDc.titleColor}
          titleFontSize={compDc.titleFontSize}
          titleX={compDc.titleX || 0}
          titleY={compDc.titleY || 0}
          fontSize={w.fontSize}
          textColor={w.textColor}
          bgColor={w.bgColor}
          bgAlpha={w.bgAlpha ?? 1}
          actual={actual}
          target={target}
          actualLabel={compDc.compareActualLabel || '実績'}
          targetLabel={compDc.compareTargetLabel || '目標'}
        />
      );
    }
    case 'group':
      if (w.children && w.children.length > 0) {
        const groupBorder =
          w.borderWidth > 0 && w.borderColor && w.shape !== 'text-only'
            ? `${w.borderWidth}px solid ${w.borderColor}`
            : 'none';
        return (
          <div
            className="relative w-full h-full"
            style={{
              border: groupBorder,
              borderRadius:
                w.shape === 'rounded'
                  ? '16px'
                  : w.shape === 'circle'
                    ? '50%'
                    : '0px',
              boxShadow: w.hasShadow
                ? '0 4px 12px -2px rgba(0,0,0,0.05)'
                : 'none',
            }}
          >
            {w.children.map((child) => (
              <div
                key={child.id}
                style={{
                  position: 'absolute',
                  left: child.x,
                  top: child.y,
                  width: child.w,
                  height: child.h,
                  backgroundColor: child.bgColor,
                  color: child.textColor,
                  border:
                    w.hideChildrenBorders || child.shape === 'text-only'
                      ? 'none'
                      : `${child.borderWidth}px solid ${child.borderColor}`,
                  borderRadius:
                    child.shape === 'circle'
                      ? '50%'
                      : child.shape === 'rounded'
                        ? '24px'
                        : '0px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: child.textAlign,
                  boxShadow: child.hasShadow
                    ? '0 4px 6px -1px rgba(0,0,0,0.1)'
                    : 'none',
                }}
              >
                <WidgetErrorBoundary>
                  {renderWidgetContent(
                    child,
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
                    dateRange,
                    mode,
                    editWidgets,
                    layout,
                    todayDiffMap,
                    availableFields,
                    handleDiffFilter,
                    allWidgetValues,
                  )}
                </WidgetErrorBoundary>
              </div>
            ))}
          </div>
        );
      }
      return (
        <div className="w-full h-full flex items-center justify-center text-sm font-medium text-slate-400 bg-slate-50 border border-dashed border-slate-300 rounded-lg">
          <Icons.Folder className="w-4 h-4 mr-2" /> グループ(ネスト不可)
        </div>
      );
    default:
      return null;
  }
}