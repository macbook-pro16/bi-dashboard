// src/components/KpiWidget.tsx
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { DBItem } from '../types';

interface KpiWidgetProps {
  value: number;
  hideValue?: boolean;
  fontSize: number;
  label: string;
  showTitle: boolean;
  textAlign: 'left' | 'center' | 'right';
  textColor: string;
  conditionalTextRules?: { operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq'; value: number; textColor: string }[];
  conditionalBgRules?: { operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq'; value: number; bgColor: string }[];
  showTrendIcon?: boolean;
  trendTarget?: 'previous' | 'target';
  targetValue?: number;
  previousValue?: number;
  showTodayValue?: boolean;
  colorDelta?: string;
  colorDeltaMinus?: string;
  titleFontSize?: number;
  titleColor?: string;
  titleAlign?: 'left' | 'center' | 'right';
  titleX?: number;
  titleY?: number;
  valueX?: number;
  valueY?: number;
  todayFontSize?: number;
  todayX?: number;
  todayY?: number;
  addedX?: number;
  addedY?: number;
  removedX?: number;
  removedY?: number;
  todayDiff?: {
    added: DBItem[];
    removed: DBItem[];
  };
  todayPopupFields?: string[];
  onDiffFilter?: (ids: string[], label: string) => void;
}

// ★ Notion のファイルプロパティ構造に対応（新JSON文字列形式もパース）
function extractFileUrls(val: any): { url: string; name: string; type?: string }[] {
  if (!val) return [];

  // 新形式: JSON文字列の配列
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed) && parsed[0]?.url) {
        return parsed.map((f: any) => ({
          url: f.url,
          name: f.name || '',
          type: f.type || 'file',
        }));
      }
    } catch {}
    // URLそのものの場合
    if (val.startsWith('http')) return [{ url: val, name: '', type: 'external' }];
    return [];
  }

  // Notion APIのファイルプロパティ: { type: "files", files: [...] }
  if (typeof val === 'object' && val.type === 'files' && Array.isArray(val.files)) {
    return val.files
      .map((f: any) => {
        if (f.type === 'external' && f.external?.url) return { url: f.external.url, name: f.name || '', type: 'external' };
        if (f.type === 'file' && f.file?.url) return { url: f.file.url, name: f.name || '', type: 'file' };
        return null;
      })
      .filter(Boolean) as { url: string; name: string; type?: string }[];
  }

  // 配列で直接ファイルオブジェクトが来る場合（古い形式など）
  if (Array.isArray(val) && val.length > 0 && (val[0].type === 'external' || val[0].type === 'file')) {
    return val
      .map((f: any) => {
        if (f.type === 'external' && f.external?.url) return { url: f.external.url, name: f.name || '', type: 'external' };
        if (f.type === 'file' && f.file?.url) return { url: f.file.url, name: f.name || '', type: 'file' };
        return null;
      })
      .filter(Boolean) as { url: string; name: string; type?: string }[];
  }

  return [];
}

function formatRelationValue(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;

  // ファイルプロパティがある場合は最初の画像URLを返す（表示用）
  const files = extractFileUrls(val);
  if (files.length > 0) {
    // 画像URLがあれば返す（isImageUrlで判定して画像として表示するため）
    return files[0].url || files[0].name;
  }

  if (Array.isArray(val)) {
    return val.map(v => formatRelationValue(v)).join(', ');
  }

  if (typeof val === 'object') {
    if (val.relation && Array.isArray(val.relation)) {
      return val.relation.map((r: any) => r.id || '').filter(Boolean).join(', ');
    }
    if (val.rollup?.type === 'array' && Array.isArray(val.rollup.array)) {
      return val.rollup.array.map((v: any) => formatRelationValue(v)).join(', ');
    }
    if (val.select?.name) return val.select.name;
    if (val.name) return val.name;
    if (val.title) return val.title;
    if (val.id) return val.id;
    return JSON.stringify(val);
  }
  return String(val);
}

