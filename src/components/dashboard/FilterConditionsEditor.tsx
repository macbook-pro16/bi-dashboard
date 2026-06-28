// src/components/dashboard/FilterConditionsEditor.tsx
'use client';

import React from 'react';
import Icons from '../Icons';
import SelectWithSearch from '../SelectWithSearch';

interface FilterCondition {
  field: string;
  value: string;
  operator?: 'eq' | 'neq' | 'empty' | 'not_empty';
  logic?: 'and' | 'or';
}

interface FilterConditionsEditorProps {
  conditions: FilterCondition[];
  allFields: string[];
  fieldUniqueValues: Record<string, string[]>; // sourceIndexごとのフィールド値
  sourceIndex: string;
  onUpdate: (newConditions: FilterCondition[]) => void;
  maxConditions?: number;
}

export default function FilterConditionsEditor({
  conditions,
  allFields,
  fieldUniqueValues,
  sourceIndex,
  onUpdate,
  maxConditions = 10,
}: FilterConditionsEditorProps) {
  const addCondition = () => {
    if (conditions.length >= maxConditions) return;
    onUpdate([...conditions, { field: '', value: '', operator: 'eq', logic: 'and' }]);
  };

  const updateCondition = (index: number, key: keyof FilterCondition, val: string) => {
    const updated = conditions.map((cond, i) => {
      if (i !== index) return cond;
      if (key === 'field') {
        return { ...cond, field: val, value: '' };
      }
      return { ...cond, [key]: val };
    });
    onUpdate(updated);
  };

  const removeCondition = (index: number) => {
    onUpdate(conditions.filter((_, i) => i !== index));
  };

  // 現在の条件で選択されているフィールドのユニーク値を取得
  const getFieldUniqueValues = (field: string) => {
    return fieldUniqueValues[field] || [];
  };

  return (
    <div className="space-y-3 pt-2 border-t border-slate-100">
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <Icons.Table className="w-4 h-4" /> クロスフィルター条件
        </label>
        <span className="text-[10px] text-slate-400">
          {conditions.length}/{maxConditions}
        </span>
      </div>

      {conditions.map((cond, idx) => (
        <div key={idx} className="space-y-1">
          <div className="flex items-center gap-1 bg-slate-50 p-2 rounded-xl border border-slate-100">
            <span className="text-xs font-bold text-slate-400 w-5 text-center shrink-0">
              #{idx + 1}
            </span>

            {/* フィールド選択 */}
            <div className="flex-1 min-w-0">
              <SelectWithSearch
                options={allFields}
                value={cond.field}
                onChange={(v) => updateCondition(idx, 'field', v)}
                placeholder="フィールド"
              />
            </div>

            {/* 演算子選択 */}
            <select
              value={cond.operator || 'eq'}
              onChange={(e) =>
                updateCondition(idx, 'operator', e.target.value as any)
              }
              className="w-16 text-[10px] border border-slate-200 rounded px-1 py-1.5 bg-white outline-none shrink-0"
            >
              <option value="eq">一致</option>
              <option value="neq">不一致</option>
              <option value="empty">空欄</option>
              <option value="not_empty">空欄以外</option>
            </select>

            {/* 値選択（演算子が eq または neq の場合のみ） */}
            {(!cond.operator || cond.operator === 'eq' || cond.operator === 'neq') && (
              <div className="flex-1 min-w-0">
                <SelectWithSearch
                  options={cond.field ? getFieldUniqueValues(cond.field) : []}
                  value={cond.value}
                  onChange={(v) => updateCondition(idx, 'value', v)}
                  placeholder="値"
                />
              </div>
            )}

            {/* 削除ボタン */}
            <button
              onClick={() => removeCondition(idx)}
              className="text-slate-400 hover:text-rose-500 p-1 bg-white rounded-md shadow-sm border border-slate-200 transition-colors shrink-0"
            >
              <Icons.X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 結合ロジック（2つ目以降の条件に表示） */}
          {idx > 0 && (
            <div className="flex items-center gap-2 ml-6">
              <span className="text-[10px] text-slate-400">結合:</span>
              <button
                onClick={() => updateCondition(idx, 'logic', 'and')}
                className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-all ${
                  (cond.logic || 'and') === 'and'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                AND
              </button>
              <button
                onClick={() => updateCondition(idx, 'logic', 'or')}
                className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-all ${
                  cond.logic === 'or'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                OR
              </button>
            </div>
          )}
        </div>
      ))}

      {conditions.length < maxConditions && (
        <button
          onClick={addCondition}
          className="w-full text-sm font-medium py-2.5 border-2 border-dashed border-slate-200 bg-slate-50 rounded-xl text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
        >
          <Icons.Plus className="w-4 h-4" /> 条件を追加（最大{maxConditions}）
        </button>
      )}
    </div>
  );
}