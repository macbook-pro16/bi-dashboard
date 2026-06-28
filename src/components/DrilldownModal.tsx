'use client';
import React, { useState } from 'react';
import { DBItem } from '../types';

// ★ KpiWidget から流用（画像URL抽出）
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
  images?: string[];  // ★ 追加：WordPress画像URLの配列
}

export default function DrilldownModal({
  open,
  onClose,
  title,
  data,
  filterField,
  filterValue,
  columns,
  images = [],  // ★ 追加（デフォルト空配列）
}: DrilldownModalProps) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'images'>('list');  // ★ 追加
  const [selectedImage, setSelectedImage] = useState<number | null>(null);  // ★ 追加（Lightbox用）

  if (!open) return null;

  // フィルタリング処理
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

  // ★ 表示カラムを決定
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

  // ★ Lightbox（カルーセル）の制御
  const handlePrevImage = () => {
    setSelectedImage(prev => (prev !== null && prev > 0 ? prev - 1 : prev));
  };
  const handleNextImage = () => {
    setSelectedImage(prev => (prev !== null && prev < images.length - 1 ? prev + 1 : prev));
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setSelectedImage(null);
    if (e.key === 'ArrowLeft') handlePrevImage();
    if (e.key === 'ArrowRight') handleNextImage();
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[250]" onPointerDown={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto"
        onPointerDown={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold">{title}: {filtered.length}件</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
        </div>

        {/* ★ タブ切り替え */}
        <div className="flex border-b border-slate-200 mb-3">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 text-sm font-medium transition-all ${
              activeTab === 'list'
                ? 'border-b-2 border-indigo-500 text-indigo-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            📋 一覧
          </button>
          <button
            onClick={() => setActiveTab('images')}
            className={`px-4 py-2 text-sm font-medium transition-all ${
              activeTab === 'images'
                ? 'border-b-2 border-indigo-500 text-indigo-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            🖼️ 画像 ({images.length > 0 ? images.length : 0})
          </button>
        </div>

        {/* ★ タブコンテンツ */}
        {activeTab === 'list' ? (
          // ===== 一覧タブ =====
          <>
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
          </>
        ) : (
          // ===== 画像タブ =====
          <div className="py-2">
            {images.length > 0 ? (
              <>
                {/* 9枚横一列 */}
                <div className="flex gap-1 overflow-x-auto pb-2">
                  {images.slice(0, 9).map((url, idx) => (
                    <div
                      key={idx}
                      className="flex-shrink-0 aspect-square cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ width: `calc((100% - 8 * 4px) / 9)` }}
                      onClick={() => setSelectedImage(idx)}
                    >
                      <img
                        src={url}
                        alt={`画像 ${idx + 1}`}
                        className="w-full h-full object-cover rounded border border-slate-200"
                        loading="lazy"
                        onError={(e) => {
                          // 画像が読み込めない場合は非表示
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="text-xs text-slate-400 mt-1 text-center">
                  {images.length}枚の画像（クリックで拡大）
                </div>
              </>
            ) : (
              <div className="text-center text-slate-400 py-12">
                <div className="text-4xl mb-2">🖼️</div>
                <p>画像はありません</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ★ Lightbox（カルーセル風） */}
      {selectedImage !== null && images.length > 0 && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[300]"
          onClick={() => setSelectedImage(null)}
          onKeyDown={handleKeyDown}
        >
          <div
            className="relative max-w-[90vw] max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* 画像表示 */}
            <img
              src={images[selectedImage]}
              alt={`画像 ${selectedImage + 1}`}
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />

            {/* 閉じるボタン */}
            <button
              className="absolute top-2 right-2 text-white text-3xl hover:text-slate-300 transition-colors"
              onClick={() => setSelectedImage(null)}
            >
              ✕
            </button>

            {/* 前へボタン */}
            {selectedImage > 0 && (
              <button
                className="absolute left-2 top-1/2 -translate-y-1/2 text-white text-4xl hover:text-slate-300 transition-colors p-2"
                onClick={(e) => { e.stopPropagation(); handlePrevImage(); }}
              >
                ‹
              </button>
            )}

            {/* 次へボタン */}
            {selectedImage < images.length - 1 && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white text-4xl hover:text-slate-300 transition-colors p-2"
                onClick={(e) => { e.stopPropagation(); handleNextImage(); }}
              >
                ›
              </button>
            )}

            {/* 画像番号表示 */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-3 py-1 rounded-full">
              {selectedImage + 1} / {images.length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}