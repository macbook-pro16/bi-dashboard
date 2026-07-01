// src/components/dashboard/DashboardPageList.tsx
'use client';

import React, { useState } from 'react';
import { DashboardPage } from '../../types';
import Icons from '../Icons';

interface DashboardPageListProps {
  dashboards: DashboardPage[];
  activePageId: string | null;
  canEdit: boolean;
  onSelect: (pageId: string) => void;
  onAdd: () => void;
  onDelete: (pageId: string) => void;
  onRename: (pageId: string, name: string) => void;
  onToggleSignage: (pageId: string) => void;
  onTogglePublished: (pageId: string) => void;
  collapsed?: boolean;
}

export default function DashboardPageList({
  dashboards,
  activePageId,
  canEdit,
  onSelect,
  onAdd,
  onDelete,
  onRename,
  onToggleSignage,
  onTogglePublished,
  collapsed = false,
}: DashboardPageListProps) {
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // ★ 閲覧者には公開ページだけを見せる
  const visiblePages = canEdit ? dashboards : dashboards.filter(p => p.published !== false);

  const handleDoubleClick = (id: string, name: string) => {
    setEditingPageId(id);
    setEditName(name);
  };

  const handleConfirm = () => {
    if (editingPageId && editName.trim()) {
      onRename(editingPageId, editName.trim());
    }
    setEditingPageId(null);
  };

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 w-full mt-4">
        {visiblePages.map((page, idx) => (
          <button
            key={page.id}
            onClick={() => onSelect(page.id)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold transition-all shadow-sm ${
              page.id === activePageId
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
            }`}
            title={page.name}
          >
            {idx + 1}
          </button>
        ))}
        {canEdit && (
          <button
            onClick={onAdd}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-dashed border-slate-300 transition-colors mt-2"
            title="ページを追加"
          >
            <Icons.Plus className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pages</h3>
        {canEdit && (
          <button
            onClick={onAdd}
            className="text-slate-400 hover:text-indigo-600 transition-colors p-1"
            title="ページを追加"
          >
            <Icons.Plus className="w-4 h-4" />
          </button>
        )}
      </div>
      <ul className="space-y-1">
        {visiblePages.map((page) => (
          <li
            key={page.id}
            className={`flex items-center justify-between group rounded-lg ${
              page.published === false ? 'bg-slate-50/50' : ''
            }`}
          >
            {editingPageId === page.id ? (
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
                onClick={() => onSelect(page.id)}
                onDoubleClick={() => handleDoubleClick(page.id, page.name)}
                className={`text-left text-sm px-4 py-2 rounded-lg w-full transition-all ${
                  page.id === activePageId
                    ? 'bg-indigo-50/80 text-indigo-700 font-semibold shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50'
                } ${page.published === false ? 'italic text-slate-400' : ''}`}
              >
                {page.name}
              </button>
            )}
            <div className="flex items-center gap-1">
              {canEdit && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSignage(page.id);
                    }}
                    title={
                      page.includeInSignage !== false
                        ? 'サイネージに表示中'
                        : 'サイネージから除外'
                    }
                    className={`p-1 rounded transition-colors ${
                      page.includeInSignage !== false ? 'text-indigo-500' : 'text-slate-300'
                    }`}
                  >
                    <Icons.Monitor className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePublished(page.id);
                    }}
                    title={
                      page.published !== false
                        ? '公開中（クリックで非公開）'
                        : '非公開（クリックで公開）'
                    }
                    className={`p-1 rounded transition-colors ${
                      page.published !== false ? 'text-emerald-500' : 'text-slate-300'
                    }`}
                  >
                    {page.published !== false ? (
                      <Icons.Eye className="w-3.5 h-3.5" />
                    ) : (
                      <Icons.EyeOff className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      if (dashboards.length > 1) onDelete(page.id);
                    }}
                    disabled={dashboards.length <= 1}
                    title={
                      dashboards.length <= 1
                        ? '最後のページは削除できません'
                        : 'ページを削除'
                    }
                    className="text-slate-400 hover:text-rose-500 text-sm px-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Icons.X className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
        {visiblePages.length === 0 && (
          <li className="text-xs text-slate-400 text-center py-2">ページがありません</li>
        )}
      </ul>
    </div>
  );
}