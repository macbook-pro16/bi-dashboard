// src/components/DataTable.tsx
'use client';
import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { DBItem, TableConfig, Widget } from '../types';

interface DataTableProps {
  data: DBItem[];
  config?: TableConfig;
  statusOptions?: string[];
  onStatusChange?: (itemId: string, newStatus: string, item: DBItem) => Promise<void> | void;
  widget?: Widget;
  onColumnsReorder?: (columns: string[]) => void;
}

const DEFAULT_GROUP_HEADER_HEIGHT = 48;

const COLUMN_META: Record<string, { label: string; format?: (val: any) => string }> = {
  name: { label: '車両名' },
  chassisNumber: { label: '車体番号' },
  status: { label: 'ステータス' },
  date: { label: '日付' },
  price: { label: '支払総額', format: (val) => `${Math.round(Number(val) / 10000).toLocaleString()}万円` },
  cost: { label: '原価', format: (val) => `${Math.round(Number(val) / 10000).toLocaleString()}万円` },
  vehicleType: { label: '車種' },
  minibus: { label: 'バス' },
};

export default function DataTable({ data, config, statusOptions = [], onStatusChange, widget, onColumnsReorder }: DataTableProps) {
  const rowHeight = config?.rowHeight || 44;
  const groupHeaderHeight = config?.groupHeaderHeight || DEFAULT_GROUP_HEADER_HEIGHT;

  const [sortKey, setSortKey] = useState<keyof DBItem>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [editState, setEditState] = useState<{ id: string; newStatus: string; originalStatus: string } | null>(null);
  const [confirmTimer, setConfirmTimer] = useState<NodeJS.Timeout | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const [orderedColumns, setOrderedColumns] = useState<string[]>([]);
  const [draggedCol, setDraggedCol] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const parentRef = useRef<HTMLDivElement>(null);

  const groupBy = config?.groupBy;
  const groupAggregation = config?.groupAggregation || 'count';
  const groupAggregationField = config?.groupAggregationField;
  const groupExpandAll = config?.groupExpandAll !== false;
  const columnWidths = config?.columnWidths || {};
  const groupHeaderFontSize = config?.groupHeaderFontSize || 14;
  const conditionalStyles = config?.groupHeaderConditionalStyles || [];

  // ★ 除外キーワード
  const excludeKeywords = config?.excludeKeywords || [];
  const excludeKeywordField = config?.excludeKeywordField || groupBy;

  // ★ 修正：複数条件とAND/ORをサポート
  const getGroupHeaderStyle = useCallback((groupKey: string): { bgColor: string; textColor: string } => {
    for (const rule of conditionalStyles) {
      const keyLower = groupKey.toLowerCase();

      if (rule.conditions && rule.conditions.length > 0) {
        const logic = rule.logic || 'or';
        let matches = false;

        if (logic === 'and') {
          matches = rule.conditions.every(cond => {
            const textLower = cond.text.toLowerCase();
            switch (cond.condition) {
              case 'contains': return keyLower.includes(textLower);
              case 'starts_with': return keyLower.startsWith(textLower);
              case 'ends_with': return keyLower.endsWith(textLower);
              case 'equals': return keyLower === textLower;
              default: return false;
            }
          });
        } else {
          matches = rule.conditions.some(cond => {
            const textLower = cond.text.toLowerCase();
            switch (cond.condition) {
              case 'contains': return keyLower.includes(textLower);
              case 'starts_with': return keyLower.startsWith(textLower);
              case 'ends_with': return keyLower.endsWith(textLower);
              case 'equals': return keyLower === textLower;
              default: return false;
            }
          });
        }

        if (matches) {
          return { bgColor: rule.bgColor, textColor: rule.textColor };
        }
      }

      if (rule.condition && rule.text) {
        let matches = false;
        const textLower = rule.text.toLowerCase();
        switch (rule.condition) {
          case 'contains': matches = keyLower.includes(textLower); break;
          case 'starts_with': matches = keyLower.startsWith(textLower); break;
          case 'ends_with': matches = keyLower.endsWith(textLower); break;
          case 'equals': matches = keyLower === textLower; break;
          default: matches = false;
        }
        if (matches) {
          return { bgColor: rule.bgColor, textColor: rule.textColor };
        }
      }
    }

    return {
      bgColor: config?.groupHeaderBgColor || 'rgba(241, 245, 249, 0.9)',
      textColor: config?.groupHeaderTextColor || '#1e293b'
    };
  }, [conditionalStyles, config?.groupHeaderBgColor, config?.groupHeaderTextColor]);

  useEffect(() => {
    if (groupBy && data.length > 0) {
      const groups = new Set(data.map(item => String(item[groupBy] ?? '（未分類）')));
      if (groupExpandAll) {
        setExpandedGroups(new Set(groups));
      } else {
        const first = groups.values().next().value;
        setExpandedGroups(new Set(first ? [first] : []));
      }
    }
  }, [groupBy, data, groupExpandAll]);

  const baseColumns = useMemo(() => {
    if (config?.columns && config.columns.length > 0) {
      return config.columns.filter(key => data.length === 0 || data.some(item => key in item));
    }
    if (data.length === 0) return [];
    return Object.keys(data[0]).filter(k => k !== 'id');
  }, [config?.columns, data]);

  useEffect(() => {
    if (!isInitialized && baseColumns.length > 0) {
      setOrderedColumns(baseColumns);
      setIsInitialized(true);
    }
  }, [baseColumns, isInitialized]);

  useEffect(() => {
    if (!isInitialized || baseColumns.length === 0) return;
    const missing = baseColumns.filter(col => !orderedColumns.includes(col));
    if (missing.length > 0) {
      setOrderedColumns(prev => [...prev, ...missing]);
    }
    const toRemove = orderedColumns.filter(col => !baseColumns.includes(col));
    if (toRemove.length > 0) {
      setOrderedColumns(prev => prev.filter(col => baseColumns.includes(col)));
    }
  }, [baseColumns, orderedColumns, isInitialized]);

  const displayColumns = useMemo(() => {
    return orderedColumns.map(key => ({
      key,
      label: COLUMN_META[key]?.label ?? key,
      format: COLUMN_META[key]?.format
    }));
  }, [orderedColumns]);

  useEffect(() => {
    if (!editState) return;
    const timer = setTimeout(() => { handleConfirm(); }, 3000);
    setConfirmTimer(timer);
    return () => clearTimeout(timer);
  }, [editState]);

  const sorted = useMemo(() =>
    [...data].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(String(bv)) : String(bv).localeCompare(av);
      return typeof av === 'number' && typeof bv === 'number'
        ? (sortDir === 'asc' ? av - bv : bv - av) : 0;
    }),
    [data, sortKey, sortDir]
  );

  const pageSize = config?.pageSize ?? 50;
  const limitedData = sorted.slice(0, pageSize);

  // ★ 除外キーワードフィルタリング（グループ化時のみ適用）
  const filteredData = useMemo(() => {
    if (!groupBy || !excludeKeywords.length || !excludeKeywordField) return limitedData;
    return limitedData.filter(item => {
      const value = String(item[excludeKeywordField] ?? '');
      return !excludeKeywords.some(keyword => value.includes(keyword));
    });
  }, [limitedData, groupBy, excludeKeywords, excludeKeywordField]);

  const groupedData = useMemo(() => {
    if (!groupBy) return null;

    const groups: Record<string, DBItem[]> = {};
    const groupKeys: string[] = [];

    filteredData.forEach(item => {
      const key = String(item[groupBy] ?? '（未分類）');
      if (!groups[key]) {
        groups[key] = [];
        groupKeys.push(key);
      }
      groups[key].push(item);
    });

    groupKeys.sort((a, b) => a.localeCompare(b, 'ja'));

    return { groups, groupKeys };
  }, [filteredData, groupBy]);

  const getGroupAggregation = useCallback((items: DBItem[]): number => {
    if (groupAggregation === 'count') return items.length;
    if (!groupAggregationField) return items.length;

    const values = items
      .map(item => Number(item[groupAggregationField]) || 0)
      .filter(v => !isNaN(v));

    if (values.length === 0) return 0;

    switch (groupAggregation) {
      case 'sum': return values.reduce((a, b) => a + b, 0);
      case 'avg': return values.reduce((a, b) => a + b, 0) / values.length;
      case 'max': return Math.max(...values);
      case 'min': return Math.min(...values);
      default: return items.length;
    }
  }, [groupAggregation, groupAggregationField]);

  const toggleGroup = useCallback((groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key as keyof DBItem); setSortDir('asc'); }
  };

  const handleConfirm = useCallback(() => {
    if (!editState || !onStatusChange) { setEditState(null); return; }
    const item = data.find(d => d.id === editState.id);
    if (item) onStatusChange(editState.id, editState.newStatus, item);
    setEditState(null);
    if (confirmTimer) clearTimeout(confirmTimer);
  }, [editState, onStatusChange, data, confirmTimer]);

  const handleUndo = useCallback(() => {
    setEditState(null);
    if (confirmTimer) clearTimeout(confirmTimer);
  }, [confirmTimer]);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, colKey: string) => {
    setDraggedCol(colKey);
    e.dataTransfer.setData('text/plain', colKey);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, targetColKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!draggedCol || draggedCol === targetColKey) return;

    const oldIdx = orderedColumns.indexOf(draggedCol);
    const newIdx = orderedColumns.indexOf(targetColKey);
    if (oldIdx === -1 || newIdx === -1) return;

    const newCols = [...orderedColumns];
    newCols.splice(oldIdx, 1);
    newCols.splice(newIdx, 0, draggedCol);
    setOrderedColumns(newCols);
  };

  const handleDragEnd = () => {
    setDraggedCol(null);
    if (onColumnsReorder && orderedColumns.length > 0) {
      onColumnsReorder(orderedColumns);
    }
  };

  const showHeader = config?.showHeader !== false;
  const showFooter = config?.showFooter !== false && !groupBy;

  const headerBgColor = widget?.tableConfig?.headerBgColor || 'rgba(248, 250, 252, 0.8)';
  const headerTextColor = widget?.tableConfig?.headerTextColor || '#64748b';
  const headerFontSize = widget?.tableConfig?.headerFontSize || 11;

  const vBorderColor = widget?.tableConfig?.verticalBorderColor || widget?.tableConfig?.borderColor || '#e2e8f0';
  const vBorderWidth = widget?.tableConfig?.verticalBorderWidth ?? widget?.tableConfig?.borderWidth ?? 1;
  const hBorderColor = widget?.tableConfig?.horizontalBorderColor || widget?.tableConfig?.borderColor || '#e2e8f0';
  const hBorderWidth = widget?.tableConfig?.horizontalBorderWidth ?? widget?.tableConfig?.borderWidth ?? 1;

  const getColumnStyle = useCallback((colKey: string): React.CSSProperties => {
    const width = columnWidths[colKey];
    if (width) {
      return { width: `${width}px`, flex: '0 0 auto', minWidth: `${width}px`, maxWidth: `${width}px` };
    }
    return { flex: 1, minWidth: 60 };
  }, [columnWidths]);

  const getGroupColumnStyle = useCallback((colIndex: number, colKey: string): React.CSSProperties => {
    if (colIndex === 0) {
      return { flex: '0 1 auto', minWidth: 120, maxWidth: 'none' };
    }
    return { flex: 1, minWidth: 60 };
  }, []);

  const formatAggregation = useCallback((value: number): string => {
    const field = groupAggregationField;
    const isPrice = field && (field.toLowerCase().includes('price') || field.toLowerCase().includes('cost') || field.includes('価格') || field.includes('原価') || field.includes('金額'));
    if (isPrice && groupAggregation !== 'count') {
      return `${Math.round(value / 10000).toLocaleString()}万円`;
    }
    if (groupAggregation === 'count') return `${value}件`;
    return value.toLocaleString();
  }, [groupAggregationField, groupAggregation]);

  const getAggregationLabel = useCallback((): string => {
    const labels: Record<string, string> = {
      count: '件数',
      sum: '合計',
      avg: '平均',
      max: '最大',
      min: '最小'
    };
    const field = groupAggregationField;
    const fieldLabel = field ? `（${field}）` : '';
    return `${labels[groupAggregation] || '件数'}${fieldLabel}`;
  }, [groupAggregation, groupAggregationField]);

  return (
    <div className="w-full h-full flex flex-col bg-white rounded-inherit overflow-hidden" style={{ fontFamily: '"Futura", "Trebuchet MS", sans-serif' }}>
      {editState && (
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900 text-white text-[11px] shadow-inner z-10 shrink-0">
          <span className="font-medium tracking-wider">
            「{editState.originalStatus}」→「<span className="text-emerald-400 font-bold">{editState.newStatus}</span>」に変更しました（3秒後確定）
          </span>
          <div className="flex gap-3">
            <button onClick={handleUndo} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs font-bold transition-colors">元に戻す</button>
            <button onClick={handleConfirm} className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 rounded text-xs font-bold transition-colors">確定</button>
          </div>
        </div>
      )}

      {showHeader && (
        <div
          className="flex border-b flex-shrink-0 px-0"
          style={{
            backgroundColor: headerBgColor,
            color: headerTextColor,
            fontSize: `${headerFontSize}px`,
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            borderBottomColor: hBorderColor,
            borderBottomWidth: `${hBorderWidth}px`,
            height: `${groupHeaderHeight}px`,
            alignItems: 'center',
          }}
        >
          {displayColumns.map((col, colIndex) => (
            <div
              key={col.key}
              draggable
              onDragStart={(e) => handleDragStart(e, col.key)}
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDragEnd={handleDragEnd}
              onClick={() => toggleSort(col.key)}
              className={`px-3 py-0 cursor-grab hover:opacity-80 transition-opacity select-none truncate flex items-center gap-1 ${
                draggedCol === col.key ? 'opacity-50 bg-slate-200/50 rounded' : ''
              }`}
              style={{
                ...getColumnStyle(col.key),
                height: '100%',
                borderRight: colIndex < displayColumns.length - 1
                  ? `${vBorderWidth}px solid ${vBorderColor}`
                  : 'none',
              }}
              title={`${col.label} (ドラッグで移動)`}
            >
              {col.label}
              {sortKey === col.key && (
                <span style={{ color: headerTextColor, opacity: 0.8 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div ref={parentRef} className="flex-1 overflow-auto custom-scrollbar px-0 pb-0">
        {!groupedData ? (
          (() => {
            let currentTop = 0;
            return limitedData.map((item) => {
              const isEditing = editState?.id === item.id;
              const rowEl = (
                <div
                  key={item.id}
                  className="absolute top-0 left-0 w-full flex items-center text-[12px] font-medium text-slate-700 transition-colors hover:bg-slate-50/80"
                  style={{
                    height: `${rowHeight}px`,
                    top: `${currentTop}px`,
                    borderBottom: `${hBorderWidth}px solid ${hBorderColor}`,
                  }}
                >
                  {displayColumns.map((col, colIndex) => {
                    const rawVal = (item as any)[col.key] ?? '';
                    const displayVal = col.format ? col.format(rawVal) : String(rawVal);
                    if (col.key === 'status' && statusOptions.length > 0) {
                      return (
                        <div
                          key={col.key}
                          className="px-3 flex-1 min-w-0 truncate relative"
                          style={{
                            ...getColumnStyle(col.key),
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            borderRight: colIndex < displayColumns.length - 1
                              ? `${vBorderWidth}px solid ${vBorderColor}`
                              : 'none',
                          }}
                          title={displayVal}
                        >
                          {isEditing ? (
                            <select
                              autoFocus
                              value={editState!.newStatus}
                              onChange={(e) => setEditState(prev => prev ? { ...prev, newStatus: e.target.value } : null)}
                              onBlur={handleConfirm}
                              className="w-[90%] text-[11px] border-2 border-indigo-400 rounded-md bg-white px-2 py-1 outline-none shadow-sm"
                            >
                              {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          ) : (
                            <span
                              onClick={() => setEditState({ id: item.id, newStatus: item.status, originalStatus: item.status })}
                              className="px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider bg-slate-100 text-slate-600 border border-slate-200 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                            >
                              {displayVal}
                            </span>
                          )}
                        </div>
                      );
                    }
                    return (
                      <div
                        key={col.key}
                        className="px-3 truncate"
                        style={{
                          ...getColumnStyle(col.key),
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          borderRight: colIndex < displayColumns.length - 1
                            ? `${vBorderWidth}px solid ${vBorderColor}`
                            : 'none',
                        }}
                        title={displayVal}
                      >
                        {displayVal}
                      </div>
                    );
                  })}
                </div>
              );
              currentTop += rowHeight;
              return rowEl;
            });
          })()
        ) : (
          (() => {
            let currentTop = 0;
            const rows: React.JSX.Element[] = [];

            groupedData.groupKeys.forEach((key) => {
              const items = groupedData.groups[key];
              const isExpanded = expandedGroups.has(key);
              const aggValue = getGroupAggregation(items);
              const aggLabel = getAggregationLabel();
              const { bgColor, textColor } = getGroupHeaderStyle(key);

              rows.push(
                <div
                  key={`group-${key}`}
                  className="absolute top-0 left-0 flex items-center justify-between cursor-pointer transition-all select-none shadow-sm rounded-lg"
                  style={{
                    width: '62.5%',
                    height: `${groupHeaderHeight}px`,
                    top: `${currentTop}px`,
                    background: `linear-gradient(to right, ${bgColor || '#f8fafc'}, ${bgColor || '#eef2ff'})`,
                    border: '1px solid rgba(226, 232, 240, 0.5)',
                    color: textColor,
                    padding: '0 8px',
                  }}
                  onClick={() => toggleGroup(key)}
                >
                  <div
                    className="flex-1 flex items-center gap-2 px-3"
                    style={{
                      fontWeight: 600,
                      fontSize: `${groupHeaderFontSize}px`,
                      overflow: 'visible',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <svg className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <span style={{ overflow: 'visible', whiteSpace: 'nowrap' }} className="font-semibold">
                      {key}
                    </span>
                  </div>

                  {displayColumns.slice(1).map((col) => (
                    <div
                      key={col.key}
                      className="flex-1 flex items-center px-3"
                      style={{
                        fontSize: `${groupHeaderFontSize}px`,
                        color: textColor,
                        overflow: 'visible',
                        whiteSpace: 'nowrap',
                      }}
                    >
                    </div>
                  ))}

                  <div className="flex items-center gap-2 shrink-0 px-3 ml-auto">
                    <span
                      className="px-2 py-0.5 rounded-full font-bold shadow-sm whitespace-nowrap flex items-center gap-1"
                      style={{
                        backgroundColor: config?.groupHeaderBadgeBgColor || '#eef2ff',
                      }}
                    >
                      <span
                        style={{
                          color: config?.groupHeaderBadgeLabelColor || config?.groupHeaderBadgeTextColor || '#4f46e5',
                          fontSize: `${config?.groupHeaderBadgeFontSize || 10}px`,
                        }}
                      >
                        {aggLabel}:
                      </span>
                      <span
                        style={{
                          color: config?.groupHeaderBadgeValueColor || config?.groupHeaderBadgeTextColor || '#4f46e5',
                          fontSize: `${config?.groupHeaderBadgeFontSize || 10}px`,
                          fontWeight: 'bold',
                        }}
                      >
                        {formatAggregation(aggValue)}
                      </span>
                    </span>
                  </div>
                </div>
              );
              currentTop += groupHeaderHeight;

              if (isExpanded) {
                items.forEach((item) => {
                  const isEditing = editState?.id === item.id;
                  rows.push(
                    <div
                      key={item.id}
                      className="absolute top-0 left-0 w-full flex items-center text-[12px] font-medium text-slate-700 transition-colors hover:bg-slate-50/80"
                      style={{
                        height: `${rowHeight}px`,
                        top: `${currentTop}px`,
                        borderBottom: `${hBorderWidth}px solid ${hBorderColor}`,
                        paddingLeft: '28px',
                      }}
                    >
                      {displayColumns.map((col, colIndex) => {
                        const rawVal = (item as any)[col.key] ?? '';
                        const displayVal = col.format ? col.format(rawVal) : String(rawVal);
                        if (col.key === 'status' && statusOptions.length > 0) {
                          return (
                            <div
                              key={col.key}
                              className="px-3 flex-1 min-w-0 truncate relative"
                              style={{
                                ...getColumnStyle(col.key),
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                borderRight: colIndex < displayColumns.length - 1
                                  ? `${vBorderWidth}px solid ${vBorderColor}`
                                  : 'none',
                              }}
                              title={displayVal}
                            >
                              {isEditing ? (
                                <select
                                  autoFocus
                                  value={editState!.newStatus}
                                  onChange={(e) => setEditState(prev => prev ? { ...prev, newStatus: e.target.value } : null)}
                                  onBlur={handleConfirm}
                                  className="w-[90%] text-[11px] border-2 border-indigo-400 rounded-md bg-white px-2 py-1 outline-none shadow-sm"
                                >
                                  {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                              ) : (
                                <span
                                  onClick={() => setEditState({ id: item.id, newStatus: item.status, originalStatus: item.status })}
                                  className="px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider bg-slate-100 text-slate-600 border border-slate-200 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                                >
                                  {displayVal}
                                </span>
                              )}
                            </div>
                          );
                        }
                        return (
                          <div
                            key={col.key}
                            className="px-3 truncate"
                            style={{
                              ...getColumnStyle(col.key),
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              borderRight: colIndex < displayColumns.length - 1
                                ? `${vBorderWidth}px solid ${vBorderColor}`
                                : 'none',
                            }}
                            title={displayVal}
                          >
                            {displayVal}
                          </div>
                        );
                      })}
                    </div>
                  );
                  currentTop += rowHeight;
                });
              }
            });

            return (
              <div style={{ height: `${currentTop}px`, width: '100%', position: 'relative' }}>
                {rows}
              </div>
            );
          })()
        )}
      </div>

      {showFooter && (
        <div
          className="text-right text-[10px] text-slate-400 py-2 px-4 bg-slate-50/50 border-t flex-shrink-0 font-medium tracking-wider uppercase"
          style={{
            borderTopColor: hBorderColor,
            borderTopWidth: `${hBorderWidth}px`,
          }}
        >
          {limitedData.length} / {data.length} RECORDS
        </div>
      )}
    </div>
  );
}