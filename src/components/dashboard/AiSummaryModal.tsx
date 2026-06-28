// src/components/dashboard/AiSummaryModal.tsx
'use client';

import React from 'react';
import Icons from '../Icons';

interface AiSummaryModalProps {
  open: boolean;
  onClose: () => void;
  summary: string;
}

export default function AiSummaryModal({ open, onClose, summary }: AiSummaryModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[300]" onPointerDown={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col" onPointerDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900">
            <Icons.Sparkles className="w-6 h-6 text-indigo-500" /> AI インサイトレポート
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <Icons.X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto bg-slate-50 rounded-xl p-6 border border-slate-100">
          <pre className="text-sm text-slate-700 whitespace-pre-wrap leading-loose font-sans">{summary}</pre>
        </div>
        <button
          onClick={onClose}
          className="mt-6 w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 shadow-sm transition-all"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}