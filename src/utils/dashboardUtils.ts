// src/utils/dashboardUtils.ts
import { Widget, WidgetType, DataConfig, DBItem, FilterCondition, DashboardPage } from '../types';
import { DEFAULT_FILTER_DATE_RANGE } from '../constants';

export const BRAND_COLOR = '#e16b8c';
export const SCHEMA_VERSION = 4;
export const ARTBOARD_WIDTH = 1920;
export const ARTBOARD_HEIGHT = 1080;

export function defaultDataConfig(type: WidgetType): DataConfig {
  const base: DataConfig = {
    sourceIndex: '001',
    dateFilter: 'range',
    field: undefined,
    aggregation: 'count',
    xField: 'status',
    yField: 'count',
    chartAggregation: 'count',
    dateDimension: 'day',
    limit: 20,
    sortOrder: 'value-desc',
    syncDateRange: true,
    showDataLabels: false,
    colorScheme: 'default',
    filterConditions: [],
    conditionLogic: 'and',
    conditionalTextRules: [],
    conditionalBgRules: [],
    showTrendIcon: false,
    trendTarget: 'previous',
  };
  if (type === 'scorecard') {
    base.scoreDateField = 'date';
    base.dateFilterField = 'date';
    base.field = undefined;
    base.dateFilter = 'range';
    base.filterConditions = [];
    base.conditionalTextRules = [];
    base.conditionalBgRules = [];
    base.showTodayValue = false;
    base.drilldownFields = [];
  } else if (type === 'table-details') {
    base.scoreDateField = 'date';
    base.dateFilterField = 'date';
    base.field = undefined;
    base.dateFilter = 'range';
    base.filterConditions = [];
  } else if (type === 'gauge') {
    base.field = undefined;
    base.aggregation = 'count';
    base.dateFilter = 'range';
    base.scoreDateField = 'date';
    base.dateFilterField = 'date';
    base.filterConditions = [];
    base.gaugeUnit = '';
    base.gaugeMinValue = 0;
    base.gaugeMaxValue = undefined;
    base.gaugeTargetValue = undefined;
    base.gaugeTargetColor = '#ffffff';
    base.gaugeTargetWidth = 4;
    base.colorDefault = '#e2e8f0';
    base.colorCurrent = '#10b981';
    base.colorUnderTarget = '#ef4444';
    base.colorOverTarget = '#8b5cf6';
    base.colorTargetMarker = '#cbd5e1';
    base.colorDelta = '#06b6d4';
    base.targetField = undefined;
    base.targetAggregation = 'none';
    base.targetSourceIndex = undefined;
    base.targetFilterConditions = [];
    base.targetConditionLogic = 'and';
    base.targetDateFilter = 'range';
    base.targetDateField = 'date';
  } else if (type === 'chart') {
    base.chartType = 'bar';
    base.dateFilterField = 'date';
  } else if (type === 'text-block') {
    base.textContent = '新しいテキストブロック';
    base.dateFilter = 'none';
  } else if (type === 'outline') {
    base.dateFilter = 'none';
  } else if (type === 'slideshow') {
    base.dateFilter = 'none';
    base.slideshowInterval = 5000;
    base.slideshowAuto = true;
  } else if (type === 'comparison') {
    base.compareWidgetIds = [];
    base.compareTargetType = 'fixed';
    base.compareTarget = 0;
  } else if (type === 'ranking-card') {
    base.sourceIndex = 'wp_ranking';
    base.dateFilter = 'none';
    base.rankingCardLimit = 20;
    base.rankingCardColumns = 8;
    base.rankingCardRows = 3;
  }
  return base;
}

export function stripFormula(widgets: Widget[]): Widget[] {
  return widgets.map(w => { const { formula, ...rest } = w as any; return rest as Widget; });
}

export function safeBase64Encode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let b = '';
  bytes.forEach(byte => b += String.fromCharCode(byte));
  return btoa(b);
}

