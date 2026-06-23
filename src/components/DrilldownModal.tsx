'use client';
import React, { useState } from 'react';
import { DBItem } from '../types';

interface DrilldownModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  data: DBItem[];
  filterField: string;
  filterValue: string;
}

export default function DrilldownModal({ open, onClose, title, data, filterField, filterValue }: DrilldownModalProps) {
  const [search, setSearch] = useState('');
  if (!open) return null;

  const filtered = data.filter(item => {
    const matches = String((item as any)[filterField] ?? '') === filterValue;
    const searchMatch = !search || item.name.toLowerCase().includes(search.toLowerCase()) || item.chassisNumber.toLowerCase().includes(search.toLowerCase());
    return matches && searchMatch;
  });

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[250]" onPointerDown={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onPointerDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold">{title}: {filterValue} — {filtered.length}件</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
        </div>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="絞り込み..." className="w-full text-sm border px-3 py-1.5 rounded-lg outline-none mb-2" />
        <div className="overflow-auto max-h-96">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white">
              <tr>
                <th className="text-left py-1">車両名</th>
                <th className="text-left py-1">車体番号</th>
                <th className="text-left py-1">ステータス</th>
                <th className="text-left py-1">日付</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="py-1">{item.name}</td>
                  <td className="py-1">{item.chassisNumber}</td>
                  <td className="py-1">{item.status}</td>
                  <td className="py-1">{item.date || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}