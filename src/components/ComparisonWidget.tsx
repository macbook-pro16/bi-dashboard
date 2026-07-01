// src/components/ComparisonWidget.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface DBItemLike {
  id: string;
  name?: string;
  status?: string;
  date?: string | null;
  [key: string]: any;
}

interface ComparisonWidgetProps {
  label: string;
  showTitle?: boolean;
  titleColor?: string;
  titleFontSize?: number;
  titleX?: number;
  titleY?: number;
  fontSize?: number;
  textColor?: string;
  bgColor?: string;
  bgAlpha?: number;
  actual: number;
  target: number;
  actualLabel?: string;
  targetLabel?: string;
  onlyInActual?: DBItemLike[];
  onlyInTarget?: DBItemLike[];
  diffPopupFields?: string[];
}

// アイコンコンポーネント
const EqualIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="9" x2="19" y2="9"></line>
    <line x1="5" y1="15" x2="19" y2="15"></line>
  </svg>
);

const GreaterIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"></polyline>
  </svg>
);

const LessIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"></polyline>
  </svg>
);

const CheckIcon = () => (
  <svg width="1.2em" height="1.2em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const AlertIcon = () => (
  <svg width="1.2em" height="1.2em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);

// KpiWidget.tsxから移植したPopupコンポーネント
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

export default function ComparisonWidget({
  label,
  showTitle = true,
  titleColor = '#64748b',
  titleFontSize = 14,
  titleX = 0,
  titleY = 0,
  fontSize = 48,
  textColor = '#1e293b',
  bgColor = '#ffffff',
  bgAlpha = 1,
  actual,
  target,
  actualLabel = '実績',
  targetLabel = '比較対象',
  onlyInActual,
  onlyInTarget,
  diffPopupFields,
}: ComparisonWidgetProps) {
  const diff = actual - target;
  const isEqual = diff === 0;
  const isGreater = diff > 0;

  const [hoveredSection, setHoveredSection] = useState<'actual' | 'target' | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPopupHovered = useRef(false);

  const hasDiffData = (onlyInActual && onlyInActual.length > 0) || (onlyInTarget && onlyInTarget.length > 0);

  const scheduleClose = () => {
    closeTimerRef.current = setTimeout(() => {
      if (!isPopupHovered.current) setHoveredSection(null);
    }, 150);
  };
  const cancelClose = () => {
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
  };
  const handleBadgeEnter = () => {
    if (!hasDiffData) return;
    cancelClose();
    isPopupHovered.current = false;
    if (badgeRef.current) setAnchorRect(badgeRef.current.getBoundingClientRect());
    setHoveredSection('actual');
  };
  const handleBadgeLeave = () => scheduleClose();
  const handlePopupEnter = () => { isPopupHovered.current = true; cancelClose(); };
  const handlePopupLeave = () => { isPopupHovered.current = false; scheduleClose(); };

  useEffect(() => {
    return () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); };
  }, []);

  const renderDiffItem = (item: DBItemLike) => (
    <div key={item.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
      {diffPopupFields && diffPopupFields.length > 0 ? (
        <div className="space-y-3">
          {diffPopupFields.map(field => (
            <div key={field} className="flex items-start gap-3">
              <span className="text-sm font-medium text-slate-400 w-24 shrink-0 pt-0.5">{field}</span>
              <span className="text-sm font-semibold text-slate-700 break-all">
                {String(item[field] ?? '---')}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <>
          <p className="text-base font-semibold text-slate-800 truncate">{item.name || '名称なし'}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-sm px-3 py-1 rounded-full bg-rose-50 text-rose-600 font-medium">
              {item.status || '---'}
            </span>
            {item.date && <span className="text-sm text-slate-400">{item.date}</span>}
          </div>
        </>
      )}
    </div>
  );

  // 背景色の透過対応
  const bg = bgColor.startsWith('#')
    ? `rgba(${parseInt(bgColor.slice(1, 3), 16)}, ${parseInt(bgColor.slice(3, 5), 16)}, ${parseInt(bgColor.slice(5, 7), 16)}, ${bgAlpha})`
    : bgColor;

  // 判定に応じたステータスUIの設定
  let statusConfig;
  if (isEqual) {
    statusConfig = {
      operatorIcon: <EqualIcon />,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-500',
      badgeBg: 'bg-emerald-50 border border-emerald-200',
      badgeColor: 'text-emerald-700',
      statusIcon: <CheckIcon />,
      statusText: '一致 (OK)',
    };
  } else {
    statusConfig = {
      operatorIcon: isGreater ? <GreaterIcon /> : <LessIcon />,
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-500',
      badgeBg: 'bg-rose-50 border border-rose-200',
      badgeColor: 'text-rose-700',
      statusIcon: <AlertIcon />,
      statusText: `ズレあり (${isGreater ? '+' : ''}${diff.toLocaleString()})${hasDiffData ? ' ・詳細を見る' : ''}`,
    };
  }

  return (
    <div
      className="w-full h-full flex flex-col p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden"
      style={{ backgroundColor: bg, fontFamily: '"Inter", "Noto Sans JP", sans-serif' }}
    >
      {/* ウィジェットタイトル */}
      {showTitle && label && (
        <div
          className="font-bold whitespace-pre-line leading-tight truncate shrink-0 text-center mb-2"
          style={{
            fontSize: `${titleFontSize}px`,
            color: titleColor,
            transform: `translate(${titleX}px, ${titleY}px)`,
          }}
        >
          {label}
        </div>
      )}

      {/* メインコンテンツ: 同列比較 */}
      <div className="flex-1 flex flex-col items-center justify-center w-full gap-6">
        
        <div className="flex items-center justify-between w-full px-2 gap-2">
          
          {/* A (Actual) */}
          <div className="flex flex-col items-center min-w-0 flex-1">
            <span className="text-xs font-semibold text-slate-400 mb-1.5 truncate w-full text-center">
              {actualLabel}
            </span>
            <span 
              className="font-black tracking-tight truncate w-full text-center" 
              style={{ fontSize: `${fontSize}px`, color: textColor }}
            >
              {actual.toLocaleString()}
            </span>
          </div>

          {/* 演算子アイコン */}
          <div className={`flex items-center justify-center w-12 h-12 rounded-full shrink-0 text-2xl ${statusConfig.iconBg} ${statusConfig.iconColor}`}>
            {statusConfig.operatorIcon}
          </div>

          {/* B (Target) */}
          <div className="flex flex-col items-center min-w-0 flex-1">
            <span className="text-xs font-semibold text-slate-400 mb-1.5 truncate w-full text-center">
              {targetLabel}
            </span>
            <span 
              className="font-black tracking-tight truncate w-full text-center" 
              style={{ fontSize: `${fontSize}px`, color: textColor }}
            >
              {target.toLocaleString()}
            </span>
          </div>

        </div>

        {/* 判定バッジ */}
        <div
          ref={badgeRef}
          onMouseEnter={handleBadgeEnter}
          onMouseLeave={handleBadgeLeave}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm shadow-sm ${statusConfig.badgeBg} ${statusConfig.badgeColor} ${hasDiffData ? 'cursor-pointer' : ''}`}
        >
          {statusConfig.statusIcon}
          <span>{statusConfig.statusText}</span>
        </div>

      </div>

      {hoveredSection && anchorRect && hasDiffData && (
        <Popup
          anchorRect={anchorRect}
          onClose={() => setHoveredSection(null)}
          onMouseEnterPopup={handlePopupEnter}
          onMouseLeavePopup={handlePopupLeave}
        >
          {onlyInActual && onlyInActual.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <p className="text-lg font-bold text-slate-500">
                  {actualLabel}側にのみ存在 <span className="text-blue-600">{onlyInActual.length}</span> 件
                </p>
              </div>
              <div className="space-y-3">
                {onlyInActual.map(renderDiffItem)}
              </div>
            </div>
          )}
          {onlyInTarget && onlyInTarget.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </div>
                <p className="text-lg font-bold text-slate-500">
                  {targetLabel}側にのみ存在 <span className="text-red-600">{onlyInTarget.length}</span> 件
                </p>
              </div>
              <div className="space-y-3">
                {onlyInTarget.map(renderDiffItem)}
              </div>
            </div>
          )}
        </Popup>
      )}
    </div>
  );
}