'use client';
import React, { useState } from 'react';
import { DBItem } from '../types';

interface DrilldownModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  data: DBItem[];
  filterField?: string;
  filterValue?: string;
  columns?: string[];  // ★ 追加：表示するフィールド名の配列
}

export default function DrilldownModal({ 
  open, 
  onClose, 
  title, 
  data, 
  filterField, 
  filterValue,
  columns,  // ★ 追加
}: DrilldownModalProps) {
  const [search, setSearch] = useState('');
  if (!open) return null;

  const filtered = data.filter(item => {
    let matches = true;
    if (filterField && filterValue) {
      matches = String((item as any)[filterField] ?? '') === filterValue;
    }
    const searchMatch = !search || 
      Object.values(item).some(val => 
        String(val).toLowerCase().includes(search.toLowerCase())
      );
    return matches && searchMatch;
  });

  // ★ 表示カラムを決定（columns が指定されていればそれを使う）
  const displayColumns = columns && columns.length > 0
    ? columns
    : (data.length > 0 ? Object.keys(data[0]).filter(key => key !== 'id') : []);

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[250]" onPointerDown={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto" onPointerDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold">{title}: {filtered.length}件</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
        </div>
        <input 
          type="text" 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          placeholder="全フィールド検索..." 
          className="w-full text-sm border px-3 py-1.5 rounded-lg outline-none mb-2" 
        />
        <div className="overflow-auto max-h-96">
          {filtered.length > 0 ? (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-slate-200">
                  {displayColumns.map(key => (
                    <th key={key} className="text-left py-1.5 px-2 font-semibold text-slate-600 whitespace-nowrap">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                    {displayColumns.map(key => (
                      <td key={key} className="py-1.5 px-2 truncate max-w-[200px]" title={String(item[key] ?? '')}>
                        {String(item[key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center text-slate-400 py-8">該当データがありません</div>
          )}
        </div>
      </div>
    </div>
  );
}