// src/components/TableWidget.tsx
'use client';
import React from 'react';
import DataTable from './DataTable';
import { DBItem, TableConfig, Widget } from '../types';

interface TableWidgetProps {
  data: DBItem[];
  config?: TableConfig;
  statusOptions?: string[];
  onStatusChange?: (itemId: string, newStatus: string, item: DBItem) => void;
  widget: Widget;
  bgColor?: string;
  bgAlpha?: number;
  // ★ 追加：列順序変更時のコールバック
  onColumnsReorder?: (columns: string[]) => void;
}

const TableWidget = React.memo(function TableWidget({ data, config, statusOptions, onStatusChange, widget, onColumnsReorder }: TableWidgetProps) {  const bg = bgColor || '#ffffff';
  const alpha = bgAlpha ?? 1;
  const rgbaBg = bg.startsWith('#')
    ? `rgba(${parseInt(bg.slice(1, 3), 16)}, ${parseInt(bg.slice(3, 5), 16)}, ${parseInt(bg.slice(5, 7), 16)}, ${alpha})`
    : bg;

  return (
    <div className="w-full h-full flex flex-col pt-3 rounded-inherit" style={{ backgroundColor: rgbaBg, fontFamily: '"Futura", "Trebuchet MS", sans-serif' }}></div>
  const { dataConfig, title, showTitle, textColor } = widget;
  
  const titleX = dataConfig?.titleX || 0;
  const titleY = dataConfig?.titleY || 0;
  const titleAlign = dataConfig?.titleAlign || 'left';
  const titleFontSize = dataConfig?.titleFontSize || 14;
  const titleColor = dataConfig?.titleColor || textColor || '#475569';

  return (
    <div className="w-full h-full flex flex-col pt-3 bg-white rounded-inherit" style={{ fontFamily: '"Futura", "Trebuchet MS", sans-serif' }}>
      {showTitle && title && (
        <div 
          className="font-bold tracking-widest uppercase mb-2 px-4 opacity-80 shrink-0" 
          style={{ 
            color: titleColor, fontSize: `${titleFontSize}px`, textAlign: titleAlign,
            transform: `translate(${titleX}px, ${titleY}px)`, position: (titleX || titleY) ? 'relative' : 'static', zIndex: 10,
            whiteSpace: 'pre', overflow: 'visible',
            alignSelf: titleAlign === 'center' ? 'center' : titleAlign === 'right' ? 'flex-end' : 'flex-start',
          }}
        >
          {title}
        </div>
      )}
      <div className="flex-1 w-full min-h-0 relative z-0">
        <DataTable
          data={data}
          config={config}
          statusOptions={statusOptions}
          onStatusChange={onStatusChange}
          widget={widget}
          onColumnsReorder={onColumnsReorder}
        />
      </div>
    </div>
  );
});

export default TableWidget;