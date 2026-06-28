// src/components/dashboard/LayerRow.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Widget } from '../../types';
import Icons from '../Icons';

interface LayerRowProps {
  widget: Widget;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleLock: (id: string) => void;
  onRename: (id: string, val: string) => void;
  onContextMenu?: (id: string, x: number, y: number) => void;
}

export default function LayerRow({
  widget,
  isSelected,
  onSelect,
  onToggleVisible,
  onToggleLock,
  onRename,
  onContextMenu,
}: LayerRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: widget.id });
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(widget.title);

  useEffect(() => {
    if (!isEditing) setTitle(widget.title);
  }, [widget.title, isEditing]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center px-3 py-2.5 gap-3 text-sm font-medium cursor-pointer rounded-lg transition-colors ${
        isSelected ? 'bg-indigo-50/50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
      }`}
      onClick={() => onSelect(widget.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        if (onContextMenu) onContextMenu(widget.id, e.clientX, e.clientY);
      }}
    >
      <div {...attributes} {...listeners} className="cursor-grab text-slate-400 hover:text-slate-600">
        <svg width="12" height="12" style={{ width: '12px', height: '12px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="9" cy="5" r="1"/>
          <circle cx="9" cy="12" r="1"/>
          <circle cx="9" cy="19" r="1"/>
          <circle cx="15" cy="5" r="1"/>
          <circle cx="15" cy="12" r="1"/>
          <circle cx="15" cy="19" r="1"/>
        </svg>
      </div>
      <div className="flex-1 truncate" onDoubleClick={() => setIsEditing(true)}>
        {isEditing ? (
          <textarea
            autoFocus
            className="w-full bg-white border border-indigo-400 rounded px-2 py-0.5 outline-none text-slate-900 text-sm resize-none"
            style={{ height: `${Math.max(28, title.split('\n').length * 20 + 8)}px` }}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              setIsEditing(false);
              onRename(widget.id, title);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
          />
        ) : (
          <span className="flex items-center gap-2">
            {widget.type === 'group' ? (
              <>
                <Icons.Folder className="w-4 h-4" /> {widget.title?.replace(/\n/g, ' ')}
              </>
            ) : (
              <>{widget.title?.replace(/\n/g, ' ') || widget.type}</>
            )}
          </span>
        )}
      </div>
      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400">
        <button
          className={`hover:text-slate-700 transition-colors ${widget.locked ? 'text-indigo-500' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleLock(widget.id);
          }}
          title={widget.locked ? 'ロック解除' : 'ロック'}
        >
          {widget.locked ? <Icons.Lock className="w-4 h-4"/> : <Icons.Unlock className="w-4 h-4"/>}
        </button>
        <button
          className={`hover:text-slate-700 transition-colors ${widget.hidden ? 'text-slate-300' : 'text-indigo-500'}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisible(widget.id);
          }}
          title={widget.hidden ? '表示する' : '非表示にする'}
        >
          {widget.hidden ? <Icons.EyeOff className="w-4 h-4"/> : <Icons.Eye className="w-4 h-4"/>}
        </button>
      </div>
    </div>
  );
}