// src/components/dashboard/DashboardPageList.tsx
'use client';

import React, { useState } from 'react';
import { DashboardPage } from '../../types';
import Icons from '../Icons';

interface DashboardPageListProps {
  dashboards: DashboardPage[];
  activeIndex: number;
  onSelect: (idx: number) => void;
  onAdd: () => void;
  onDelete: (idx: number) => void;
  onRename: (idx: number, name: string) => void;
  onToggleSignage: (idx: number) => void;
  collapsed?: boolean;
}

export default function DashboardPageList({
  dashboards,
  activeIndex,
  onSelect,
  onAdd,
  onDelete,
  onRename,
  onToggleSignage,
  collapsed = false,
}: DashboardPageListProps) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const handleDoubleClick = (idx: number, name: string) => {
    setEditingIdx(idx);
    setEditName(name);
  };

  const handleConfirm = () => {
    if (editingIdx !== null && editName.trim()) {
      onRename(editingIdx, editName.trim());
    }
    setEditingIdx(null);
  };

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 w-full mt-4">
        {dashboards.map((page, idx) => (
          <button
            key={page.id}
            onClick={() => onSelect(idx)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold transition-all shadow-sm ${
              idx === activeIndex
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
            }`}
            title={page.name}
          >
            {idx + 1}
          </button>
        ))}
        <button
          onClick={onAdd}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-dashed border-slate-300 transition-colors mt-2"
          title="ページを追加"
        >
          <Icons.Plus className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pages</h3>
        <button
          onClick={onAdd}
          className="text-slate-400 hover:text-indigo-600 transition-colors p-1"
          title="ページを追加"
        >
          <Icons.Plus className="w-4 h-4" />
        </button>
      </div>
      <ul className="space-y-1">
        {dashboards.map((page, idx) => (
          <li key={page.id} className="flex items-center justify-between group">
            {editingIdx === idx ? (
              <input
                autoFocus
                className="text-sm bg-white border border-indigo-400 rounded-md px-3 py-1.5 w-full mr-2 outline-none text-slate-900 shadow-sm"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleConfirm}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirm();
                }}
              />
            ) : (
              <button
                onClick={() => onSelect(idx)}
                onDoubleClick={() => handleDoubleClick(idx, page.name)}
                className={`text-left text-sm px-4 py-2 rounded-lg w-full transition-all ${
                  idx === activeIndex
                    ? 'bg-indigo-50/80 text-indigo-700 font-semibold shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {page.name}
              </button>
            )}
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSignage(idx);
                }}
                title={page.includeInSignage !== false ? 'サイネージに表示中' : 'サイネージから除外'}
                className={`p-1 rounded transition-colors ${
                  page.includeInSignage !== false ? 'text-indigo-500' : 'text-slate-300'
                }`}
              >
                <Icons.Monitor className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  if (dashboards.length > 1) onDelete(idx);
                }}
                disabled={dashboards.length <= 1}
                title={dashboards.length <= 1 ? '最後のページは削除できません' : 'ページを削除'}
                className={`text-slate-400 hover:text-rose-500 text-sm px-2 transition-colors ${
                  dashboards.length <= 1
                    ? 'opacity-30 cursor-not-allowed'
                    : 'opacity-0 group-hover:opacity-100'
                }`}
              >
                <Icons.X className="w-4 h-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}