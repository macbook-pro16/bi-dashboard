// src/components/ChartWidget.tsx
'use client';

import React, { useMemo } from 'react';
import {
  ComposedChart, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LabelList,
  CartesianGrid, ReferenceLine
} from 'recharts';
import { Widget, DBItem, DataConfig } from '../types';

interface ChartWidgetProps {
  widget: Widget;
  data: Record<string, number>;
  rawData: DBItem[];
  onBarClick?: (field: string, value: string) => void;
  dateRange?: { start: string; end: string };
  dateFilterField?: string;
  targetValue?: number;
  rawDataLine?: DBItem[];
}

const DEFAULT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
const BRAND_COLORS = ['#e16b8c', '#be185d', '#f43f5e', '#ec4899', '#db2777', '#9d174d'];
const WARM_COLORS = ['#f97316', '#ef4444', '#eab308', '#f59e0b', '#dc2626', '#b91c1c'];
const COOL_COLORS = ['#3b82f6', '#06b6d4', '#6366f1', '#8b5cf6', '#0ea5e9', '#2dd4bf'];

const COLOR_MAP: Record<string, string[]> = {
  default: DEFAULT_COLORS,
  brand: BRAND_COLORS,
  warm: WARM_COLORS,
  cool: COOL_COLORS,
};

// 簡易フォーマット（ChartWidget内で利用）
function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function truncateDate(dateStr: string, dimension: 'day' | 'week' | 'month' | 'year'): string {
  if (!dateStr) return '日付なし';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  switch (dimension) {
    case 'year': return `${d.getFullYear()}年`;
    case 'month': return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    case 'week': {
      const startOfYear = new Date(d.getFullYear(), 0, 1);
      const days = Math.floor((d.getTime() - startOfYear.getTime()) / 86400000);
      const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
      return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
    }
    default: return dateStr;
  }
}

function isDateField(rawData: DBItem[], field: string): boolean {
  if (!rawData.length) return false;
  const val = String(rawData[0][field] ?? '');
  return /^\d{4}-\d{2}-\d{2}/.test(val);
}

// X軸の日付キーを生成する
function generateDateRange(start: string, end: string, dimension: 'day' | 'week' | 'month'): string[] {
  const keys: string[] = [];
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return keys;

  let current = new Date(startDate);
  while (current <= endDate) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    if (dimension === 'day') {
      keys.push(`${y}-${m}-${d}`);
      current.setDate(current.getDate() + 1);
    } else if (dimension === 'week') {
      const startOfYear = new Date(y, 0, 1);
      const days = Math.floor((current.getTime() - startOfYear.getTime()) / 86400000);
      const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
      keys.push(`${y}-W${String(week).padStart(2, '0')}`);
      current.setDate(current.getDate() + 7);
    } else if (dimension === 'month') {
      keys.push(`${y}-${m}`);
      current.setMonth(current.getMonth() + 1);
    }
  }
  return [...new Set(keys)];
}

// 累積日割り目標線を生成（営業日ベース）
function generateCumulativeTargetLine(
  dateKeys: string[],
  totalTarget: number,
  dateRange: { start: string; end: string },
  workdayExclusions: string[],
  dimension: 'day' | 'week' | 'month'
): { name: string; targetLine: number }[] {
  const startDate = new Date(dateRange.start);
  const endDate = new Date(dateRange.end);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || totalTarget <= 0 || dateKeys.length === 0) {
    return dateKeys.map(key => ({ name: key, targetLine: 0 }));
  }

  const isWorkday = (dateStr: string): boolean => {
    if (dimension !== 'day') return true;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const day = d.getDay();
    if (day === 0 || day === 6) return false;
    if (workdayExclusions.includes(dateStr)) return false;
    return true;
  };

  let workdayCount = 0;
  if (dimension === 'day') {
    let current = new Date(startDate);
    while (current <= endDate) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      const d = String(current.getDate()).padStart(2, '0');
      const key = `${y}-${m}-${d}`;
      if (isWorkday(key)) workdayCount++;
      current.setDate(current.getDate() + 1);
    }
  } else {
    workdayCount = dateKeys.length;
  }

  const dailyTarget = totalTarget / workdayCount;
  const result: { name: string; targetLine: number }[] = [];
  let cumulative = 0;
  let lastTarget = 0;

  for (const key of dateKeys) {
    if (isWorkday(key)) {
      cumulative += dailyTarget;
      lastTarget = cumulative;
    } else {
      lastTarget = cumulative;
    }
    result.push({ name: key, targetLine: Math.round(lastTarget) });
  }
  return result;
}

