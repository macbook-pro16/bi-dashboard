// src/types/index.ts
export type WidgetType =
  | 'kpi-total' | 'kpi-today' | 'kpi-filtered'
  | 'chart'
  | 'table-details' | 'flow-node' | 'text-only' | 'group'
  | 'scorecard'
  | 'gauge'
  | 'text-block'
  | 'outline'
  | 'slideshow'
  | 'comparison'
  | 'ranking-card';

export type ShapeType =
  | 'rectangle' | 'rounded' | 'pill' | 'circle'
  | 'text-only';

export interface FilterCondition {
  field: string;
  value: string;
  operator?: 'eq' | 'neq' | 'empty' | 'not_empty';
  logic?: 'and' | 'or';
}

export interface DataConfig {
  sourceIndex: string;
  field?: string;
  aggregation?: 'count' | 'sum' | 'avg' | 'max' | 'min';
  dateFilter?: 'none' | 'today' | 'range';
  targetValue?: number;
  previousValue?: number;
  filterField?: string;
  filterValue?: string;
  filterOperator?: 'eq' | 'neq' | 'empty' | 'not_empty';
  chartType?: 'bar' | 'line' | 'donut';
  xField?: string;
  yField?: string;
  chartAggregation?: 'count' | 'sum' | 'avg' | 'max' | 'min';
  dateDimension?: 'day' | 'week' | 'month' | 'year';
  limit?: number;
  sortOrder?: 'value-desc' | 'value-asc' | 'asc' | 'desc';
  colorScheme?: 'default' | 'brand' | 'warm' | 'cool';
  showDataLabels?: boolean;
  syncDateRange?: boolean;
  scoreDateField?: string;
  dateFilterField?: string;
  filterConditions?: FilterCondition[];
  conditionLogic?: 'and' | 'or';
  conditionalTextRules?: { operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq'; value: number; textColor: string }[];
  conditionalBgRules?: { operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq'; value: number; bgColor: string }[];
  showTrendIcon?: boolean;
  trendTarget?: 'previous' | 'target';
  showTodayValue?: boolean;
  gaugeUnit?: string;
  gaugeMinValue?: number;
  gaugeMaxValue?: number;
  gaugeTargetValue?: number;
  gaugeTargetColor?: string;
  gaugeTargetWidth?: number;
  gaugeColorStops?: { percent: number; color: string }[];
  statsLabelFontSize?: number;
  statsValueFontSize?: number;   // 対応する数値のフォントサイズ
  colorDefault?: string;
  colorCurrent?: string;
  colorUnderTarget?: string;
  colorOverTarget?: string;
  colorTargetMarker?: string;
  colorDelta?: string;
  colorDeltaMinus?: string;
  targetSourceIndex?: string;
  targetField?: string;
  targetAggregation?: 'count' | 'sum' | 'avg' | 'max' | 'min' | 'none';
  targetFilterConditions?: FilterCondition[];
  targetConditionLogic?: 'and' | 'or';
  targetDateFilter?: 'none' | 'today' | 'range';
  targetDateField?: string;
  textContent?: string;
  todayDiffMatchField?: string;
  todayDiffChangeField?: string;
  
  titleFontSize?: number;
  titleColor?: string;
  titleAlign?: 'left' | 'center' | 'right';
  titleX?: number;
  titleY?: number;

  slideshowInterval?: number;
  slideshowAuto?: boolean;
  slideshowCurrentIndex?: number;

  valueX?: number;
  valueY?: number;
  todayFontSize?: number;
  todayX?: number;
  todayY?: number;

  // 増加・減少の個別座標（デフォルトはメイン数値位置）
  addedX?: number;
  addedY?: number;
  removedX?: number;
  removedY?: number;

  barSourceIndex?: string;
  barField?: string;
  barAggregation?: 'count' | 'sum' | 'avg' | 'max' | 'min';
  barLabel?: string;
  barColor?: string;
  barFilterConditions?: FilterCondition[];

  lineSourceIndex?: string;
  lineField?: string;
  lineAggregation?: 'count' | 'sum' | 'avg' | 'max' | 'min';
  lineLabel?: string;
  lineColor?: string;
  lineFilterConditions?: FilterCondition[];

  comboTargetTotal?: number;
  comboTargetColor?: string;
  comboTargetWidth?: number;
  comboTargetWorkdays?: string[];
  comboTargetLabel?: string;

  comboDimension?: 'day' | 'week' | 'month';
  comboDateField?: string;
  comboLineDateField?: string;

    todayPopupFields?: string[];
  drilldownFields?: string[];
  // ランキングカード用
  rankingCardLimit?: number;
  rankingCardColumns?: number;
  rankingCardRows?: number;

  compareWidgetIds?: string[];      // 合計するスコアカードのIDリスト
  compareTargetType?: 'fixed' | 'widget'; // 比較対象：固定値 or 別ウィジェット
  compareTarget?: number;           // 固定目標値
  compareTargetWidgetId?: string;   // 目標値として参照するウィジェットID
  compareExpression?: string;    // 数式（例: "w_123 + w_456 - w_789"）
  // 比較ウィジェット用
  compareActualItems?: { widgetId: string; operator: 'plus' | 'minus' }[];  // 実績値の計算要素（最大20）
  compareTargetItems?: { widgetId: string; operator: 'plus' | 'minus' }[];  // 目標値の計算要素（最大20）
  compareActualLabel?: string;
  compareTargetLabel?: string;

  // 差分抽出用（実績側）
  compareActualSourceIndex?: string;
  compareActualFilterConditions?: FilterCondition[];
  compareActualConditionLogic?: 'and' | 'or';
  compareActualKeyField?: string;

  // 差分抽出用（目標側）
  compareTargetSourceIndex?: string;
  compareTargetFilterConditions?: FilterCondition[];
  compareTargetConditionLogic?: 'and' | 'or';
  compareTargetKeyField?: string;

  // ポップアップに表示するフィールド
  compareDiffPopupFields?: string[];
}

export interface OutlineConfig {
  shape: 'rectangle' | 'rounded' | 'circle';
  borderWidth: number;
  borderColor: string;
  borderStyle: 'solid' | 'dashed' | 'dotted';
  bgColor?: string;
  bgAlpha?: number;
}

export interface Widget {
  id: string; type: WidgetType; title: string;
  x: number; y: number; w: number; h: number;
  shape: ShapeType;
  bgColor: string; textColor: string;
  borderColor: string; borderWidth: number;
  fontSize: number;
  textAlign: 'left' | 'center' | 'right';
  fontFamily: 'sans' | 'serif' | 'mono';
  hasShadow: boolean; hidden: boolean; locked: boolean;
  showTitle: boolean;
  bgAlpha: number;
  statusTarget?: string; children?: Widget[];
  formula?: string; alertRules?: AlertRule[];
  comments?: WidgetComment[]; tableConfig?: TableConfig;
  chartConfig?: ChartConfig;
  kpiField?: string; kpiAggregation?: 'count' | 'sum' | 'avg';
  targetField?: string; dataSourceIndex?: string;
  targetValue?: number; previousValue?: number;
  dataConfig?: DataConfig;
  hideChildrenBorders?: boolean;
  textContent?: string;
  outlineConfig?: OutlineConfig;
}

export interface ChartConfig {
  xField?: string; yField?: string;
  aggregation?: 'sum' | 'avg' | 'count' | 'max' | 'min';
  groupField?: string; limit?: number;
  dateDimension?: 'day' | 'week' | 'month' | 'year';
  syncDateRange?: boolean;
  sortOrder?: 'asc' | 'desc' | 'value-desc' | 'value-asc';
  showLegend?: boolean;
  showDataLabels?: boolean;
  colorScheme?: 'default' | 'brand' | 'warm' | 'cool';
}

export interface TableConfig {
  columns?: string[];
  pageSize?: number;
  sortable?: boolean;
  headerBgColor?: string;
  headerTextColor?: string;
  headerFontSize?: number;
  borderColor?: string;
  borderWidth?: number;
  verticalBorderColor?: string;
  verticalBorderWidth?: number;
  horizontalBorderColor?: string;
  horizontalBorderWidth?: number;
  showHeader?: boolean;
  showFooter?: boolean;
  groupBy?: string;
  groupSortField?: string;
  groupSortOrder?: 'asc' | 'desc';
  showGroupSubtotal?: boolean;
  groupAggregation?: 'count' | 'sum' | 'avg' | 'max' | 'min';
  groupAggregationField?: string;
  groupExpandAll?: boolean;
  groupHeaderBgColor?: string;
  groupHeaderTextColor?: string;
  columnWidths?: Record<string, number>;
  groupHeaderConditionalStyles?: {
    condition?: 'contains' | 'starts_with' | 'ends_with' | 'equals';
    text?: string;
    conditions?: { condition: 'contains' | 'starts_with' | 'ends_with' | 'equals'; text: string }[];
    logic?: 'and' | 'or';
    bgColor: string;
    textColor: string;
    rowHeight?: number;
  }[];
  groupHeaderHeight?: number;
  groupHeaderFontSize?: number;
  groupHeaderBadgeBgColor?: string;
  groupHeaderBadgeTextColor?: string;
  groupHeaderBadgeFontSize?: number;
  groupHeaderBadgeLabelColor?: string;
  groupHeaderBadgeValueColor?: string;
  rowHeight?: number;
  // 優先ソート: 指定フィールドの値がこの配列の順に先頭に並ぶ
  prioritySort?: {
    field: string;
    order: string[]; // 優先度の高い順にキーワードを並べる
  };
  excludeKeywords?: string[];
  excludeKeywordField?: string;
}

export interface DBItem {
  id: string; name: string; chassisNumber: string;
  date: string | null; status: string;
  [key: string]: any;
}

export interface AlertRule {
  field: string; operator: 'gt'|'lt'|'gte'|'lte'|'eq';
  value: number; color: string;
  backgroundColor: string; borderColor: string;
}

export interface WidgetComment {
  id: string; userId: string; userName: string;
  text: string; createdAt: string;
}

export interface Annotation {
  id: string;
  x1: number; y1: number; x2: number; y2: number;
  color: string;
  thickness: number;
  arrowStart: boolean;
  arrowEnd: boolean;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  arrowSize: 'small' | 'medium' | 'large';
  arrowShape: 'triangle' | 'sharp' | 'blunt';
  routeType: 'auto' | 'direct' | 'orthogonal' | 'bezier' | 'stairHV' | 'stairVH' | 'stairHVH' | 'stairVHV';
  widgetId?: string;
  text?: string;
  userId?: string;
  userName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GuideLine { type: 'vertical' | 'horizontal'; position: number; }
export interface DistanceLabel { x: number; y: number; distance: number; vertical: boolean; }

export type CacheStore = Record<string, DBItem[]>;

export interface DashboardPage {
  id: string; name: string; layout: Widget[]; annotations?: Annotation[];
  includeInSignage?: boolean;
  published?: boolean; // ★ 追加（デフォルトは true 扱い）
}