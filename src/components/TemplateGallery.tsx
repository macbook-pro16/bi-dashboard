'use client';
import React from 'react';
import { Widget } from '../types';

const BRAND_COLOR = '#e16b8c';

const TEMPLATES: {
  name: string;
  desc: string;
  emoji: string;
  widgets: Partial<Widget>[];
}[] = [
  {
    name: 'KPIダッシュボード',
    desc: 'KPIカード3枚 + 明細テーブル',
    emoji: '📊',
    widgets: [
      {
        type: 'kpi-total',
        title: '総データ数',
        x: 40, y: 40, w: 220, h: 140,
        shape: 'rounded', bgColor: '#fff', textColor: BRAND_COLOR, borderColor: '#e2e8f0',
        borderWidth: 1, fontSize: 48, textAlign: 'center', alignItems: 'center',
        fontFamily: 'sans', hasShadow: true, hidden: false, locked: false,
      },
      {
        type: 'kpi-filtered',
        title: '有効データ',
        x: 280, y: 40, w: 220, h: 140,
        shape: 'rounded', bgColor: '#fff', textColor: BRAND_COLOR, borderColor: '#e2e8f0',
        borderWidth: 1, fontSize: 48, textAlign: 'center', alignItems: 'center',
        fontFamily: 'sans', hasShadow: true, hidden: false, locked: false,
      },
      {
        type: 'kpi-today',
        title: '本日',
        x: 520, y: 40, w: 220, h: 140,
        shape: 'rounded', bgColor: '#fff', textColor: '#334155', borderColor: '#e2e8f0',
        borderWidth: 1, fontSize: 48, textAlign: 'center', alignItems: 'center',
        fontFamily: 'sans', hasShadow: true, hidden: false, locked: false,
      },
      {
        type: 'table-details',
        title: '明細表',
        x: 40, y: 200, w: 700, h: 380,
        shape: 'rectangle', bgColor: '#fff', textColor: '#334155', borderColor: '#e2e8f0',
        borderWidth: 1, fontSize: 14, textAlign: 'left', alignItems: 'flex-start',
        fontFamily: 'sans', hasShadow: true, hidden: false, locked: false,
      },
    ],
  },
  {
    name: 'フロー図',
    desc: 'ステータスフロー + 矢印',
    emoji: '🔄',
    widgets: [
      {
        type: 'flow-node',
        title: '未入庫',
        statusTarget: '未入庫',
        x: 40, y: 60, w: 140, h: 140,
        shape: 'circle', bgColor: '#fff', textColor: BRAND_COLOR, borderColor: BRAND_COLOR,
        borderWidth: 4, fontSize: 40, textAlign: 'center', alignItems: 'center',
        fontFamily: 'sans', hasShadow: true, hidden: false, locked: false,
      },
      {
        type: 'text-only',
        title: '',
        x: 190, y: 110, w: 60, h: 40,
        shape: 'arrow-right', bgColor: '#cbd5e1', textColor: '#334155', borderColor: '#cbd5e1',
        borderWidth: 0, fontSize: 14, textAlign: 'center', alignItems: 'center',
        fontFamily: 'sans', hasShadow: false, hidden: false, locked: false,
      },
      {
        type: 'flow-node',
        title: '整備中',
        statusTarget: '整備中',
        x: 260, y: 60, w: 140, h: 140,
        shape: 'circle', bgColor: '#fff', textColor: BRAND_COLOR, borderColor: BRAND_COLOR,
        borderWidth: 4, fontSize: 40, textAlign: 'center', alignItems: 'center',
        fontFamily: 'sans', hasShadow: true, hidden: false, locked: false,
      },
      {
        type: 'text-only',
        title: '',
        x: 410, y: 110, w: 60, h: 40,
        shape: 'arrow-right', bgColor: '#cbd5e1', textColor: '#334155', borderColor: '#cbd5e1',
        borderWidth: 0, fontSize: 14, textAlign: 'center', alignItems: 'center',
        fontFamily: 'sans', hasShadow: false, hidden: false, locked: false,
      },
      {
        type: 'flow-node',
        title: '販売済み',
        statusTarget: '販売済み',
        x: 480, y: 60, w: 140, h: 140,
        shape: 'circle', bgColor: '#fff', textColor: BRAND_COLOR, borderColor: BRAND_COLOR,
        borderWidth: 4, fontSize: 40, textAlign: 'center', alignItems: 'center',
        fontFamily: 'sans', hasShadow: true, hidden: false, locked: false,
      },
    ],
  },
  {
    name: '売上分析',
    desc: 'チャート2種 + KPI',
    emoji: '📈',
    widgets: [
      {
        type: 'kpi-total',
        title: '総台数',
        x: 40, y: 40, w: 200, h: 120,
        shape: 'rounded', bgColor: '#fff', textColor: BRAND_COLOR, borderColor: '#e2e8f0',
        borderWidth: 1, fontSize: 40, textAlign: 'center', alignItems: 'center',
        fontFamily: 'sans', hasShadow: true, hidden: false, locked: false,
      },
      {
        type: 'chart-status',
        title: 'ステータス別',
        x: 260, y: 40, w: 300, h: 220,
        shape: 'rectangle', bgColor: '#fff', textColor: '#334155', borderColor: '#6366f1',
        borderWidth: 1, fontSize: 14, textAlign: 'center', alignItems: 'center',
        fontFamily: 'sans', hasShadow: true, hidden: false, locked: false,
      },
      {
        type: 'chart-line',
        title: '日別推移',
        x: 40, y: 180, w: 200, h: 160,
        shape: 'rectangle', bgColor: '#fff', textColor: '#334155', borderColor: '#6366f1',
        borderWidth: 1, fontSize: 14, textAlign: 'center', alignItems: 'center',
        fontFamily: 'sans', hasShadow: true, hidden: false, locked: false,
      },
    ],
  },
];

interface TemplateGalleryProps {
  onSelect: (widgets: Partial<Widget>[]) => void;
  onClose: () => void;
}

export default function TemplateGallery({ onSelect, onClose }: TemplateGalleryProps) {
  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[200]"
      onPointerDown={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
        onPointerDown={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black flex items-center gap-2">
            📋 テンプレートギャラリー
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TEMPLATES.map(tpl => (
            <button
              key={tpl.name}
              onClick={() => {
                onSelect(tpl.widgets);
                onClose();
              }}
              className="text-left p-4 border border-slate-200 rounded-xl hover:border-pink-400 hover:shadow-md transition-all group"
            >
              <div className="text-2xl mb-1">{tpl.emoji}</div>
              <div className="text-sm font-bold">{tpl.name}</div>
              <div className="text-xs text-slate-500 mt-0.5">{tpl.desc}</div>
            </button>
          ))}
        </div>

        <p className="text-[10px] text-slate-400 mt-4 text-center">
          テンプレートは現在のキャンバスに追加されます
        </p>
      </div>
    </div>
  );
}