// 日付で集計する関数
function aggregateByDate(
  rawData: DBItem[],
  dateField: string,
  valueField: string,
  aggregation: 'count' | 'sum' | 'avg' | 'max' | 'min',
  dimension: 'day' | 'week' | 'month',
  dateRange: { start: string; end: string }
): Record<string, number> {
  const result: Record<string, { sum: number; count: number; max: number; min: number }> = {};

  rawData.forEach(item => {
    const rawDate = item[dateField];
    if (!rawDate) return;
    const dateStr = String(rawDate);
    let key = dateStr;
    if (dimension === 'week') key = truncateDate(dateStr, 'week');
    else if (dimension === 'month') key = dateStr.substring(0, 7);
    else key = dateStr;

    if (!result[key]) {
      result[key] = { sum: 0, count: 0, max: -Infinity, min: Infinity };
    }
    result[key].count += 1;
    if (valueField && valueField !== 'count') {
      const val = Number(item[valueField]) || 0;
      result[key].sum += val;
      result[key].max = Math.max(result[key].max, val);
      result[key].min = Math.min(result[key].min, val);
    }
  });

  const aggregated: Record<string, number> = {};
  Object.entries(result).forEach(([key, grp]) => {
    let value: number;
    if (valueField === 'count' || aggregation === 'count') value = grp.count;
    else if (aggregation === 'avg') value = grp.count > 0 ? grp.sum / grp.count : 0;
    else if (aggregation === 'max') value = grp.count > 0 ? grp.max : 0;
    else if (aggregation === 'min') value = grp.count > 0 ? grp.min : 0;
    else value = grp.sum;
    aggregated[key] = Math.round(value);
  });
  return aggregated;
}

