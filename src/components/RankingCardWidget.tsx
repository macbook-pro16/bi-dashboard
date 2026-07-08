// src/components/RankingCardWidget.tsx
'use client';

import React, { useState, useCallback } from 'react';

interface RankingItem {
  id: string;
  rank: number;
  title: string;
  manage_id: string;
  maker: string;
  model: string;
  body_type: string;
  price: string;
  favorite_count: number;
  thumbnail: string;
  permalink: string;
  is_sold: boolean;
  [key: string]: any;
}

interface RankingCardWidgetProps {
  data: RankingItem[];
  title?: string;
  showTitle?: boolean;
  limit?: number;
  columns?: number;
  rows?: number;
  titleColor?: string;
  titleFontSize?: number;
  onDrilldown?: (field: string, value: string, widgetTitle: string, data?: any[]) => void;
}

export default function RankingCardWidget({
  data,
  title,
  showTitle = true,
  rows = 3,
  columns = 8,
  titleColor = '#475569',
  titleFontSize = 14,
  onDrilldown,
}: RankingCardWidgetProps) {
  const [expanded, setExpanded] = useState(false);
  const visibleCount = rows * columns;
  const displayData = expanded ? data : data.slice(0, visibleCount);

  const handleCardClick = useCallback((item: RankingItem) => {
    if (onDrilldown) {
      onDrilldown('favorite_rank', String(item.rank), item.title, [item]);
    }
  }, [onDrilldown]);

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-sm text-slate-400">
        ランキングデータがありません
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col p-4" style={{ fontFamily: '"Inter", "Noto Sans JP", sans-serif' }}>
      {showTitle && title && (
        <div
          className="font-bold mb-3 shrink-0"
          style={{ fontSize: `${titleFontSize}px`, color: titleColor, textAlign: 'center' }}
        >
          {title}
        </div>
      )}
      <div className="flex-1 overflow-auto">
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {displayData.map((item) => (
            <div
              key={item.id}
              onClick={() => handleCardClick(item)}
              className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden relative flex flex-col"
            >
              {/* ランクバッジ */}
              <div className="absolute top-2 left-2 z-10">
                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white shadow ${
                  item.rank === 1 ? 'bg-yellow-500' :
                  item.rank === 2 ? 'bg-gray-400' :
                  item.rank === 3 ? 'bg-orange-600' :
                  'bg-slate-700'
                }`}>
                  {item.rank}
                </span>
              </div>

              {/* SOLDオーバーレイ */}
              {item.is_sold && (
                <div className="absolute inset-0 bg-black/40 z-10 flex items-center justify-center">
                  <span className="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                    SOLD OUT
                  </span>
                </div>
              )}

              {/* サムネイル */}
              <div className="w-full aspect-[4/3] bg-slate-100 overflow-hidden">
                <img
                  src={item.thumbnail || 'https://s-truck.co.jp/wp-content/uploads/2026/02/no-image.webp'}
                  alt={item.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://s-truck.co.jp/wp-content/uploads/2026/02/no-image.webp';
                  }}
                />
              </div>

              {/* 車両情報 */}
              <div className="p-3 flex flex-col gap-1.5 flex-1">
                <div className="text-xs text-slate-500 font-medium truncate">
                  {item.maker || '---'}
                </div>
                <h3 className="text-sm font-bold text-slate-800 line-clamp-2 leading-tight">
                  {item.title || item.model || '名称なし'}
                </h3>
                <div className="flex items-center justify-between mt-auto">
                  <span className="text-xs text-slate-400">
                    ID: {item.manage_id || '-'}
                  </span>
                  <span className="text-sm font-bold text-pink-600">
                    ♥ {item.favorite_count}
                  </span>
                </div>
                {item.price && !item.is_sold && (
                  <div className="text-xs font-semibold text-slate-600 bg-slate-50 px-2 py-0.5 rounded text-center">
                    {(() => {
                      const num = Number(item.price);
                      return isNaN(num) ? item.price : num.toLocaleString();
                    })()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* もっと見るボタン */}
      {data.length > visibleCount && (
        <div className="text-center mt-3 shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium underline"
          >
            {expanded ? `上位${visibleCount}件に戻す` : `すべて表示（${data.length}件）`}
          </button>
        </div>
      )}
    </div>
  );
}