// src/components/FilterPanel.tsx
'use client';
import React, { useState } from 'react';
import { useFilter } from '../contexts/FilterContext';

interface FilterPanelProps {
  statusOptions: string[];
  statusCounts?: Record<string, number>;
}

export default function FilterPanel({ statusOptions, statusCounts = {} }: FilterPanelProps) {
  const { filters, setStatuses, setSearchTerm } = useFilter();
  const [statusOpen, setStatusOpen] = useState(true);

  const toggleStatus = (s: string) => {
    if (filters.statuses.includes(s)) {
      setStatuses(filters.statuses.filter(x => x !== s));
    } else {
      setStatuses([...filters.statuses, s]);
    }
  };

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={filters.searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        placeholder="キーワード検索..."
        className="w-full px-2 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-xs outline-none focus:border-[var(--color-accent)] text-[var(--color-text)]"
      />

      {statusOptions.length > 0 && (
        <div>
          <button onClick={() => setStatusOpen(!statusOpen)} className="flex items-center justify-between w-full text-[10px] font-bold mb-1 text-[var(--color-text-secondary)]">
            <span>ステータス</span>
            <span className={`transform transition-transform ${statusOpen ? 'rotate-180' : ''}`}>▾</span>
          </button>
          {statusOpen && (
            <div className="flex flex-wrap gap-1">
              {statusOptions.slice(0, 8).map(s => (
                <button
                  key={s}
                  onClick={() => toggleStatus(s)}
                  className={`px-2 py-0.5 rounded-full text-[9px] font-bold border transition-all ${
                    filters.statuses.includes(s)
                      ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                      : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-accent)]'
                  }`}
                >
                  {s} ({statusCounts[s] || 0})
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}