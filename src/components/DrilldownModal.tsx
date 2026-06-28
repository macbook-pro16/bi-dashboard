'use client';
import React, { useState } from 'react';
import { DBItem } from '../types';

// ★ KpiWidget から流用
function extractFileUrls(val: any): { url: string; name: string; type?: string }[] {
  if (!val) return [];

  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed) && parsed[0]?.url) {
        return parsed.map((f: any) => ({
          url: f.url,
          name: f.name || '',
          type: f.type || 'file',
        }));
      }
    } catch {}
    if (val.startsWith('http')) return [{ url: val, name: '', type: 'external' }];
    return [];
  }

  if (typeof val === 'object' && val.type === 'files' && Array.isArray(val.files)) {
    return val.files
      .map((f: any) => {
        if (f.type === 'external' && f.external?.url) return { url: f.external.url, name: f.name || '', type: 'external' };
        if (f.type === 'file' && f.file?.url) return { url: f.file.url, name: f.name || '', type: 'file' };
        return null;
      })
      .filter(Boolean) as { url: string; name: string; type?: string }[];
  }

  if (Array.isArray(val) && val.length > 0 && (val[0].type === 'external' || val[0].type === 'file')) {
    return val
      .map((f: any) => {
        if (f.type === 'external' && f.external?.url) return { url: f.external.url, name: f.name || '', type: 'external' };
        if (f.type === 'file' && f.file?.url) return { url: f.file.url, name: f.name || '', type: 'file' };
        return null;
      })
      .filter(Boolean) as { url: string; name: string; type?: string }[];
  }

  return [];
}

function isImageUrl(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(str)) return true;
  if (/\/image\//i.test(str) || /\/img\//i.test(str)) return true;
  if (str.includes('amazonaws.com') || str.includes('secure.notion-static.com') || str.includes('prod-files-secure')) {
    return true;
  }
  return false;
}

interface DrilldownModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  data: DBItem[];
  filterField?: string;
  filterValue?: string;
  columns?: string[];
}

export default function DrilldownModal({ 
  open, 
  onClose, 
  title, 
  data, 
  filterField, 
  filterValue,
  columns,
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

  const displayColumns = columns && columns.length > 0
    ? columns
    : (data.length > 0 ? Object.keys(data[0]).filter(key => key !== 'id') : []);

  // ★ セル内の値をレンダリング（画像/ファイル対応）
  const renderCellValue = (value: any, item: DBItem, fieldName: string) => {
    const files = extractFileUrls(value);
    if (files.length > 0) {
      return (
        <div className="flex gap-1 flex-wrap">
          {files.map((f, idx) => {
            if (isImageUrl(f.url)) {
              return (
                <img
                  key={idx}
                  src={f.url}
                  alt={f.name || '画像'}
                  className="w-12 h-12 object-cover rounded border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity"
                  loading="lazy"
                  onClick={(e) => { e.stopPropagation(); window.open(f.url, '_blank'); }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              );
            }
            return (
              <a
                key={idx}
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 underline text-xs truncate max-w-[120px]"
                onClick={(e) => e.stopPropagation()}
              >
                {f.name || 'ファイル'}
              </a>
            );
          })}
        </div>
      );
    }

    const strVal = String(value ?? '—');
    if (isImageUrl(strVal)) {
      return (
        <img
          src={strVal}
          alt=""
          className="w-12 h-12 object-cover rounded border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity"
          loading="lazy"
          onClick={(e) => { e.stopPropagation(); window.open(strVal, '_blank'); }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      );
    }
    return <span className="truncate block max-w-[200px]" title={strVal}>{strVal}</span>;
  };

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
                      <td key={key} className="py-1.5 px-2">
                        {renderCellValue(item[key], item, key)}
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