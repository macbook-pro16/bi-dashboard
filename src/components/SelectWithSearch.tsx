// src/components/SelectWithSearch.tsx
'use client';

import React, { useState, useRef } from 'react';
import Icons from './Icons';

interface SelectWithSearchProps {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export default function SelectWithSearch({
  options,
  value,
  onChange,
  placeholder = '検索...',
}: SelectWithSearchProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const safeOptions = (Array.isArray(options) ? options : [])
    .map((opt: any) => {
      if (opt === null || opt === undefined) return '';
      if (typeof opt === 'string') return opt;
      if (typeof opt === 'object') return opt.name || opt.select?.name || String(opt);
      return String(opt);
    })
    .filter(opt => opt && opt !== '' && opt !== 'undefined' && opt !== '[object Object]' && opt !== '0');

  const dedupedOptions = Array.from(new Set(safeOptions));
  const filtered = dedupedOptions.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  const handleSelect = (opt: string) => {
    onChange(opt);
    setSearch('');
    setOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setSearch('');
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={open ? search : (value || '')}
          onFocus={() => {
            setOpen(true);
            setSearch('');
          }}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          onChange={e => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          placeholder={placeholder}
          className="w-full text-sm border border-slate-200 px-3 py-2 rounded-lg bg-white outline-none text-slate-900 pr-8 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
        />
        {value && !open && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
          >
            <Icons.X className="w-4 h-4" />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-20 top-full left-0 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
          {filtered.map(o => (
            <div
              key={o}
              onMouseDown={e => {
                e.preventDefault();
                handleSelect(o);
              }}
              className={`px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 text-slate-700 ${
                o === value ? 'bg-indigo-50/50 font-medium text-indigo-700' : ''
              }`}
            >
              {o}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-sm text-slate-400">該当なし</div>
          )}
        </div>
      )}
    </div>
  );
}