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
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface DashboardPageListProps {
  dashboards: DashboardPage[];
  activePageId: string | null;
  canEdit: boolean;
  onSelect: (pageId: string) => void;
  onAdd: () => void;
  onDelete: (pageId: string) => void;
  onRename: (pageId: string, name: string) => void;
  onToggleSignage: (pageId: string) => void;
  // ★ onTogglePublished は廃止（公開状態はドラッグでエリア移動して変更する）
  onReorder?: (reordered: DashboardPage[]) => void;
  collapsed?: boolean;
}

function SortablePageItem({
  page,
  isActive,
  isUnpublished,
  canEdit,
  onSelect,
  onDoubleClick,
  onToggleSignage,
  onDelete,
  canDelete,
  isEditing,
  editName,
  onEditChange,
  onEditConfirm,
  onEditKeyDown,
}: {
  page: DashboardPage;
  isActive: boolean;
  isUnpublished: boolean;
  canEdit: boolean;
  onSelect: (id: string) => void;
  onDoubleClick: (id: string, name: string) => void;
  onToggleSignage: (id: string) => void;
  onDelete: (id: string) => void;
  canDelete: boolean;
  isEditing: boolean;
  editName: string;
  onEditChange: (val: string) => void;
  onEditConfirm: () => void;
  onEditKeyDown: (e: React.KeyboardEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: page.id, disabled: !canEdit });

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
        {canEdit && (
          <>
            {/* ドラッグハンドル（編集者のみ） */}
            <button
              {...attributes}
              {...listeners}
              className="p-1 text-slate-400 hover:text-slate-600 cursor-grab"
              title="ドラッグで並べ替え"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="9" cy="5" r="1" />
                <circle cx="9" cy="12" r="1" />
                <circle cx="9" cy="19" r="1" />
                <circle cx="15" cy="5" r="1" />
                <circle cx="15" cy="12" r="1" />
                <circle cx="15" cy="19" r="1" />
              </svg>
            </button>

            {/* サイネージ表示トグル */}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleSignage(page.id); }}
              title={page.includeInSignage !== false ? 'サイネージに表示中' : 'サイネージから除外'}
              className={`p-1 rounded transition-colors ${page.includeInSignage !== false ? 'text-indigo-500' : 'text-slate-300'}`}
            >
              <Icons.Monitor className="w-3.5 h-3.5" />
            </button>

            {/* ★ 公開/非公開トグル（目のアイコン）は廃止。
                公開状態は「公開エリア／非公開エリア」間のドラッグ操作で切り替える */}

            {/* 削除ボタン */}
            <button
              onClick={() => { if (canDelete) onDelete(page.id); }}
              disabled={!canDelete}
              title={!canDelete ? '最後のページは削除できません' : 'ページを削除'}
              className="text-slate-400 hover:text-rose-500 text-sm px-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Icons.X className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </li>
  );
}

