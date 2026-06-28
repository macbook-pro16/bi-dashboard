// src/components/dashboard/AiChatTab.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import Icons from '../Icons';

interface AiChatTabProps {
  onSend: (prompt: string) => Promise<{ message?: string; widget?: any }>;
  onWidgetGenerated?: (widget: any) => void;
  onSummaryRequest?: () => void;
}

export default function AiChatTab({
  onSend,
  onWidgetGenerated,
  onSummaryRequest,
}: AiChatTabProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput('');
    setHistory((prev) => [...prev, { role: 'user', text: trimmed }, { role: 'ai', text: '生成中...' }]);
    setLoading(true);
    try {
      const result = await onSend(trimmed);
      setHistory((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'ai', text: result.message || '回答がありませんでした' };
        return updated;
      });
      if (result.widget) {
        onWidgetGenerated?.(result.widget);
        setHistory((prev) => [...prev, { role: 'ai', text: 'ウィジェットが生成されました。' }]);
      }
    } catch {
      setHistory((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'ai', text: 'エラーが発生しました' };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  return (
    <div className="flex flex-col h-full bg-slate-50/50 rounded-2xl border border-slate-200/60 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {history.length === 0 && (
          <div className="text-sm text-slate-400 text-center py-10 flex flex-col items-center gap-3">
            <Icons.Sparkles className="w-8 h-8 text-slate-300" />
            <p>
              AIアシスタントに自然言語で指示してください。
              <br />
              <span className="text-xs mt-1 opacity-80">例: 「ステータス別の棒グラフを追加して」</span>
            </p>
          </div>
        )}
        {history.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-sm'
                  : 'bg-white text-slate-800 border border-slate-100 rounded-tl-sm'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <div className="border-t border-slate-200 bg-white p-4 space-y-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                handleSend();
              }
            }}
            placeholder="自然言語で指示..."
            className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={loading}
            className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 shadow-sm disabled:opacity-50 transition-all flex items-center justify-center min-w-[4rem]"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              '送信'
            )}
          </button>
        </div>
        {onSummaryRequest && (
          <button
            onClick={onSummaryRequest}
            className="w-full py-2.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
          >
            <Icons.FileText className="w-4 h-4" /> AIレポート生成
          </button>
        )}
      </div>
    </div>
  );
}