function isImageUrl(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  // 拡張子で判定
  if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(str)) return true;
  // 一般的な画像URLパターン
  if (/\/image\//i.test(str) || /\/img\//i.test(str)) return true;
  // Notionの署名付きS3 URL
  if (str.includes('amazonaws.com') || str.includes('secure.notion-static.com') || str.includes('prod-files-secure')) {
    return true; // Notionのファイルは画像の可能性が高い
  }
  return false;
}

function Popup({
  children,
  anchorRect,
  onClose,
  onMouseEnterPopup,
  onMouseLeavePopup,
}: {
  children: React.ReactNode;
  anchorRect: DOMRect | null;
  onClose: () => void;
  onMouseEnterPopup: () => void;
  onMouseLeavePopup: () => void;
}) {
  if (!anchorRect) return null;

  const popupRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!popupRef.current) return;
    const rect = popupRef.current.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let top = anchorRect.top + anchorRect.height + 8;
    let left = anchorRect.left;

    if (left + rect.width > viewportW - 10) {
      left = viewportW - rect.width - 10;
    }
    if (top + rect.height > viewportH - 10) {
      top = anchorRect.top - rect.height - 8;
    }
    if (left < 0) left = 0;
    if (top < 0) top = 0;

    setPos({ top, left });
  }, [anchorRect, children]);

  return createPortal(
    <div
      ref={popupRef}
      className="fixed z-[9999] bg-white border border-slate-100 rounded-2xl shadow-2xl p-5 animate-in fade-in zoom-in-95 duration-200"
      style={{
        top: pos.top,
        left: pos.left,
        boxShadow: '0 20px 40px -8px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)',
        minWidth: '380px',
        maxWidth: '480px',
        maxHeight: '380px',
        overflowY: 'auto',
        pointerEvents: 'auto',
      }}
      onMouseEnter={onMouseEnterPopup}
      onMouseLeave={onMouseLeavePopup}
    >
      {children}
    </div>,
    document.body
  );
}