// ★ 空のエリアにもドロップできるようにするための領域コンポーネント
function AreaDropZone({
  id,
  label,
  count,
  accentColor,
  children,
}: {
  id: string;
  label: string;
  count: number;
  accentColor: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2 px-1">
        <h4
          className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
          style={{ color: accentColor }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentColor }} />
          {label}
        </h4>
        <span className="text-[10px] text-slate-400">{count}</span>
      </div>
      <ul
        ref={setNodeRef}
        className={`space-y-1 min-h-[40px] rounded-lg transition-colors ${
          isOver ? 'bg-indigo-50/60 ring-2 ring-indigo-300 ring-inset' : ''
        }`}
      >
        {children}
        {count === 0 && (
          <li className="text-[11px] text-slate-300 text-center py-3 border border-dashed border-slate-200 rounded-lg">
            ここにドラッグして移動
          </li>
        )}
      </ul>
    </div>
  );
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
  onReorder,
  collapsed = false,
}: DashboardPageListProps) {
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // ★ サーバー側(load API)で既にフィルタ済みだが、念のためクライアントでも防御的にフィルタ
  const visiblePages = canEdit
    ? dashboards
    : dashboards.filter((p) => p.published !== false);

  // ★ 公開エリア／非公開エリアの2グループに分割
  const publishedPages = visiblePages.filter((p) => p.published !== false);
  const unpublishedPages = visiblePages.filter((p) => p.published === false);

  const [activeDragId, setActiveDragId] = useState<string | null>(null);

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

  // ドラッグ先のエリアID（'area-published' | 'area-unpublished'）を判定
  const resolveAreaId = (overId: string | number | null): 'published' | 'unpublished' | null => {
    if (overId === 'area-published') return 'published';
    if (overId === 'area-unpublished') return 'unpublished';
    const overPage = dashboards.find((p) => p.id === overId);
    if (overPage) return overPage.published === false ? 'unpublished' : 'published';
    return null;
  };

  const handleDragStart = useCallback((event: any) => {
    setActiveDragId(event.active.id);
  }, []);

  const handleDragEnd = useCallback(
    (event: any) => {
      setActiveDragId(null);
      if (!canEdit || !onReorder) return;
      const { active, over } = event;
      if (!over) return;

      const draggedPage = dashboards.find((p) => p.id === active.id);
      if (!draggedPage) return;

      const targetArea = resolveAreaId(over.id);
      if (!targetArea) return;

      const targetPublished = targetArea === 'published';

      // ★ ドラッグしたページの published を移動先エリアに合わせて更新
      const updatedDashboards = dashboards.map((p) =>
        p.id === draggedPage.id ? { ...p, published: targetPublished } : p
      );

      // 同一エリア内での並び替え（over が実ページの場合のみ並び順を調整）
      const overPage = dashboards.find((p) => p.id === over.id);
      if (overPage && overPage.id !== draggedPage.id) {
        const oldIndex = updatedDashboards.findIndex((p) => p.id === active.id);
        const newIndex = updatedDashboards.findIndex((p) => p.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
          const reordered = arrayMove(updatedDashboards, oldIndex, newIndex);
          onReorder(reordered);
          return;
        }
      }

      // over がエリア自体（空エリアへのドロップ等）の場合は published 変更のみ反映
      onReorder(updatedDashboards);
    },
    [dashboards, canEdit, onReorder]
  );

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

      {canEdit ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* 公開エリア */}
          <AreaDropZone id="area-published" label="公開エリア" count={publishedPages.length} accentColor="#10b981">
            <SortableContext items={publishedPages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
              {publishedPages.map((page) => (
                <SortablePageItem
                  key={page.id}
                  page={page}
                  isActive={page.id === activePageId}
                  isUnpublished={false}
                  canEdit={canEdit}
                  onSelect={onSelect}
                  onDoubleClick={handleDoubleClick}
                  onToggleSignage={onToggleSignage}
                  onDelete={onDelete}
                  canDelete={dashboards.length > 1}
                  isEditing={editingPageId === page.id}
                  editName={editName}
                  onEditChange={setEditName}
                  onEditConfirm={handleConfirm}
                  onEditKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirm();
                  }}
                />
              ))}
            </SortableContext>
          </AreaDropZone>

          {/* 非公開エリア */}
          <AreaDropZone id="area-unpublished" label="非公開エリア（編集者のみ閲覧可）" count={unpublishedPages.length} accentColor="#94a3b8">
            <SortableContext items={unpublishedPages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
              {unpublishedPages.map((page) => (
                <SortablePageItem
                  key={page.id}
                  page={page}
                  isActive={page.id === activePageId}
                  isUnpublished={true}
                  canEdit={canEdit}
                  onSelect={onSelect}
                  onDoubleClick={handleDoubleClick}
                  onToggleSignage={onToggleSignage}
                  onDelete={onDelete}
                  canDelete={dashboards.length > 1}
                  isEditing={editingPageId === page.id}
                  editName={editName}
                  onEditChange={setEditName}
                  onEditConfirm={handleConfirm}
                  onEditKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirm();
                  }}
                />
              ))}
            </SortableContext>
          </AreaDropZone>
        </DndContext>
      ) : (
        // 閲覧者用（ドラッグ不可、公開ページのみ・サーバー側で既にフィルタ済み）
        <ul className="space-y-1">
          {publishedPages.map((page) => (
            <SortablePageItem
              key={page.id}
              page={page}
              isActive={page.id === activePageId}
              isUnpublished={false}
              canEdit={false}
              onSelect={onSelect}
              onDoubleClick={handleDoubleClick}
              onToggleSignage={onToggleSignage}
              onDelete={onDelete}
              canDelete={false}
              isEditing={false}
              editName=""
              onEditChange={() => {}}
              onEditConfirm={() => {}}
              onEditKeyDown={() => {}}
            />
          ))}
          {publishedPages.length === 0 && (
            <li className="text-xs text-slate-400 text-center py-2">ページがありません</li>
          )}
        </ul>
      )}
    </div>
  );
}