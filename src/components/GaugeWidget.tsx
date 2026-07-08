// src/components/GaugeWidget.tsx
'use client';

import React, { useEffect, useState, useMemo } from 'react';

interface GaugeWidgetProps {
  value: number;
  target: number;
  minValue?: number;
  maxValue?: number;
  previousValue?: number;
  label: string;
  unit?: string;
  showTitle?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  textColor?: string;
  fontSize?: number;
  strokeWidth?: number;
  isDarkMode?: boolean;
  colorDefault?: string;
  colorCurrent?: string;
  colorUnderTarget?: string;
  colorOverTarget?: string;
  colorTargetMarker?: string;
  colorDelta?: string;
  titleFontSize?: number;
  titleColor?: string;
  titleAlign?: 'left' | 'center' | 'right';
  titleX?: number;
  titleY?: number;
  /** 下部ラベル（実績・目標・今日）の文字サイズ（px）*/
  statsLabelFontSize?: number;
  /** 下部数値（実績・目標・今日）の文字サイズ（px）*/
  statsValueFontSize?: number;
  /** 今日の実績を表示するか */
  showTodayValue?: boolean;
  colorStops?: { percent: number; color: string }[];
}

const GaugeWidget: React.FC<GaugeWidgetProps> = ({
  value,
  target,
  minValue = 0,
  previousValue,
  label,
  unit = '',
  showTitle = true,
  textAlign = 'center',
  textColor,
  fontSize = 48,
  strokeWidth = 14,
  isDarkMode = false,
  colorDefault = '#e2e8f0',
  colorCurrent = '#10b981',
  colorUnderTarget = '#ef4444',
  colorOverTarget = '#8b5cf6',
  colorTargetMarker = '#cbd5e1',
  colorDelta = '#06b6d4',
  titleFontSize,
  titleColor,
  titleAlign,
  titleX = 0,
  titleY = 0,
  statsLabelFontSize,
  statsValueFontSize,
  showTodayValue,
  colorStops,
}) => {
  const safeTotalValue = typeof value === 'number' && !isNaN(value) ? value : 0;
  const safeTarget = typeof target === 'number' && !isNaN(target) && target > 0 ? target : 1;
  const safePrevValue = typeof previousValue === 'number' && !isNaN(previousValue) ? previousValue : safeTotalValue;

  const isIncrease = safeTotalValue > safePrevValue;
  const valPrev = isIncrease ? safePrevValue : safeTotalValue;
  const valToday = isIncrease ? safeTotalValue - safePrevValue : 0;

  const safeMaxValue = safeTarget > minValue ? minValue + (safeTarget - minValue) / 0.75 : minValue + 100;
  
  const paceData = useMemo(() => {
    // 全期間モードではペース判定を行わない（nullを返す）
    if (showTodayValue === false) return null;
    const today = new Date();
    const currentDay = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    
    const expectedPace = safeTarget * (currentDay / daysInMonth);
    const isOnPace = safeTotalValue >= expectedPace;
    const isCompleted = safeTotalValue >= safeTarget;

    return { expectedPace, isOnPace, isCompleted, currentDay, daysInMonth };
  }, [safeTarget, safeTotalValue, showTodayValue]);

  const maxRange = safeMaxValue - minValue;
  const ratioPrev = Math.max(0, Math.min((valPrev - minValue) / maxRange, 1));
  const ratioToday = Math.max(0, Math.min(valToday / maxRange, 1 - ratioPrev));
  const percent = (safeTotalValue / safeTarget) * 100;

  const [progressPrev, setProgressPrev] = useState(0);
  const [progressToday, setProgressToday] = useState(0);
  const [animatedPercent, setAnimatedPercent] = useState(0);
  const [animatedValue, setAnimatedValue] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 1200; 

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const fraction = Math.min(elapsed / duration, 1);
      const easeFraction = 1 - Math.pow(1 - fraction, 3);

      setProgressPrev(easeFraction * ratioPrev);
      setProgressToday(easeFraction * ratioToday);
      setAnimatedPercent(easeFraction * percent);
      setAnimatedValue(easeFraction * safeTotalValue);

      if (fraction < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }, [ratioPrev, ratioToday, percent, safeTotalValue]);

  let activeColor = colorCurrent;
  let statusText = 'ON TRACK';
  let statusBg = 'bg-emerald-100 text-emerald-700';

  if (paceData === null) {
    // 全期間モード：達成率に基づいて色を決定
    const pct = Math.min(200, percent);
    // デフォルトの色停止点（未設定時）
    const defaultStops = [
      { percent: 90, color: colorOverTarget || '#06b6d4' },
      { percent: 65,  color: colorCurrent || '#10b981' },
      { percent: 50,  color: colorUnderTarget || '#e66123' },
      { percent: 30,  color: colorUnderTarget || '#ef4444' },
      { percent: 0,   color: colorDefault || '#e2e8f0' },
    ];
    const stops = (colorStops && colorStops.length > 0) ? colorStops : defaultStops;
    const sorted = [...stops].sort((a, b) => b.percent - a.percent);
    for (const stop of sorted) {
      if (pct >= stop.percent) {
        activeColor = stop.color;
        break;
      }
    }
    statusText = '';
    statusBg = '';
  } else {
    if (paceData.isCompleted || safeTotalValue >= safeTarget) {
      activeColor = colorOverTarget;
      statusText = 'ACHIEVED';
      statusBg = 'bg-indigo-100 text-indigo-700';
    } else if (!paceData.isOnPace) {
      activeColor = colorUnderTarget;
      statusText = 'BEHIND';
      statusBg = 'bg-rose-100 text-rose-700';
    }
  }

  const centerX = 100;
  const centerY = 135;
  const radius = 80;
  const strokeWidthToUse = strokeWidth || 14;
  const outerRadius = radius + strokeWidthToUse - 2;

  const startX = centerX - radius; 
  const startY = centerY;          
  const endX = centerX + radius;   
  const endY = centerY;            

  const pathD = `M ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${endX} ${endY}`;
  const arcLength = Math.PI * radius;
  
  const arcPrevLength = arcLength * progressPrev;
  const arcTodayLength = arcLength * progressToday;

  const outerStartX = centerX - outerRadius;
  const outerEndX = centerX + outerRadius;
  const outerPathD = `M ${outerStartX} ${startY} A ${outerRadius} ${outerRadius} 0 0 1 ${outerEndX} ${endY}`;
  const outerArcLength = Math.PI * outerRadius;
  const isOverrun = safeTotalValue > safeMaxValue;
  const overrunRatio = isOverrun ? Math.min((safeTotalValue - safeMaxValue) / (safeMaxValue - minValue), 1) : 0;
  const overrunDashoffset = outerArcLength * (1 - overrunRatio);

  const targetRatio = 0.75; 
  const targetAngle = Math.PI + targetRatio * Math.PI; 
  const tickInner = radius - strokeWidthToUse / 2 - 4;
  const tickOuter = radius + strokeWidthToUse / 2 + 4;
  const targetX1 = centerX + tickInner * Math.cos(targetAngle);
  const targetY1 = centerY + tickInner * Math.sin(targetAngle);
  const targetX2 = centerX + tickOuter * Math.cos(targetAngle);
  const targetY2 = centerY + tickOuter * Math.sin(targetAngle);

  const paceRatio = paceData
    ? Math.max(0, Math.min((paceData.expectedPace - minValue) / (safeMaxValue - minValue), 1))
    : 0;
  const paceAngle = paceData ? Math.PI + paceRatio * Math.PI : 0;
  const paceX = paceData ? centerX + radius * Math.cos(paceAngle) : 0;
  const paceY = paceData ? centerY + radius * Math.sin(paceAngle) : 0;

  const trackStroke = isDarkMode ? 'rgba(255,255,255,0.1)' : colorDefault;
  const innerTrackStroke = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
  const baseLabelColor = isDarkMode ? '#94a3b8' : '#64748b';

  const percentFontSize = Math.min(Math.max(fontSize * 0.5, 32), 64);
  // ★ 下部ラベル・数値のフォントサイズを props から受け取り、未指定の場合は従来の計算式を使用
  const effectiveLabelFontSize = statsLabelFontSize ?? 10;
  const effectiveValueFontSize = statsValueFontSize ?? Math.min(Math.max(fontSize * 0.25, 14), 20);

  return (
    <div className="group relative w-full h-full flex items-center justify-center p-2 transition-all duration-300" style={{ fontFamily: '"Inter", "Noto Sans JP", "Hiragino Sans", "Yu Gothic UI", Meiryo, sans-serif' }}>
      
      <div className="absolute pointer-events-none opacity-0 group-hover:opacity-100 top-[calc(100%+8px)] left-1/2 -translate-x-1/2 z-50 w-56 p-3 bg-slate-900/95 text-white text-xs rounded-xl shadow-xl backdrop-blur-sm transition-all duration-300 transform scale-95 group-hover:scale-100 flex flex-col gap-1.5 border border-slate-700">
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-[6px] border-x-transparent border-b-[8px] border-b-slate-900/95"></div>
        <div className="font-semibold text-slate-200 border-b border-slate-700 pb-1 mb-1">{label || '進捗詳細'}</div>
        <div className="flex justify-between">
          <span className="text-slate-400">達成率:</span>
          <span className="font-bold text-indigo-400" style={{ fontFamily: '"Roboto", sans-serif', fontFeatureSettings: '"tnum"' }}>{percent.toFixed(1)}%</span>
        </div>
                {paceData && (
          <div className="flex justify-between">
            <span className="text-slate-400">本日の目安({paceData.currentDay}/{paceData.daysInMonth}日):</span>
            <span className="font-bold" style={{ fontFamily: '"Roboto", sans-serif', fontFeatureSettings: '"tnum"' }}>{Math.floor(paceData.expectedPace).toLocaleString()}{unit}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-slate-400">最終目標:</span>
          <span className="font-bold" style={{ fontFamily: '"Roboto", sans-serif', fontFeatureSettings: '"tnum"' }}>{safeTarget.toLocaleString()}{unit}</span>
        </div>
        <div className="flex justify-between border-t border-slate-700/60 pt-1 mt-0.5">
          <span className="text-slate-400">昨日までの実績:</span>
          <span className="font-bold" style={{ fontFamily: '"Roboto", sans-serif', fontFeatureSettings: '"tnum"' }}>{valPrev.toLocaleString()}{unit}</span>
        </div>
        {valToday > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-400">今日の実績:</span>
            <span className="font-bold" style={{ color: colorDelta, fontFamily: '"Roboto", sans-serif', fontFeatureSettings: '"tnum"' }}>
              +{valToday.toLocaleString()}{unit}
            </span>
          </div>
        )}
      </div>

      <div className="relative w-full max-w-[340px] aspect-square flex flex-col items-center justify-center">
        
        <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full select-none drop-shadow-sm">
          <defs>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity={isDarkMode ? 0.3 : 0.15} />
            </filter>
          </defs>

          <path d={pathD} fill="none" stroke={trackStroke} strokeWidth={strokeWidthToUse} strokeLinecap="round" />
          <path d={`M ${startX + 1} ${startY} A ${radius - 1} ${radius - 1} 0 0 1 ${endX - 1} ${endY}`} fill="none" stroke={innerTrackStroke} strokeWidth={1} strokeDasharray="2,6" />

          <path d={pathD} fill="none" stroke={activeColor} strokeWidth={strokeWidthToUse} strokeLinecap="round" strokeDasharray={`${arcPrevLength} ${arcLength * 2}`} strokeDashoffset={0} filter="url(#glow)" />

          {arcTodayLength > 0 && (
            <path d={pathD} fill="none" stroke={colorDelta} strokeWidth={strokeWidthToUse} strokeLinecap="round" strokeDasharray={`${arcTodayLength} ${arcLength * 2}`} strokeDashoffset={-arcPrevLength} />
          )}

          {isOverrun && <path d={outerPathD} fill="none" stroke={colorOverTarget} strokeWidth={4} strokeLinecap="round" strokeDasharray={outerArcLength} strokeDashoffset={overrunDashoffset} />}

          {paceData && paceRatio > 0 && paceRatio < 1 && (
            <g style={{ opacity: 0.6 }}>
              <circle cx={paceX} cy={paceY} r={strokeWidthToUse / 2 + 1} fill="none" stroke={textColor || (isDarkMode ? '#fff' : '#cbd5e1')} strokeWidth="1.5" strokeDasharray="1,2" />
            </g>
          )}

          {targetRatio <= 1 && (
            <g style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))' }}>
              <line x1={targetX1} y1={targetY1} x2={targetX2} y2={targetY2} stroke={colorTargetMarker} strokeWidth={3} strokeLinecap="round" />
            </g>
          )}
        </svg>

        {/* 自由配置タイトル (改行反映＆はみ出し許可) */}
        {showTitle && label && (
          <div 
            className="absolute tracking-wide font-medium opacity-80 pointer-events-none z-10" 
            style={{ 
              top: `calc(18% + ${titleY}px)`, 
              left: `calc(50% + ${titleX}px)`,
              transform: 'translateX(-50%)',
              textAlign: titleAlign || 'center',
              color: titleColor || baseLabelColor,
              fontSize: titleFontSize ? `${titleFontSize}px` : '14px',
              whiteSpace: 'pre',
              overflow: 'visible'
            }}
          >
            {label}
          </div>
        )}

        {statusText && (
          <div className="absolute top-[44%] w-full flex justify-center pointer-events-none">
            <span className={`px-2 py-0.5 text-[9px] font-black tracking-widest uppercase rounded shadow-sm ${statusBg}`}>
              {statusText}
            </span>
          </div>
        )}

        <div className="absolute top-[56%] w-full flex justify-center pointer-events-none">
          <span 
            className="font-extrabold tracking-tighter drop-shadow-sm leading-none"
            style={{ 
              fontSize: `${percentFontSize}px`, color: textColor || activeColor,
              textShadow: isDarkMode ? '0 2px 10px rgba(0,0,0,0.5)' : '0 2px 8px rgba(0,0,0,0.05)',
              fontFamily: '"Roboto", sans-serif',
              fontFeatureSettings: '"tnum"'
            }}
          >
            {animatedPercent.toFixed(1)}%
          </span>
        </div>

        <div className="absolute top-[76%] w-full flex items-center justify-center gap-4 px-6 pointer-events-none">
          <div className="flex flex-col items-center flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: baseLabelColor, fontSize: `${effectiveLabelFontSize}px` }}>実績</div>
            <span className="font-bold leading-none truncate" style={{ fontSize: `${effectiveValueFontSize}px`, color: textColor || (isDarkMode ? '#f8fafc' : '#1e293b'), fontFamily: '"Roboto", sans-serif', fontFeatureSettings: '"tnum"' }}>
              {Math.floor(animatedValue).toLocaleString()}
            </span>
          </div>

          <div className="w-px h-6 shrink-0" style={{ backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />

          <div className="flex flex-col items-center flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: baseLabelColor, fontSize: `${effectiveLabelFontSize}px` }}>目標</div>
            <span className="font-bold leading-none truncate" style={{ fontSize: `${effectiveValueFontSize}px`, color: textColor || (isDarkMode ? '#cbd5e1' : '#475569'), fontFamily: '"Roboto", sans-serif', fontFeatureSettings: '"tnum"' }}>
              {safeTarget.toLocaleString()}
            </span>
          </div>

          {showTodayValue !== false && valToday > 0 && (
            <>
              <div className="w-px h-6 shrink-0" style={{ backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
              <div className="flex flex-col items-center flex-1 min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: baseLabelColor, fontSize: `${effectiveLabelFontSize}px` }}>今日</div>
                <span className="font-bold leading-none truncate" style={{ fontSize: `${effectiveValueFontSize}px`, color: colorDelta, fontFamily: '"Roboto", sans-serif', fontFeatureSettings: '"tnum"' }}>
                  +{valToday.toLocaleString()}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GaugeWidget;