// ★★★ 修正C: 遅延取得対応の画像コンポーネント ★★★
function NotionImage({
  initialUrl,
  pageId,
  fieldName,
  name,
  isInternal,
}: {
  initialUrl: string;
  pageId?: string;
  fieldName?: string;
  name: string;
  isInternal: boolean;
}) {
  const [src, setSrc] = useState(isInternal ? null : initialUrl);
  const [loading, setLoading] = useState(isInternal);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isInternal || !pageId || !fieldName) return;
    fetch(`/api/notion-file?pageId=${encodeURIComponent(pageId)}&field=${encodeURIComponent(fieldName)}`)
      .then(r => r.json())
      .then(data => {
        if (data.files?.[0]?.url) {
          setSrc(data.files[0].url);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [isInternal, pageId, fieldName]);

  if (loading) {
    return (
      <div className="w-24 h-24 rounded-xl border border-slate-200 bg-slate-100 animate-pulse flex items-center justify-center">
        <span className="text-xs text-slate-400">読込中...</span>
      </div>
    );
  }
  if (error || !src) {
    return (
      <span className="text-sm text-slate-400">ファイルを開けません</span>
    );
  }
  return (
    <img
      src={src}
      alt={name || '画像'}
      className="w-24 h-24 object-cover rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
      loading="lazy"
      onClick={() => window.open(src, '_blank')}
      onError={() => setError(true)}
    />
  );
}

export default function KpiWidget({
  value, hideValue, fontSize, label, showTitle, textAlign, textColor,
  conditionalTextRules, conditionalBgRules, showTrendIcon, trendTarget,
  targetValue, previousValue, showTodayValue, colorDelta, colorDeltaMinus,
  titleFontSize, titleColor, titleAlign, titleX, titleY,
  valueX, valueY, todayFontSize, todayX, todayY,
  addedX, addedY, removedX, removedY,
  todayDiff, todayPopupFields, onDiffFilter,
}: KpiWidgetProps) {
  const [hoveredSection, setHoveredSection] = useState<'added' | 'removed' | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const addedRef = useRef<HTMLDivElement>(null);
  const removedRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPopupHovered = useRef(false);

  const scheduleClose = useCallback(() => {
    closeTimerRef.current = setTimeout(() => {
      if (!isPopupHovered.current) {
        setHoveredSection(null);
      }
    }, 150);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const handleTriggerEnter = (section: 'added' | 'removed') => {
    cancelClose();
    isPopupHovered.current = false;
    setHoveredSection(section);
  };

  const handleTriggerLeave = () => {
    scheduleClose();
  };

  const handlePopupEnter = () => {
    isPopupHovered.current = true;
    cancelClose();
  };

  const handlePopupLeave = () => {
    isPopupHovered.current = false;
    scheduleClose();
  };

  useEffect(() => {
    if (hoveredSection === 'added' && addedRef.current) {
      setAnchorRect(addedRef.current.getBoundingClientRect());
    } else if (hoveredSection === 'removed' && removedRef.current) {
      setAnchorRect(removedRef.current.getBoundingClientRect());
    } else {
      setAnchorRect(null);
    }
  }, [hoveredSection]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const handleDiffClick = (section: 'added' | 'removed') => {
    if (!todayDiff || !onDiffFilter) return;
    let ids: string[] = [];
    let label = '';
    if (section === 'added') {
      ids = todayDiff.added.map(item => item.id);
      label = '本日追加';
    } else if (section === 'removed') {
      ids = todayDiff.removed.map(item => item.id);
      label = '本日減少';
    }
    if (ids.length > 0) {
      onDiffFilter(ids, label);
    }
  };

  let appliedTextColor = textColor;
  if (conditionalTextRules) {
    for (const rule of conditionalTextRules) {
      let match = false;
      if (rule.operator === 'gt') match = value > rule.value;
      else if (rule.operator === 'lt') match = value < rule.value;
      else if (rule.operator === 'gte') match = value >= rule.value;
      else if (rule.operator === 'lte') match = value <= rule.value;
      else if (rule.operator === 'eq') match = value === rule.value;
      if (match) { appliedTextColor = rule.textColor; break; }
    }
  }

  let appliedBgColor: string | undefined;
  if (conditionalBgRules) {
    for (const rule of conditionalBgRules) {
      let match = false;
      if (rule.operator === 'gt') match = value > rule.value;
      else if (rule.operator === 'lt') match = value < rule.value;
      else if (rule.operator === 'gte') match = value >= rule.value;
      else if (rule.operator === 'lte') match = value <= rule.value;
      else if (rule.operator === 'eq') match = value === rule.value;
      if (match) { appliedBgColor = rule.bgColor; break; }
    }
  }

  const trendIcon = showTrendIcon && previousValue !== undefined ? (() => {
    const delta = value - previousValue;
    const percent = previousValue !== 0 ? Math.round((delta / previousValue) * 100) : 0;
    if (delta > 0) return `▲ +${percent}%`;
    if (delta < 0) return `▼ ${percent}%`;
    return '→ 0%';
  })() : undefined;

  const valToday = (() => {
    if (!showTodayValue) return undefined;
    if (todayDiff) return undefined;
    const safePrev = previousValue ?? 0;
    const safeValue = value;
    return safeValue - safePrev;
  })();

  const todayColor = valToday !== undefined
    ? (valToday >= 0 ? (colorDelta || '#06b6d4') : (colorDeltaMinus || '#ef4444'))
    : undefined;

  const mainStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: textAlign === 'center' ? 'center' : textAlign === 'right' ? 'flex-end' : 'flex-start',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    padding: '8px 16px',
    position: 'relative',
    overflow: 'visible',
  };

  if (appliedBgColor) {
    mainStyle.backgroundColor = appliedBgColor;
  }

  const addedPos = {
    x: addedX ?? valueX ?? 0,
    y: addedY ?? valueY ?? 0,
  };
  const removedPos = {
    x: removedX ?? valueX ?? 0,
    y: removedY ?? (valueY !== undefined
      ? valueY + (todayFontSize ? Math.ceil(todayFontSize * 1.2) : 30)
      : (todayFontSize ? Math.ceil(todayFontSize * 1.2) : 30)),
  };

  // ★★★ 修正C: renderFieldValue を fieldName と itemId を受け取るように変更 ★★★
  const renderFieldValue = (rawVal: any, fieldName: string, itemId: string) => {
    const files = extractFileUrls(rawVal);
    if (files.length > 0) {
      return (
        <div className="flex gap-2 flex-wrap">
          {files.map((f, idx) => {
            const isInternal = f.type === 'file';
            if (isImageUrl(f.url) || isInternal) {
              return (
                <NotionImage
                  key={idx}
                  initialUrl={f.url}
                  pageId={isInternal ? itemId : undefined}
                  fieldName={isInternal ? fieldName : undefined}
                  name={f.name}
                  isInternal={isInternal}
                />
              );
            }
            return (
              <span
                key={idx}
                className="text-sm font-medium text-indigo-600 underline cursor-pointer"
                onClick={() => window.open(f.url, '_blank')}
              >
                {f.name || 'ファイルを開く'}
              </span>
            );
          })}
        </div>
      );
    }

    const strVal = formatRelationValue(rawVal);
    if (isImageUrl(strVal)) {
      return (
        <img
          src={strVal}
          alt=""
          className="w-24 h-24 object-cover rounded-xl border border-slate-200 shadow-sm"
          loading="lazy"
        />
      );
    }
    return <span className="text-sm font-semibold text-slate-700 break-all">{strVal || '---'}</span>;
  };

  return (
    <div style={mainStyle}>
      {showTitle && (
        <div
          className="font-medium whitespace-pre-line leading-tight"
          style={{
            fontSize: titleFontSize ? `${titleFontSize}px` : `${Math.max(12, fontSize * 0.18)}px`,
            color: titleColor || '#64748b',
            textAlign: (titleAlign || textAlign) as any,
            transform: (titleX || titleY) ? `translate(${titleX || 0}px, ${titleY || 0}px)` : 'none',
            marginBottom: '4px',
          }}
        >
          {label}
        </div>
      )}

      {!hideValue && (
        <div
          className="font-black tracking-tight leading-none"
          style={{
            fontSize: `${fontSize}px`,
            color: appliedTextColor,
            transform: (valueX || valueY) ? `translate(${valueX || 0}px, ${valueY || 0}px)` : 'none',
          }}
        >
          {value.toLocaleString()}
        </div>
      )}

      {trendIcon && (
        <div
          className="mt-1 text-xs font-semibold"
          style={{ color: trendIcon.startsWith('▲') ? '#10b981' : trendIcon.startsWith('▼') ? '#ef4444' : '#64748b' }}
        >
          {trendIcon}
        </div>
      )}

      {valToday !== undefined && valToday !== 0 && (
        <div
          className="absolute whitespace-nowrap font-bold"
          style={{
            left: 0,
            top: 0,
            transform: `translate(${todayX || 0}px, ${todayY || 0}px)`,
            fontSize: todayFontSize ? `${todayFontSize}px` : `${Math.max(16, fontSize * 0.25)}px`,
            color: todayColor,
            zIndex: 10,
          }}
        >
          {valToday > 0 ? '+' : ''}{valToday}
        </div>
      )}

      {showTodayValue && todayDiff && (todayDiff.added.length > 0 || todayDiff.removed.length > 0) && (
        <div
          className="absolute whitespace-nowrap pointer-events-auto flex flex-col items-start gap-1"
          style={{
            left: 0,
            top: 0,
            transform: `translate(${todayX || 0}px, ${todayY || 0}px)`,
            zIndex: 20,
          }}
        >
          {todayDiff.added.length > 0 && (
            <div
              ref={addedRef}
              className="relative cursor-pointer"
              style={{ transform: `translate(${addedPos.x}px, ${addedPos.y}px)` }}
              onMouseEnter={() => handleTriggerEnter('added')}
              onMouseLeave={handleTriggerLeave}
              onClick={(e) => {
                e.stopPropagation();
                handleDiffClick('added');
              }}
            >
              <span
                className="font-bold leading-none"
                style={{
                  fontSize: todayFontSize ? `${todayFontSize}px` : `${Math.max(16, fontSize * 0.25)}px`,
                  color: colorDelta || '#06b6d4',
                }}
              >
                +{todayDiff.added.length}
              </span>
            </div>
          )}

          {todayDiff.removed.length > 0 && (
            <div
              ref={removedRef}
              className="relative cursor-pointer"
              style={{ transform: `translate(${removedPos.x}px, ${removedPos.y}px)` }}
              onMouseEnter={() => handleTriggerEnter('removed')}
              onMouseLeave={handleTriggerLeave}
              onClick={(e) => {
                e.stopPropagation();
                handleDiffClick('removed');
              }}
            >
              <span
                className="font-bold leading-none"
                style={{
                  fontSize: todayFontSize ? `${todayFontSize}px` : `${Math.max(16, fontSize * 0.25)}px`,
                  color: '#ef4444',
                }}
              >
                -{todayDiff.removed.length}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ★★★ 修正C: renderFieldValue の呼び出しで fieldName と item.id を渡す ★★★ */}
      {hoveredSection === 'added' && anchorRect && (
        <Popup
          anchorRect={anchorRect}
          onClose={() => setHoveredSection(null)}
          onMouseEnterPopup={handlePopupEnter}
          onMouseLeavePopup={handlePopupLeave}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <p className="text-lg font-bold text-slate-500">
              本日追加 <span className="text-blue-600">{todayDiff!.added.length}</span> 件
            </p>
          </div>
          <div className="space-y-3">
            {todayDiff!.added.map(item => (
              <div key={item.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                {todayPopupFields && todayPopupFields.length > 0 ? (
                  <div className="space-y-3">
                    {todayPopupFields.map(field => (
                      <div key={field} className="flex items-start gap-3">
                        <span className="text-sm font-medium text-slate-400 w-24 shrink-0 pt-0.5">{field}</span>
                        {renderFieldValue(item[field], field, item.id)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <p className="text-base font-semibold text-slate-800 truncate">{item.name || '名称なし'}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-sm px-3 py-1 rounded-full bg-blue-50 text-blue-600 font-medium">
                        {item.status || '---'}
                      </span>
                      {item.date && (
                        <span className="text-sm text-slate-400">{item.date}</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </Popup>
      )}

      {hoveredSection === 'removed' && anchorRect && (
        <Popup
          anchorRect={anchorRect}
          onClose={() => setHoveredSection(null)}
          onMouseEnterPopup={handlePopupEnter}
          onMouseLeavePopup={handlePopupLeave}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </div>
            <p className="text-lg font-bold text-slate-500">
              本日減少 <span className="text-red-600">{todayDiff!.removed.length}</span> 件
            </p>
          </div>
          <div className="space-y-3">
            {todayDiff!.removed.map(item => (
              <div key={item.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                {todayPopupFields && todayPopupFields.length > 0 ? (
                  <div className="space-y-3">
                    {todayPopupFields.map(field => (
                      <div key={field} className="flex items-start gap-3">
                        <span className="text-sm font-medium text-slate-400 w-24 shrink-0 pt-0.5">{field}</span>
                        {renderFieldValue(item[field], field, item.id)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <p className="text-base font-semibold text-slate-800 truncate">{item.name || '名称なし'}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-sm px-3 py-1 rounded-full bg-red-50 text-red-600 font-medium">
                        {item.status || '---'}
                      </span>
                      {item.date && (
                        <span className="text-sm text-slate-400">{item.date}</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </Popup>
      )}
    </div>
  );
}