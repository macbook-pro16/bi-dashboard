'use client';
import React, { useState } from 'react';
import { DBItem } from '../types';

function extractFileUrls(val: any): { url: string; name: string; type?: string }[] {
  if (!val) return [];
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed) && parsed[0]?.url) {
        return parsed.map((f: any) => ({ url: f.url, name: f.name || '', type: f.type || 'file' }));
      }
    } catch {}
    if (val.startsWith('http')) return [{ url: val, name: '', type: 'external' }];
    return [];
  }
  if (typeof val === 'object' && val.type === 'files' && Array.isArray(val.files)) {
    return val.files.map((f: any) => {
      if (f.type === 'external' && f.external?.url) return { url: f.external.url, name: f.name || '', type: 'external' };
      if (f.type === 'file' && f.file?.url) return { url: f.file.url, name: f.name || '', type: 'file' };
      return null;
    }).filter(Boolean) as { url: string; name: string; type?: string }[];
  }
  if (Array.isArray(val) && val.length > 0 && (val[0].type === 'external' || val[0].type === 'file')) {
    return val.map((f: any) => {
      if (f.type === 'external' && f.external?.url) return { url: f.external.url, name: f.name || '', type: 'external' };
      if (f.type === 'file' && f.file?.url) return { url: f.file.url, name: f.name || '', type: 'file' };
      return null;
    }).filter(Boolean) as { url: string; name: string; type?: string }[];
  }
  return [];
}

function isImageUrl(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(str)) return true;
  if (/\/image\//i.test(str) || /\/img\//i.test(str)) return true;
  if (str.includes('amazonaws.com') || str.includes('secure.notion-static.com') || str.includes('prod-files-secure')) return true;
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
  images?: string[]; // 後方互換のため残すが未使用
}

export default function DrilldownModal({
  open, onClose, title, data, filterField, filterValue, columns, images = [],
}: DrilldownModalProps) {
  const [search, setSearch] = useState('');
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);

  if (!open) return null;

  const filtered = data.filter(item => {
    let matches = true;
    if (filterField && filterValue) {
      matches = String((item as any)[filterField] ?? '') === filterValue;
    }
    const searchMatch = !search ||
      Object.values(item).some(val => String(val).toLowerCase().includes(search.toLowerCase()));
    return matches && searchMatch;
  });

  const displayColumns = columns && columns.length > 0
    ? columns
    : (data.length > 0 ? Object.keys(data[0]).filter(key => key !== 'id' && key !== 'images') : []);

  // ★ データ内に images 配列を持つ行があるか確認
  const hasRowImages = filtered.some(item => Array.isArray(item.images) && item.images.length > 0);

  const renderCellValue = (value: any) => {
    const files = extractFileUrls(value);
    if (files.length > 0) {
      return (
        <div className="flex gap-1 flex-wrap">
          {files.map((f, idx) => {
            if (isImageUrl(f.url)) {
              return (
                <img key={idx} src={f.url} alt={f.name || '画像'}
                  className="w-12 h-12 object-cover rounded border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity"
                  loading="lazy"
                  onClick={e => { e.stopPropagation(); window.open(f.url, '_blank'); }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              );
            }
            return (
              <a key={idx} href={f.url} target="_blank" rel="noopener noreferrer"
                className="text-indigo-600 underline text-xs truncate max-w-[120px]"
                onClick={e => e.stopPropagation()}>
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
        <img src={strVal} alt=""
          className="w-12 h-12 object-cover rounded border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity"
          loading="lazy"
          onClick={e => { e.stopPropagation(); window.open(strVal, '_blank'); }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      );
    }
    return <span className="truncate block max-w-[200px]" title={strVal}>{strVal}</span>;
  };

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[250]"
      onPointerDown={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl p-6 w-full mx-4 max-h-[85vh] flex flex-col"
        style={{ maxWidth: '1400px' }}
        onPointerDown={e => e.stopPropagation()}
        tabIndex={0}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h3 className="text-xl font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none transition-colors">✕</button>
        </div>

        {/* 検索ボックス */}
        <div className="mb-3 shrink-0">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 フィルタリング..."
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
          />
        </div>

        {/* テーブル（横スクロール対応） */}
        <div className="overflow-auto flex-1">
          {filtered.length > 0 ? (
            <table className="text-sm border-collapse" style={{ minWidth: 'max-content', width: '100%' }}>
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-slate-200">
                  {displayColumns.map(key => (
                    <th key={key} className="text-left py-2 px-3 font-semibold text-slate-600 whitespace-nowrap">
                      {key}
                    </th>
                  ))}
                  {/* ★ 画像列ヘッダー（画像を持つ行がある場合のみ） */}
                  {hasRowImages && (
                    <th className="text-left py-2 px-3 font-semibold text-slate-600 whitespace-nowrap">
                      画像
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    {displayColumns.map(key => (
                      <td key={key} className="py-2 px-3">
                        {renderCellValue(item[key])}
                      </td>
                    ))}
                    {/* ★ 各行の画像セル: 01〜09を横1列 */}
                    {hasRowImages && (
                      <td className="py-2 px-3">
                        <div className="flex gap-1">
                          {Array.isArray(item.images) && item.images.length > 0 ? (
                            item.images.map((url: string, idx: number) => (
                              <img
                                key={idx}
                                src={url}
                                alt={`画像 ${idx + 1}`}
                                className="w-12 h-12 object-cover rounded border border-slate-200 cursor-pointer hover:opacity-80 hover:border-indigo-300 transition-all"
                                loading="lazy"
                                onClick={e => {
                                  e.stopPropagation();
                                  setLightbox({ urls: item.images, index: idx });
                                }}
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center text-slate-400 py-8">該当データがありません</div>
          )}
        </div>

        {/* フッター */}
        <div className="mt-3 text-xs text-slate-400 text-right shrink-0">
          {filtered.length} 件表示
        </div>
      </div>

      {/* ★ Lightbox（行ごとの画像セットで開く） */}
      {lightbox !== null && (
  <div
    className="fixed inset-0 bg-black/80 flex items-center justify-center z-[300]"
    onPointerDown={e => e.stopPropagation()}  {/* ★ モーダルへの伝播を止める */}
    onClick={() => setLightbox(null)}
  >
    <div
      className="relative max-w-[90vw] max-h-[90vh]"
      onClick={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}  {/* ★ 追加 */}
    >
            <img
              src={lightbox.urls[lightbox.index]}
              alt={`画像 ${lightbox.index + 1}`}
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <button
  className="absolute top-4 right-4 text-white text-3xl hover:text-slate-300 transition-colors"
  onPointerDown={e => e.stopPropagation()}  {/* ★ 追加 */}
  onClick={() => setLightbox(null)}
>✕</button>
            {lightbox.index > 0 && (
  <button
    className="absolute left-4 top-1/2 -translate-y-1/2 text-white text-5xl hover:text-slate-300 transition-colors p-2"
    onPointerDown={e => e.stopPropagation()}  {/* ★ 追加 */}
    onClick={e => {
      e.stopPropagation();
      setLightbox(prev => prev ? { ...prev, index: prev.index - 1 } : null);
    }}
  >‹</button>
)}
{lightbox.index < lightbox.urls.length - 1 && (
  <button
    className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-5xl hover:text-slate-300 transition-colors p-2"
    onPointerDown={e => e.stopPropagation()}  {/* ★ 追加 */}
    onClick={e => {
      e.stopPropagation();
      setLightbox(prev => prev ? { ...prev, index: prev.index + 1 } : null);
    }}
  >›</button>
)}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-4 py-1 rounded-full">
              {lightbox.index + 1} / {lightbox.urls.length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}