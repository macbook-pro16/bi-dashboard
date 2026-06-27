// src/components/dashboard/ActiveFilterBar.tsx
'use client';

import React from 'react';
import { useFilter } from '../../contexts/FilterContext';
import Icons from '../Icons';
import { DEFAULT_FILTER_DATE_RANGE } from '../../constants';

export default function ActiveFilterBar() {
  const { filters, removeCrossFilter, setStatuses, setDateRange, clearCrossFilters } = useFilter();
  const allBadges: { label: string; onRemove: () => void }[] = [];

  if (filters.dateRange.start !== DEFAULT_FILTER_DATE_RANGE.start || filters.dateRange.end !== DEFAULT_FILTER_DATE_RANGE.end) {
    allBadges.push({
      label: `期間: ${filters.dateRange.start} 〜 ${filters.dateRange.end}`,
      onRemove: () => setDateRange({ start: DEFAULT_FILTER_DATE_RANGE.start, end: DEFAULT_FILTER_DATE_RANGE.end })
    });
  }

  filters.statuses.forEach(s => {
    allBadges.push({
      label: `ステータス: ${s}`,
      onRemove: () => setStatuses(filters.statuses.filter(x => x !== s))
    });
  });

  Object.entries(filters.crossFilters).forEach(([field, values]) => {
    values.forEach(v => {
      allBadges.push({
        label: `${field}: ${v}`,
        onRemove: () => removeCrossFilter(field, v)
      });
    });
  });

  if (allBadges.length === 0) return null;

  return (
    <div className="flex items-center gap-3 px-8 py-3 bg-slate-50 border-b border-slate-200 overflow-x-auto shrink-0">
      <span className="text-xs font-semibold text-slate-500 shrink-0">Active Filters:</span>
      {allBadges.map((b, i) => (
        <span key={i} className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-white border border-slate-200 text-slate-700 shadow-sm">
          {b.label}
          <button onClick={b.onRemove} className="hover:text-rose-500 text-slate-400 transition-colors">
            <Icons.X className="w-3 h-3"/>
          </button>
        </span>
      ))}
      {Object.keys(filters.crossFilters).length > 0 && (
        <button onClick={clearCrossFilters} className="text-xs font-medium text-slate-500 hover:text-slate-800 underline shrink-0 transition-colors ml-2">
          すべてクリア
        </button>
      )}
    </div>
  );
}