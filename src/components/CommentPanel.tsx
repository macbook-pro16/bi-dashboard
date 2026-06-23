'use client';
import React, { useState } from 'react';
import { WidgetComment } from '../types';

interface CommentPanelProps {
  comments: WidgetComment[];
  onAdd: (text: string) => void;
  onDelete: (commentId: string) => void;
  widgetTitle: string;
}

export default function CommentPanel({ comments, onAdd, onDelete, widgetTitle }: CommentPanelProps) {
  const [text, setText] = useState('');

  const handleAdd = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setText('');
  };

  return (
    <div className="border border-[var(--color-border)] rounded-xl p-3 bg-[var(--color-surface)]">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] font-black text-[var(--color-text-secondary)] uppercase">💬 コメント</h4>
        <span className="text-[9px] text-[var(--color-text-secondary)]">{comments.length}件</span>
      </div>

      <div className="space-y-1.5 max-h-40 overflow-y-auto mb-2">
        {comments.length === 0 && (
          <div className="text-[10px] text-center text-[var(--color-text-secondary)] py-2">コメントなし</div>
        )}
        {comments.map(c => (
          <div
            key={c.id}
            className="bg-[var(--color-bg)] p-2 rounded text-[10px] border border-[var(--color-border)] group"
          >
            <div className="flex justify-between items-start">
              <span className="font-bold text-[var(--color-text)]">{c.userName}</span>
              <button
                onClick={() => onDelete(c.id)}
                className="text-slate-300 hover:text-rose-400 flex-shrink-0 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ✕
              </button>
            </div>
            <p className="text-[var(--color-text-secondary)] mt-0.5">{c.text}</p>
            <span className="text-[8px] text-[var(--color-text-secondary)]">
              {new Date(c.createdAt).toLocaleDateString('ja-JP')}
            </span>
          </div>
        ))}
      </div>

      <div className="flex gap-1">
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && text.trim()) {
              handleAdd();
            }
          }}
          placeholder="コメントを追加..."
          className="flex-1 text-[11px] px-2 py-1 border border-slate-200 rounded-lg outline-none focus:border-indigo-400 bg-white"
        />
        <button
          onClick={handleAdd}
          className="px-2 py-1 bg-indigo-500 text-white text-[11px] font-bold rounded-lg hover:bg-indigo-600"
        >
          追加
        </button>
      </div>
    </div>
  );
}