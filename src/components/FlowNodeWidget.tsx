// ./src/components/FlowNodeWidget.tsx
'use client';
import React from 'react';

interface FlowNodeWidgetProps {
  statusTarget: string;       // 後方互換のため保持
  filterField?: string;       // [DIM-5] フィルターに使われているフィールド名（表示用）
  count: number;
  fontSize: number;
}

const FlowNodeWidget = React.memo(function FlowNodeWidget({ statusTarget, filterField, count, fontSize }: FlowNodeWidgetProps) {
  // [DIM-5] フィールドが標準の 'status' 以外なら、小さくフィールド名を表示
  const showFieldName = filterField && filterField !== 'status';

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <span className="text-xs font-bold opacity-60">{statusTarget}</span>
      {showFieldName && (
        <span className="text-[9px] font-medium opacity-40 -mt-0.5">({filterField})</span>
      )}
      <span style={{ fontSize: `${fontSize}px`, fontWeight: 900 }}>{count}</span>
    </div>
  );
});

export default FlowNodeWidget;