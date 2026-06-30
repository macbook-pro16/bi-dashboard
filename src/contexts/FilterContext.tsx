// src/contexts/FilterContext.tsx
'use client';
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { DBItem } from '../types';
import { getDefaultFilterDateRange } from '../constants';

interface FilterState {
  statuses: string[];
  dateRange: { start: string; end: string };
  searchTerm: string;
  crossFilters: Record<string, string[]>;
}

interface FilterContextValue {
  filters: FilterState;
  setStatuses: (statuses: string[]) => void;
  setDateRange: (range: { start: string; end: string }) => void;
  updateDateRange: (partial: { start?: string; end?: string }) => void;
  setSearchTerm: (term: string) => void;
  toggleCrossFilter: (field: string, value: string) => void;
  removeCrossFilter: (field: string, value: string) => void;
  clearCrossFilters: () => void;
  setCrossFilterValues: (field: string, values: string[]) => void;
  applyFilters: (data: DBItem[]) => DBItem[];
  resetFilters: () => void;
}

const initialFilters: FilterState = {
  statuses: [],
  dateRange: getDefaultFilterDateRange(),
  searchTerm: '',
  crossFilters: {},
};

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<FilterState>(initialFilters);

  const setStatuses = useCallback((statuses: string[]) =>
    setFilters(prev => ({ ...prev, statuses })), []);
  const setDateRange = useCallback((range: { start: string; end: string }) =>
    setFilters(prev => ({ ...prev, dateRange: range })), []);
  const updateDateRange = useCallback((partial: { start?: string; end?: string }) =>
    setFilters(prev => ({ ...prev, dateRange: { ...prev.dateRange, ...partial } })), []);
  const setSearchTerm = useCallback((term: string) =>
    setFilters(prev => ({ ...prev, searchTerm: term })), []);

  const toggleCrossFilter = useCallback((field: string, value: string) => {
    setFilters(prev => {
      const current = prev.crossFilters[field] || [];
      if (current.includes(value)) {
        const next = current.filter(v => v !== value);
        const copy = { ...prev.crossFilters };
        if (next.length === 0) delete copy[field];
        else copy[field] = next;
        return { ...prev, crossFilters: copy };
      } else {
        return { ...prev, crossFilters: { ...prev.crossFilters, [field]: [...current, value] } };
      }
    });
  }, []);

  const removeCrossFilter = useCallback((field: string, value: string) => {
    setFilters(prev => {
      const current = prev.crossFilters[field] || [];
      const next = current.filter(v => v !== value);
      const copy = { ...prev.crossFilters };
      if (next.length === 0) delete copy[field];
      else copy[field] = next;
      return { ...prev, crossFilters: copy };
    });
  }, []);

  const clearCrossFilters = useCallback(() => setFilters(prev => ({ ...prev, crossFilters: {} })), []);

  const setCrossFilterValues = useCallback((field: string, values: string[]) => {
    setFilters(prev => {
      const copy = { ...prev.crossFilters };
      if (values.length === 0) {
        delete copy[field];
      } else {
        copy[field] = values;
      }
      return { ...prev, crossFilters: copy };
    });
  }, []);

  const resetFilters = useCallback(() => setFilters(initialFilters), []);

  const applyFilters = useCallback((data: DBItem[]): DBItem[] => {
    let result = [...data];
    if (filters.statuses.length > 0) {
      result = result.filter(item => filters.statuses.includes(item.status));
    }
    Object.entries(filters.crossFilters).forEach(([field, values]) => {
      if (values.length > 0) {
        result = result.filter(item => values.includes(String(item[field] ?? '')));
      }
    });
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      result = result.filter(item =>
        item.name.toLowerCase().includes(term) ||
        item.chassisNumber.toLowerCase().includes(term) ||
        item.status.toLowerCase().includes(term)
      );
    }
    return result;
  }, [filters]);

  const value = useMemo(() => ({
    filters, setStatuses, setDateRange, updateDateRange, setSearchTerm,
    toggleCrossFilter, removeCrossFilter, clearCrossFilters, setCrossFilterValues,
    applyFilters, resetFilters,
  }), [filters, setStatuses, setDateRange, updateDateRange, setSearchTerm, toggleCrossFilter, removeCrossFilter, clearCrossFilters, setCrossFilterValues, applyFilters, resetFilters]);

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilter() {
  const ctx = useContext(FilterContext);
  if (!ctx) {
    // ★ フォールバック値も getDefaultFilterDateRange() を使う
    const defaultRange = getDefaultFilterDateRange();
    return {
      filters: {
        statuses: [] as string[],
        dateRange: { start: defaultRange.start, end: defaultRange.end },
        searchTerm: '',
        crossFilters: {} as Record<string, string[]>,
      },
      setStatuses: () => {},
      setDateRange: () => {},
      updateDateRange: () => {},
      setSearchTerm: () => {},
      toggleCrossFilter: () => {},
      removeCrossFilter: () => {},
      clearCrossFilters: () => {},
      setCrossFilterValues: () => {},
      applyFilters: (d: DBItem[]) => d,
      resetFilters: () => {},
    } as FilterContextValue;
  }
  return ctx;
}