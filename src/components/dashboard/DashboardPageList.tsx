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
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface DashboardPageListProps {
  dashboards: DashboardPage[];
  activeIndex: number;
  onSelect: (idx: number) => void;
  onAdd: () => void;
  onDelete: (idx: number) => void;
  onRename: (idx: number, name: string) => void;
  onToggleSignage: (idx: number) => void;
  onReorder: (newOrder: DashboardPage[]) => void;
  collapsed?: boolean;
}

function SortablePageItem({
  page,
  idx,
  isActive,
  onSelect,
  onDoubleClick,
  onToggleSignage,
  onDelete,
  isEditing,
  editName,
  onEditChange,
  onEditConfirm,
  onEditKeyDown,
  dashboardsCount,
}: {
  page: DashboardPage;
  idx: number;
  isActive: boolean;
  onSelect: (idx: number) => void;
  onDoubleClick: (idx: number, name: string) => void;
  onToggleSignage: (idx: number) => void;
  onDelete: (idx: number) => void;
  isEditing: boolean;
  editName: string;
  onEditChange: (val: string) => void;
  onEditConfirm: () => void;
  onEditKeyDown: (e: React.KeyboardEvent) => void;
  dashboardsCount: number;
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
      className="flex items-center justify-between group"
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
          onClick={() => onSelect(idx)}
          onDoubleClick={() => onDoubleClick(idx, page.name)}
          className={`text-left text-sm px-4 py-2 rounded-lg w-full transition-all ${
            isActive
              ? 'bg-indigo-50/80 text-indigo-700 font-semibold shadow-sm'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
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
            if (dashboardsCount > 1) onDelete(idx);
          }}
          disabled={dashboardsCount <= 1}
          title={dashboardsCount <= 1 ? '最後のページは削除できません' : 'ページを削除'}
          className={`text-slate-400 hover:text-rose-500 text-sm px-2 transition-colors ${
            dashboardsCount <= 1
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
  dashboards,
  activeIndex,
  onSelect,
  onAdd,
  onDelete,
  onRename,
  onToggleSignage,
  onReorder,
  collapsed = false,
}: DashboardPageListProps) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

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

  const handleDragEnd = useCallback(
    (event: any) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = dashboards.findIndex((p) => p.id === active.id);
        const newIndex = dashboards.findIndex((p) => p.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
          const reordered = [...dashboards];
          reordered.splice(oldIndex, 1);
          reordered.splice(newIndex, 0, dashboards[oldIndex]);
          onReorder(reordered);
        }
      }
    },
    [dashboards, onReorder]
  );

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
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={dashboards.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-1">
            {dashboards.map((page, idx) => (
              <SortablePageItem
                key={page.id}
                page={page}
                idx={idx}
                isActive={idx === activeIndex}
                onSelect={onSelect}
                onDoubleClick={handleDoubleClick}
                onToggleSignage={onToggleSignage}
                onDelete={onDelete}
                isEditing={editingIdx === idx}
                editName={editName}
                onEditChange={setEditName}
                onEditConfirm={handleConfirm}
                onEditKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirm();
                }}
                dashboardsCount={dashboards.length}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}