export function safeBase64Decode(b64: string): string {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function migrateChartTypes(widgets: Widget[]): Widget[] {
  return widgets.map(w => {
    const legacyTypes = ['chart-bar', 'chart-line', 'chart-donut', 'chart-status'];
    if (legacyTypes.includes(w.type as string)) {
      const chartTypeMap: Record<string, 'bar' | 'line' | 'donut'> = {
        'chart-bar': 'bar',
        'chart-line': 'line',
        'chart-donut': 'donut',
        'chart-status': 'bar',
      };
      return {
        ...w,
        type: 'chart' as WidgetType,
        dataConfig: {
          ...w.dataConfig,
          sourceIndex: w.dataConfig?.sourceIndex || '001',
          chartType: w.dataConfig?.chartType || chartTypeMap[w.type as string] || 'bar',
        } as DataConfig,
      };
    }
    if (w.children) return { ...w, children: migrateChartTypes(w.children) };
    return w;
  });
}

export function migrateDashboardData(data: DashboardPage[], fromVersion: number): DashboardPage[] {
  if (fromVersion < 2) data = data.map(p => ({ ...p, layout: p.layout.map(w => ({ ...w, dataSourceIndex: '001' })) }));
  if (fromVersion < 3) data = data.map(p => ({ ...p, layout: p.layout.map(w => ({ ...w, targetValue: undefined, previousValue: undefined })) }));
  data = data.map(p => ({ ...p, layout: migrateChartTypes(p.layout) }));
  if (fromVersion < 4) {
  data = data.map(p => ({
    ...p,
    includeInSignage: p.includeInSignage !== false,
    published: p.published !== false, 
  }));
}
// ★ バージョン5: published プロパティを追加（なければ true）
data = data.map(p => ({ ...p, published: p.published !== false }));
  data = data.map(p => ({ ...p, annotations: p.annotations || [] }));
  return data;
}

export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function resolveDateFilterField(w: Widget): string {
  const dc = w.dataConfig;
  return dc?.dateFilterField || dc?.scoreDateField || 'date';
}

export function extractStringValue(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) {
    return val.map(v => extractStringValue(v)).join(', ');
  }
  if (typeof val === 'object') {
    if (val.relation && Array.isArray(val.relation)) {
      return val.relation.map((r: any) => r.id || '').filter(Boolean).join(', ');
    }
    if (val.rollup?.type === 'array' && Array.isArray(val.rollup.array)) {
      return val.rollup.array.map((v: any) => extractStringValue(v)).join(', ');
    }
    if (val.select?.name) return val.select.name;
    if (val.name) return val.name;
    if (val.title) return val.title;
    if (val.id) return val.id;
    return JSON.stringify(val);
  }
  return String(val);
}

export function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
    || /^[0-9a-f]{32}$/i.test(s);
}

export function isRelationField(data: DBItem[], field: string): boolean {
  const samples = data
    .slice(0, 5)
    .map(item => item[field])
    .filter(v => v !== null && v !== undefined);
  if (samples.length === 0) return false;
  const isObjRel = samples.every(v => 
    typeof v === 'object' && v !== null && v.relation && Array.isArray(v.relation)
  );
  if (isObjRel) return true;
  const strSamples = samples.map(v => String(v)).filter(v => v !== '');
  if (strSamples.length === 0) return false;
  return strSamples.every(v => {
    const parts = v.split(',').map(p => p.trim());
    return parts.every(p => isUuid(p) || p === '');
  });
}

export function evaluateConditions(
  item: DBItem,
  conditions: { field: string; value: string; operator?: string; logic?: 'and' | 'or' }[],
  globalLogic: 'and' | 'or' = 'and'
): boolean {
  if (!conditions.length) return true;
  const check = (cond: { field: string; value: string; operator?: string }) => {
    const val = extractStringValue(item[cond.field]);
    if (cond.operator === 'empty') return !val || val === '' || val === 'undefined';
    if (cond.operator === 'not_empty') return !!val && val !== '' && val !== 'undefined';
    if (cond.operator === 'neq') return val !== cond.value;
    return val === cond.value;
  };
  let result = check(conditions[0]);
  for (let i = 1; i < conditions.length; i++) {
    const cond = conditions[i];
    const condResult = check(cond);
    const logic = cond.logic || 'and';
    if (logic === 'and') {
      result = result && condResult;
    } else {
      result = result || condResult;
    }
  }
  return result;
}

// ★ 追加：フィールド＋集計方法から1つの数値を出す（分子・分母どちらにも使う共通処理）
export function computeAggregatedValue(
  items: DBItem[],
  field?: string,
  aggregation?: 'count' | 'sum' | 'avg' | 'max' | 'min'
): number {
  if (!field || field === 'count' || aggregation === 'count') {
    return items.length;
  }
  const values = items.map(item => Number(item[field]) || 0).filter(v => v !== 0);
  switch (aggregation) {
    case 'sum': return values.reduce((a, b) => a + b, 0);
    case 'avg': return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    case 'max': return values.length ? Math.max(...values) : 0;
    case 'min': return values.length ? Math.min(...values) : 0;
    default: return items.length;
  }
}

// ★ 追加：計算モードが有効なら numerator と分母を演算子で組み合わせる
export function applyCalcMode(
  numeratorValue: number,
  dc: DataConfig,
  filteredItems: DBItem[]
): number {
  if (!dc.calcMode) return numeratorValue;
  const denominator = computeAggregatedValue(
    filteredItems,
    dc.calcDenominatorField,
    dc.calcDenominatorAggregation
  );
  switch (dc.calcOperator) {
    case 'divide': return denominator !== 0 ? numeratorValue / denominator : 0;
    case 'multiply': return numeratorValue * denominator;
    case 'add': return numeratorValue + denominator;
    case 'subtract': return numeratorValue - denominator;
    default: return numeratorValue;
  }
}