export default function ChartWidget({
  widget, data, rawData, onBarClick, dateRange, dateFilterField, targetValue, rawDataLine
}: ChartWidgetProps) {
  const { chartConfig, dataConfig, title, showTitle, textColor } = widget;
  const dc = (dataConfig || {}) as DataConfig;

  // 今日の日付（YYYY-MM-DD）
  const todayStr = formatLocalDate(new Date());

  // 複合グラフ判定
  const isCombo = !!(dc.barSourceIndex || dc.lineSourceIndex || dc.comboTargetTotal);
  const barSourceIdx = dc.barSourceIndex || dc.sourceIndex || '001';
  const lineSourceIdx = dc.lineSourceIndex || barSourceIdx;

  // 日付フィールド
  const barDateField = dc.comboDateField || dc.dateFilterField || dc.scoreDateField || 'date';
  const lineDateField = dc.comboLineDateField || barDateField;

  // データ
  const barRaw = rawData;
  const lineRaw = rawDataLine || barRaw;

  // 寸法等
  const widgetHeight = widget.h;
  const isSmall = widgetHeight < 180;
  const showLegend = chartConfig?.showLegend ?? true;
  const showDataLabels = dc.showDataLabels ?? chartConfig?.showDataLabels ?? false;
  const colorScheme = dc.colorScheme ?? chartConfig?.colorScheme ?? 'default';
  const colors = COLOR_MAP[colorScheme] || DEFAULT_COLORS;

  const titleX = dc.titleX || 0;
  const titleY = dc.titleY || 0;
  const titleAlign = dc.titleAlign || 'center';
  const titleFontSize = dc.titleFontSize || 14;
  const titleColor = dc.titleColor || textColor || '#475569';

  // Y軸の単位設定（オプション）
  const yAxisUnit = (dataConfig as any)?.yAxisUnit || 'none';
  const yAxisFormatter = useMemo(() => {
    const unitMap: Record<string, { divisor: number; suffix: string }> = {
      '万': { divisor: 10000, suffix: '万' },
      '百万': { divisor: 1000000, suffix: '百万' },
      '千': { divisor: 1000, suffix: '千' },
    };
    if (yAxisUnit && yAxisUnit in unitMap) {
      const { divisor, suffix } = unitMap[yAxisUnit];
      return (value: number) => {
        const divided = value / divisor;
        return divided.toLocaleString(undefined, { maximumFractionDigits: 1 }) + suffix;
      };
    }
    return (value: number) => value.toLocaleString();
  }, [yAxisUnit]);

  // 既存の単一グラフ用（非複合時）
  const effectiveChartType = dc.chartType ?? 'bar';
  const isLine = effectiveChartType === 'line';
  const isDonut = effectiveChartType === 'donut';

  // 単一グラフ用の集計
  const singleChartData = useMemo(() => {
    if (isCombo) return [];
    const xField = dc.xField ?? chartConfig?.xField ?? 'status';
    const yField = dc.yField ?? chartConfig?.yField ?? 'count';
    const agg = dc.chartAggregation ?? chartConfig?.aggregation ?? 'count';
    const dateDim = dc.dateDimension ?? chartConfig?.dateDimension ?? 'day';
    const limit = dc.limit ?? chartConfig?.limit ?? 20;
    const sortOrder = dc.sortOrder ?? chartConfig?.sortOrder ?? 'value-desc';
    const syncDateRange = dc.syncDateRange ?? chartConfig?.syncDateRange ?? true;
    const dateField = dateFilterField || dc.dateFilterField || dc.scoreDateField || 'date';

    const filtered = syncDateRange && dateRange
      ? barRaw.filter(item => {
          const d = item[dateField];
          return d && d >= dateRange.start && d <= dateRange.end;
        })
      : barRaw;

    if (!xField || filtered.length === 0) return [];

    const shouldTruncate = xField === 'date' || isDateField(filtered, xField);
    const grouped = filtered.reduce<Record<string, { sum: number; count: number; max: number; min: number }>>((acc, item) => {
      let rawValue = (item as any)[xField] ?? '';
      let key = String(rawValue);
      if (shouldTruncate) key = truncateDate(key, dateDim);
      if (!key) key = '不明';
      if (!acc[key]) acc[key] = { sum: 0, count: 0, max: -Infinity, min: Infinity };
      acc[key].count += 1;
      if (yField !== 'count') {
        const val = Number((item as any)[yField]) || 0;
        acc[key].sum += val;
        acc[key].max = Math.max(acc[key].max, val);
        acc[key].min = Math.min(acc[key].min, val);
      }
      return acc;
    }, {});

    const entries = Object.entries(grouped).map(([name, grp]) => {
      let value: number;
      if (yField === 'count' || agg === 'count') value = grp.count;
      else if (agg === 'avg') value = grp.count > 0 ? grp.sum / grp.count : 0;
      else if (agg === 'max') value = grp.count > 0 ? grp.max : 0;
      else if (agg === 'min') value = grp.count > 0 ? grp.min : 0;
      else value = grp.sum;
      return { name, value: Math.round(value) };
    });

    entries.sort((a, b) => {
      if (sortOrder === 'value-desc') return b.value - a.value;
      if (sortOrder === 'value-asc') return a.value - b.value;
      if (sortOrder === 'asc') return a.name.localeCompare(b.name);
      if (sortOrder === 'desc') return b.name.localeCompare(a.name);
      return 0;
    });
    if (shouldTruncate && (sortOrder === 'value-desc' || sortOrder === 'value-asc')) {
      entries.sort((a, b) => a.name.localeCompare(b.name));
    }
    return entries.slice(0, limit);
  }, [isCombo, barRaw, dateRange, dateFilterField, dc, chartConfig]);

  // 複合グラフ用データ
  const comboData = useMemo(() => {
    if (!isCombo) return [];
    const dimension = dc.comboDimension || 'day';
    // 終了日を今日で打ち切る（未来日付を含めない）
    const clampedEnd = dateRange?.end && dateRange.end > todayStr ? todayStr : (dateRange?.end || todayStr);
    const effectiveRange = dateRange ? { start: dateRange.start, end: clampedEnd } : { start: '', end: '' };
    const dateKeys = generateDateRange(effectiveRange.start, effectiveRange.end, dimension);

    // 今日までのキーのみにフィルタ（念のため）
    const filteredKeys = dateKeys.filter(key => key <= todayStr);

    const barAgg = dc.barAggregation || 'sum';
    const lineAgg = dc.lineAggregation || 'sum';
    const barField = dc.barField || 'count';
    const lineField = dc.lineField || '';

    const barAggregated = aggregateByDate(barRaw, barDateField, barField, barAgg, dimension, effectiveRange);
    const lineAggregated = lineField ? aggregateByDate(lineRaw, lineDateField, lineField, lineAgg, dimension, effectiveRange) : {};

    const targetData = dc.comboTargetTotal
      ? generateCumulativeTargetLine(filteredKeys, dc.comboTargetTotal, effectiveRange, dc.comboTargetWorkdays || [], dimension)
      : [];

    // 累積計算（今日までのキーで）
    let barCumulative = 0;
    let lineCumulative = 0;
    const merged = filteredKeys.map(key => {
      barCumulative += barAggregated[key] || 0;
      if (lineField) {
        lineCumulative += lineAggregated[key] || 0;
      }
      return {
        name: key,
        barValue: barCumulative,
        lineValue: lineField ? lineCumulative : undefined,
        targetLine: targetData.length > 0 ? targetData.find(t => t.name === key)?.targetLine : undefined,
      };
    });

    return merged;
  }, [isCombo, barRaw, lineRaw, dc, dateRange, todayStr]);

  const handleClick = (entry: any) => {
    if (onBarClick && entry && entry.name) {
      onBarClick('name', entry.name);
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-md shadow-lg border border-slate-100 rounded-xl p-3 min-w-[140px]">
          <p className="font-bold text-slate-600 text-[10px] mb-2 uppercase tracking-wider">{label}</p>
          {payload.map((entry: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between gap-4 text-sm">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-slate-500 text-xs">{entry.name}</span>
              </span>
              <span className="text-slate-800 font-bold">{yAxisFormatter(entry.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderChart = () => {
    if (isCombo) {
      const barLabel = dc.barLabel || '実績';
      const barColor = dc.barColor || colors[0];
      const lineLabel = dc.lineLabel || '';
      const lineColor = dc.lineColor || colors[1];
      const lineField = dc.lineField || '';
      const targetLabel = dc.comboTargetLabel || '目標';
      const targetColor = dc.comboTargetColor || '#ef4444';
      const targetWidth = dc.comboTargetWidth ?? 2;

      const computedDimension = dc.comboDimension || 'day';

      return (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={comboData} margin={{ top: showDataLabels ? 20 : 10, right: 15, left: 0, bottom: isSmall ? 5 : 20 }} isAnimationActive={false}>
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={barColor} stopOpacity={0.8} />
                <stop offset="100%" stopColor={barColor} stopOpacity={0.3} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
            {!isSmall && (
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                dy={6}
                height={28}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                tickFormatter={(value: string) => {
                  const dim = computedDimension;
                  if (dim === 'day') {
                    const parts = value.split('-');
                    return parts.length === 3 ? String(parseInt(parts[2], 10)) : value;
                  }
                  if (dim === 'week') {
                    return value.replace(/^\d{4}-W0?/, 'W');
                  }
                  if (dim === 'month') {
                    const parts = value.split('-');
                    return parts.length === 2 ? `${parseInt(parts[1], 10)}月` : value;
                  }
                  return value;
                }}
                interval={(() => {
                  const dim = computedDimension;
                  if (dim === 'day') {
                    const len = comboData.length;
                    if (len > 60) return 6;
                    if (len > 30) return 4;
                    if (len > 14) return 1;
                    return 0;
                  }
                  return 0;
                })()}
              />
            )}
            <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={yAxisFormatter} axisLine={false} tickLine={false} width={55} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9', opacity: 0.3 }} />
            <Legend wrapperStyle={{ fontSize: 10, fontWeight: 500, paddingTop: '8px' }} iconType="circle" />

            <Bar yAxisId="left" dataKey="barValue" name={barLabel} fill="url(#barGradient)" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false} />
            {lineField && (
              <Line yAxisId="left" type="linear" dataKey="lineValue" name={lineLabel} stroke={lineColor} strokeWidth={2.5} dot={{ r: 3, fill: lineColor, stroke: '#fff', strokeWidth: 1.5 }} activeDot={{ r: 5 }} isAnimationActive={false} />
            )}
            {dc.comboTargetTotal && (
              <Line yAxisId="left" type="stepAfter" dataKey="targetLine" name={targetLabel} stroke={targetColor} strokeWidth={targetWidth} strokeDasharray="6 3" dot={false} isAnimationActive={false} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      );
    }

    if (isDonut) {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }} isAnimationActive={false}>
            <Tooltip content={<CustomTooltip />} />
            <Pie data={singleChartData} cx="50%" cy="50%" innerRadius="60%" outerRadius="85%" paddingAngle={3} dataKey="value" nameKey="name" onClick={handleClick} stroke="none" isAnimationActive={false}>
              {singleChartData.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            {showLegend && <Legend wrapperStyle={{ fontSize: 10 }} layout="vertical" verticalAlign="middle" align="right" iconType="circle" />}
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (isLine) {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={singleChartData} margin={{ top: 10, right: 15, left: 0, bottom: isSmall ? 5 : 20 }} isAnimationActive={false}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={yAxisFormatter} axisLine={false} tickLine={false} width={55} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="linear" dataKey="value" stroke={colors[0]} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
            {showLegend && <Legend wrapperStyle={{ fontSize: 10 }} />}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={singleChartData} margin={{ top: showDataLabels ? 20 : 10, right: 15, left: 0, bottom: isSmall ? 5 : 20 }} isAnimationActive={false}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" height={40} />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={yAxisFormatter} axisLine={false} tickLine={false} width={55} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={60} onClick={handleClick} isAnimationActive={false}>
            {singleChartData.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
            {showDataLabels && <LabelList dataKey="value" position="top" style={{ fontSize: 10, fill: '#64748b' }} />}
          </Bar>
          {showLegend && <Legend wrapperStyle={{ fontSize: 10 }} />}
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="w-full h-full flex flex-col p-5" style={{ fontFamily: '"Inter", "Noto Sans JP", sans-serif' }}>
      {showTitle && title && (
        <div
          className="font-bold tracking-wide mb-3 shrink-0"
          style={{
            color: titleColor,
            fontSize: titleFontSize,
            textAlign: titleAlign,
            transform: `translate(${titleX}px, ${titleY}px)`,
            position: (titleX || titleY) ? 'relative' : 'static',
            letterSpacing: '0.02em',
          }}
        >
          {title}
        </div>
      )}
      <div className="flex-1 w-full min-h-0">
        {renderChart()}
      </div>
    </div>
  );
}