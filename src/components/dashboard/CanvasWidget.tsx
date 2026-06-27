// src/components/dashboard/CanvasWidget.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Widget } from '../../types';
import Icons from '../Icons';
import WidgetErrorBoundary from '../WidgetErrorBoundary';

interface CanvasWidgetProps {
  widget: Widget;
  isEditMode: boolean;
  isSelected: boolean;
  zoom: number;
  zIndex: number;
  onSelect: (id: string) => void;
  onSelectToggle: (id: string) => void;
  onResizeEnd: (id: string, newW: number, newH: number) => void;
  onChangeSize: (id: string, newW: number, newH: number) => void;
  onMove?: (id: string, dx: number, dy: number) => void;
  onClickFlowNode?: (status: string) => void;
  onRename?: (id: string, title: string) => void;
  onContextMenu?: (id: string, x: number, y: number) => void;
  onDoubleClick?: (id: string) => void;
  computedValue?: number;
  children?: React.ReactNode;
  isSignageMode?: boolean;
  selectedCount: number;
}

export const CanvasWidget = React.memo(function CanvasWidget({
  widget,
  isEditMode,
  isSelected,
  zoom,
  zIndex,
  onSelect,
  onSelectToggle,
  onResizeEnd,
  onChangeSize,
  onMove,
  onClickFlowNode,
  onRename,
  onContextMenu,
  onDoubleClick,
  computedValue,
  children,
  isSignageMode,
  selectedCount,
}: CanvasWidgetProps) {
  const disabled = isSignageMode || !isEditMode || widget.locked;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: widget.id,
    disabled,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(widget.title);
  useEffect(() => {
    if (!isEditing) setEditTitle(widget.title);
  }, [widget.title, isEditing]);

  const handleEditConfirm = () => {
    setIsEditing(false);
    if (onRename && editTitle !== widget.title) onRename(widget.id, editTitle);
  };

  const handleResizeStart = (e: React.PointerEvent) => {
    if (isSignageMode || widget.locked) return;
    e.preventDefault();
    e.stopPropagation();
    const sx = e.clientX,
      sy = e.clientY,
      sw = widget.w,
      sh = widget.h;
    let lw = sw,
      lh = sh;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / zoom,
        dy = (ev.clientY - sy) / zoom;
      lw = Math.max(20, Math.round((sw + dx) / 10) * 10);
      lh = Math.max(20, Math.round((sh + dy) / 10) * 10);
      if (widget.shape === 'circle') {
        lw = lh = Math.max(lw, lh);
      }
      onChangeSize(widget.id, lw, lh);
    };
    const up = () => {
      onResizeEnd(widget.id, lw, lh);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const handleResizeRight = (e: React.PointerEvent) => {
    if (isSignageMode || widget.locked) return;
    e.preventDefault();
    e.stopPropagation();
    const sx = e.clientX,
      sw = widget.w;
    let lw = sw;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / zoom;
      lw = Math.max(20, Math.round((sw + dx) / 10) * 10);
      onChangeSize(widget.id, lw, widget.h);
    };
    const up = () => {
      onResizeEnd(widget.id, lw, widget.h);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const handleResizeBottom = (e: React.PointerEvent) => {
    if (isSignageMode || widget.locked) return;
    e.preventDefault();
    e.stopPropagation();
    const sy = e.clientY,
      sh = widget.h;
    let lh = sh;
    const move = (ev: PointerEvent) => {
      const dy = (ev.clientY - sy) / zoom;
      lh = Math.max(20, Math.round((sh + dy) / 10) * 10);
      onChangeSize(widget.id, widget.w, lh);
    };
    const up = () => {
      onResizeEnd(widget.id, widget.w, lh);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const handleResizeLeft = (e: React.PointerEvent) => {
    if (isSignageMode || widget.locked) return;
    e.preventDefault();
    e.stopPropagation();
    const sx = e.clientX,
      sw = widget.w;
    let nw = sw,
      dx = 0;
    const move = (ev: PointerEvent) => {
      dx = (ev.clientX - sx) / zoom;
      nw = Math.max(20, sw - dx);
      if (nw >= 20) {
        onChangeSize(widget.id, nw, widget.h);
        if (onMove) onMove(widget.id, -dx, 0);
      }
    };
    const up = () => {
      onResizeEnd(widget.id, nw, widget.h);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const handleResizeTop = (e: React.PointerEvent) => {
    if (isSignageMode || widget.locked) return;
    e.preventDefault();
    e.stopPropagation();
    const sy = e.clientY,
      sh = widget.h;
    let nh = sh,
      dy = 0;
    const move = (ev: PointerEvent) => {
      dy = (ev.clientY - sy) / zoom;
      nh = Math.max(20, sh - dy);
      if (nh >= 20) {
        onChangeSize(widget.id, widget.w, nh);
        if (onMove) onMove(widget.id, 0, -dy);
      }
    };
    const up = () => {
      onResizeEnd(widget.id, widget.w, nh);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  let br = '0px';
  switch (widget.shape) {
    case 'rounded':
      br = '16px';
      break;
    case 'pill':
      br = '9999px';
      break;
    case 'circle':
      br = '50%';
      break;
  }

  const alertStyle = useMemo(() => {
    if (!widget.alertRules?.[0]) return {};
    const r = widget.alertRules[0];
    const v = computedValue ?? NaN;
    if (isNaN(v)) return {};
    const trig =
      (r.operator === 'gt' && v > r.value) ||
      (r.operator === 'lt' && v < r.value) ||
      (r.operator === 'gte' && v >= r.value) ||
      (r.operator === 'lte' && v <= r.value) ||
      (r.operator === 'eq' && v === r.value);
    return trig
      ? {
          backgroundColor: r.backgroundColor,
          color: r.color,
          borderColor: r.borderColor,
        }
      : {};
  }, [widget.alertRules, computedValue]);

  const bgAlpha = widget.bgAlpha ?? 1;
  const bgColor = widget.bgColor;
  const rgbaBg = bgColor.startsWith('#')
    ? `rgba(${parseInt(bgColor.slice(1, 3), 16)},${parseInt(bgColor.slice(3, 5), 16)},${parseInt(bgColor.slice(5, 7), 16)},${bgAlpha})`
    : bgColor;

  const style: React.CSSProperties = {
    position: 'absolute',
    left: widget.x,
    top: widget.y,
    width: widget.w,
    height: widget.h,
    zIndex: isDragging ? 999 : isSelected ? zIndex + 100 : zIndex,
    opacity: isDragging ? 0.9 : widget.hidden ? 0.2 : 1,
    backgroundColor:
      alertStyle.backgroundColor || (widget.type === 'group' ? 'transparent' : rgbaBg),
    color: alertStyle.color || widget.textColor,
    border:
      widget.shape !== 'text-only'
        ? `${widget.borderWidth}px solid ${alertStyle.borderColor || widget.borderColor}`
        : 'none',
    borderRadius: br,
    boxShadow:
      widget.hasShadow && widget.shape !== 'text-only'
        ? '0 4px 12px -2px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.02)'
        : 'none',
    fontFamily:
      widget.fontFamily === 'serif'
        ? 'serif'
        : widget.fontFamily === 'mono'
          ? 'monospace'
          : 'Inter, Noto Sans JP, sans-serif',
    pointerEvents: widget.hidden && !isEditMode ? 'none' : 'auto',
    overflow: 'visible',
    willChange: 'transform',
    cursor: isEditMode && !disabled ? 'default' : 'default',
    transition: isDragging ? 'none' : 'all 0.2s ease',
    transformOrigin: 'center center',
  };

  const draggingClass = isDragging ? 'scale-[1.02] shadow-2xl' : '';

  const lockedOverlay =
    isEditMode && widget.locked ? (
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, #94a3b8 0, #94a3b8 1px, transparent 0, transparent 50%)',
          backgroundSize: '8px 8px',
          borderRadius: br,
        }}
      />
    ) : null;

  const showTitleBar = isEditMode && !widget.locked && !isSignageMode;
  const titleBarOpacity = isSelected ? 'opacity-80' : 'opacity-0 group-hover:opacity-40';

  const dragHandleRef = setNodeRef;

  return (
    <div
      style={style}
      onPointerDown={(e) => {
        if (isSignageMode) return;
        if (isEditMode) {
          if (e.target instanceof Element && !e.target.closest('.drag-handle-area')) {
            if (e.button === 2 && isSelected && selectedCount > 1) {
              return;
            }
            if (e.shiftKey) {
              onSelectToggle(widget.id);
            } else {
              onSelect(widget.id);
            }
          }
        }
      }}
      onContextMenu={(e) => {
        if (isSignageMode) return;
        if (onContextMenu) {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu(widget.id, e.clientX, e.clientY);
        }
      }}
      className={`relative flex flex-col transition-all duration-200 group ${
        isEditMode && isSelected
          ? 'ring-[3px] ring-blue-500 ring-offset-2 drop-shadow-lg'
          : ''
      } ${draggingClass}`}
    >
      {showTitleBar && (
        <div
          ref={dragHandleRef}
          {...(disabled ? {} : listeners)}
          {...(disabled ? {} : attributes)}
          className={`drag-handle-area absolute top-0 left-0 right-0 h-8 z-10 flex items-center justify-center transition-opacity duration-150 rounded-t ${titleBarOpacity}`}
          style={{
            backgroundColor: 'rgba(0,0,0,0.05)',
            backdropFilter: 'blur(4px)',
            cursor: disabled ? 'default' : 'grab',
          }}
        >
          <div className="flex items-center gap-2">
            <div className="drag-handle-dots cursor-grab" onPointerDown={(e) => e.stopPropagation()}>
              <div className="flex gap-0.5">
                <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
              </div>
            </div>
            <span
              className="text-xs font-medium text-slate-600 select-none"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
            >
              {isEditing ? (
                <textarea
                  autoFocus
                  className="bg-white border border-indigo-400 rounded px-1 outline-none text-xs font-medium resize-none overflow-hidden"
                  style={{
                    minWidth: '100px',
                    height: `${Math.max(24, editTitle.split('\n').length * 16 + 8)}px`,
                  }}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={handleEditConfirm}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleEditConfirm();
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className="whitespace-pre-wrap"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(true);
                  }}
                >
                  {widget.title}
                </span>
              )}
            </span>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden flex flex-col" style={{ justifyContent: 'center' }}>
        <WidgetErrorBoundary>{children}</WidgetErrorBoundary>
      </div>

      {isEditMode && isSelected && !isDragging && !widget.locked && !isSignageMode && (
        <>
          {widget.shape !== 'circle' && (
            <>
              <div
                onPointerDown={handleResizeStart}
                className="absolute -bottom-2 -right-2 w-3 h-3 bg-indigo-600 border-2 border-white rounded-full shadow-sm cursor-se-resize z-50 hover:scale-125 transition-transform"
              />
              <div
                onPointerDown={handleResizeRight}
                className="absolute -right-2 top-1/2 -translate-y-1/2 w-3 h-3 bg-indigo-600 border-2 border-white rounded-full shadow-sm cursor-e-resize z-50 hover:scale-125 transition-transform"
              />
              <div
                onPointerDown={handleResizeBottom}
                className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-3 h-3 bg-indigo-600 border-2 border-white rounded-full shadow-sm cursor-s-resize z-50 hover:scale-125 transition-transform"
              />
              <div
                onPointerDown={handleResizeLeft}
                className="absolute -left-2 top-1/2 -translate-y-1/2 w-3 h-3 bg-indigo-600 border-2 border-white rounded-full shadow-sm cursor-w-resize z-50 hover:scale-125 transition-transform"
              />
              <div
                onPointerDown={handleResizeTop}
                className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-indigo-600 border-2 border-white rounded-full shadow-sm cursor-n-resize z-50 hover:scale-125 transition-transform"
              />
            </>
          )}
          {widget.shape === 'circle' && (
            <div
              onPointerDown={handleResizeStart}
              className="absolute -bottom-2 -right-2 w-3 h-3 bg-indigo-600 border-2 border-white rounded-full shadow-sm cursor-se-resize z-50 hover:scale-125 transition-transform"
            />
          )}
        </>
      )}

      {lockedOverlay}
    </div>
  );
});

export default CanvasWidget;