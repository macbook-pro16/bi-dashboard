// src/components/dashboard/DashboardPageList.tsx
'use client';

import React, { useState, useCallback } from 'react';
import { DashboardPage } from '../../types';
import Icons from '../Icons';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface DashboardPageListProps {
  publishedPages: DashboardPage[];
  unpublishedPages: DashboardPage[];
  activePageId: string | null;
  canEdit: boolean;
  onSelect: (pageId: string) => void;
  onAdd: () => void;
  onDelete: (pageId: string) => void;
  onRename: (pageId: string, name: string) => void;
  onToggleSignage: (pageId: string) => void;
  onTogglePublished: (pageId: string) => void;
  onReorder: (reorderedPublished: DashboardPage[], reorderedUnpublished: DashboardPage[]) => void;
  collapsed?: boolean;
}

function SortablePageItem({
  page,
  isActive,
  isUnpublished,
  onSelect,
  onDoubleClick,
  onToggleSignage,
  onTogglePublished,
  onDelete,
  isEditing,
  editName,
  onEditChange,
  onEditConfirm,
  onEditKeyDown,
  canDelete,
}: {
  page: DashboardPage;
  isActive: boolean;
  isUnpublished: boolean;
  onSelect: (id: string) => void;
  onDoubleClick: (id: string, name: string) => void;
  onToggleSignage: (id: string) => void;
  onTogglePublished: (id: string) => void;
  onDelete: (id: string) => void;
  isEditing: boolean;
  editName: string;
  onEditChange: (val: string) => void;
  onEditConfirm: () => void;
  onEditKeyDown: (e: React.KeyboardEvent) => void;
  canDelete: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between group rounded-lg ${
        isUnpublished ? 'bg-slate-50/50' : ''
      }`}
    >
      {isEditing ? (
        <input
          autoFocus
          className="text-sm bg-white border border-indigo-400 rounded-md px-3 py-1.5 w-full mr-2 outline-none text-slate-900 shadow-sm"
          value={editName}
          onChange={(e) => onEditChange(e.target.value)}
          onBlur={onEditConfirm}
          onKeyDown={onEditKeyDown}
        />
      ) : (
        <button
          onClick={() => onSelect(page.id)}
          onDoubleClick={() => onDoubleClick(page.id, page.name)}
          className={`text-left text-sm px-4 py-2 rounded-lg w-full transition-all ${
            isActive
              ? 'bg-indigo-50/80 text-indigo-700 font-semibold shadow-sm'
              : 'text-slate-600 hover:bg-slate-50'
          } ${isUnpublished ? 'italic text-slate-400' : ''}`}
        >
          {page.name}
        </button>
      )}
      <div className="flex items-center gap-1">
        <button
          {...attributes}
          {...listeners}
          className="p-1 text-slate-400 hover:text-slate-600 cursor-grab"
          title="ドラッグで並べ替え"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="9" cy="5" r="1"/>
            <circle cx="9" cy="12" r="1"/>
            <circle cx="9" cy="19" r="1"/>
            <circle cx="15" cy="5" r="1"/>
            <circle cx="15" cy="12" r="1"/>
            <circle cx="15" cy="19" r="1"/>
          </svg>
        </button>

        {/* サイネージ表示トグル */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSignage(page.id);
          }}
          title={page.includeInSignage !== false ? 'サイネージに表示中' : 'サイネージから除外'}
          className={`p-1 rounded transition-colors ${
            page.includeInSignage !== false ? 'text-indigo-500' : 'text-slate-300'
          }`}
        >
          <Icons.Monitor className="w-3.5 h-3.5" />
        </button>

        {/* 公開/非公開トグル */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePublished(page.id);
          }}
          title={page.published !== false ? '公開中（クリックで非公開）' : '非公開（クリックで公開）'}
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

        {/* 削除ボタン */}
        <button
          onClick={() => {
            if (canDelete) onDelete(page.id);
          }}
          disabled={!canDelete}
          title={!canDelete ? '最後のページは削除できません' : 'ページを削除'}
          className={`text-slate-400 hover:text-rose-500 text-sm px-2 transition-colors ${
            !canDelete
              ? 'opacity-30 cursor-not-allowed'
              : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <Icons.X className="w-4 h-4" />
        </button>
      </div>
    </li>
  );
}

export default function DashboardPageList({
  publishedPages,
  unpublishedPages,
  activePageId,
  isEditor,
  onSelect,
  onAdd,
  onDelete,
  onRename,
  onToggleSignage,
  onTogglePublished,
  onReorder,
  collapsed = false,
}: DashboardPageListProps) {
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

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

  const handleDragEndPublished = useCallback(
    (event: any) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = publishedPages.findIndex((p) => p.id === active.id);
        const newIndex = publishedPages.findIndex((p) => p.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
          const reordered = arrayMove(publishedPages, oldIndex, newIndex);
          onReorder(reordered, unpublishedPages);
        }
      }
    },
    [publishedPages, unpublishedPages, onReorder]
  );

  const handleDragEndUnpublished = useCallback(
    (event: any) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = unpublishedPages.findIndex((p) => p.id === active.id);
        const newIndex = unpublishedPages.findIndex((p) => p.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
          const reordered = arrayMove(unpublishedPages, oldIndex, newIndex);
          onReorder(publishedPages, reordered);
        }
      }
    },
    [publishedPages, unpublishedPages, onReorder]
  );

  const totalPages = publishedPages.length + unpublishedPages.length;

  if (collapsed) {
    // 折りたたみ表示（公開ページのみ表示）
    return (
      <div className="flex flex-col items-center gap-2 w-full mt-4">
        {publishedPages.map((page, idx) => (
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
        {isEditor && (
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
    <div className="mb-2 space-y-4">
      {/* 公開ページセクション */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
            <Icons.Eye className="w-3.5 h-3.5" /> 公開ページ
          </h3>
          {isEditor && (
            <button
              onClick={onAdd}
              className="text-slate-400 hover:text-indigo-600 transition-colors p-1"
              title="ページを追加"
            >
              <Icons.Plus className="w-4 h-4" />
            </button>
          )}
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndPublished}>
          <SortableContext items={publishedPages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-1">
              {publishedPages.map((page) => (
                <SortablePageItem
                  key={page.id}
                  page={page}
                  isActive={page.id === activePageId}
                  isUnpublished={false}
                  onSelect={onSelect}
                  onDoubleClick={handleDoubleClick}
                  onToggleSignage={onToggleSignage}
                  onTogglePublished={onTogglePublished}
                  onDelete={onDelete}
                  isEditing={editingPageId === page.id}
                  editName={editName}
                  onEditChange={setEditName}
                  onEditConfirm={handleConfirm}
                  onEditKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirm();
                  }}
                  canDelete={totalPages > 1}
                />
              ))}
              {publishedPages.length === 0 && (
                <li className="text-xs text-slate-400 text-center py-2">公開ページはありません</li>
              )}
            </ul>
          </SortableContext>
        </DndContext>
      </div>

      {/* 非公開ページセクション（編集者のみ表示） */}
      {isEditor && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Icons.EyeOff className="w-3.5 h-3.5" /> 非公開ページ
            </h3>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndUnpublished}>
            <SortableContext items={unpublishedPages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-1">
                {unpublishedPages.map((page) => (
                  <SortablePageItem
                    key={page.id}
                    page={page}
                    isActive={page.id === activePageId}
                    isUnpublished={true}
                    onSelect={onSelect}
                    onDoubleClick={handleDoubleClick}
                    onToggleSignage={onToggleSignage}
                    onTogglePublished={onTogglePublished}
                    onDelete={onDelete}
                    isEditing={editingPageId === page.id}
                    editName={editName}
                    onEditChange={setEditName}
                    onEditConfirm={handleConfirm}
                    onEditKeyDown={(e) => {
                      if (e.key === 'Enter') handleConfirm();
                    }}
                    canDelete={totalPages > 1}
                  />
                ))}
                {unpublishedPages.length === 0 && (
                  <li className="text-xs text-slate-400 text-center py-2">非公開ページはありません</li>
                )}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}