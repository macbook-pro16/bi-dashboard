// src/app/dashboard/page.tsx
'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo, useReducer } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import * as math from 'mathjs';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

import {
  DndContext, useDraggable, useSensor, useSensors, PointerSensor,
  DragEndEvent, DragMoveEvent, closestCenter,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { FilterProvider, useFilter } from '../../contexts/FilterContext';
import FilterPanel from '../../components/FilterPanel';
import TemplateGallery from '../../components/TemplateGallery';
import CommentPanel from '../../components/CommentPanel';
import ChartWidget from '../../components/ChartWidget';
import Minimap from '../../components/Minimap';
import { ToastProvider, useToast } from '../../components/Toast';
import SkeletonWidget from '../../components/SkeletonWidget';
import KpiWidget from '../../components/KpiWidget';
import FlowNodeWidget from '../../components/FlowNodeWidget';
import TextWidget from '../../components/TextWidget';
import TableWidget from '../../components/TableWidget';
import WidgetErrorBoundary from '../../components/WidgetErrorBoundary';
import DrilldownModal from '../../components/DrilldownModal';
import GaugeWidget from '../../components/GaugeWidget';
import TextBlockWidget from '../../components/TextBlockWidget';
import OutlineWidget from '../../components/OutlineWidget';
import ComparisonWidget from '../../components/ComparisonWidget';
import {
  Widget, WidgetType, ShapeType, DBItem, CacheStore,
  GuideLine, DistanceLabel, WidgetComment, AlertRule, DashboardPage, DataConfig, Annotation
} from '../../types';
import { DEFAULT_FILTER_DATE_RANGE } from '../../constants';
import { useTheme } from '../../contexts/ThemeContext';
import Icons from '../../components/Icons';
import AppLogo from '../../components/AppLogo';
import {
  BRAND_COLOR,
  SCHEMA_VERSION,
  ARTBOARD_WIDTH,
  ARTBOARD_HEIGHT,
  defaultDataConfig,
  stripFormula,
  safeBase64Encode,
  safeBase64Decode,
  migrateChartTypes,
  migrateDashboardData,
  formatLocalDate,
  resolveDateFilterField,
  extractStringValue,
  isUuid,
  isRelationField,
  evaluateConditions
} from '../../utils/dashboardUtils';
import { renderWidgetContent } from '../../components/dashboard/renderWidgetContent';
import SignageView from '../../components/dashboard/SignageView';
import CanvasWidget from '../../components/dashboard/CanvasWidget';
import SelectWithSearch from '../../components/SelectWithSearch';
import ActiveFilterBar from '../../components/dashboard/ActiveFilterBar';
import LayerRow from '../../components/dashboard/LayerRow';
import DashboardPageList from '../../components/dashboard/DashboardPageList';
import AiSummaryModal from '../../components/dashboard/AiSummaryModal';
import AiChatTab from '../../components/dashboard/AiChatTab';
import FilterConditionsEditor from '../../components/dashboard/FilterConditionsEditor';
import { getOrthogonalPath, getRoutePath, getMarkerDefs } from '../../utils/annotationUtils';

const DATABASE_CONFIG = [
  { index: '001', name: '車両一覧' },
  { index: '001_prev', name: '車両一覧(昨日)' },
  { index: '002', name: '受付表' },
  { index: '003', name: 'タスク' },
  { index: '004', name: '部品発注一覧' },
  { index: '005', name: '顧客DB' },
  { index: '006', name: '目標数値' },
  { index: 'wp_inventory', name: '在庫車両 (WP)' },
  { index: 'wp_inventory_without_photo', name: '在庫車両 写真なし (WP)' },
];

const DEFAULT_PAGE: DashboardPage = {
  id: 'page_1', name: 'デフォルト',
  layout: [
    {
      id:'s1', type:'scorecard', title:'データ件数',
      x:200, y:150, w:520, h:320,
      shape:'rounded', bgColor:'#ffffff', textColor:BRAND_COLOR,
      borderColor:'#e2e8f0', borderWidth:2, fontSize:96,
      textAlign:'center', fontFamily:'sans', hasShadow:true, hidden:false, locked:false,
      showTitle: true, bgAlpha: 1,
      dataConfig: defaultDataConfig('scorecard')
    },
  ],
  annotations: [],
  includeInSignage: true,
};

type DashboardAction =
  | { type: 'SET_DASHBOARDS', payload: DashboardPage[] }
  | { type: 'ADD_PAGE', payload: DashboardPage }
  | { type: 'DELETE_PAGE', payload: number }
  | { type: 'RENAME_PAGE', payload: { index: number; name: string } }
  | { type: 'SET_ACTIVE_PAGE', payload: number }
  | { type: 'UPDATE_LAYOUT', payload: Widget[] }
  | { type: 'UPDATE_ANNOTATIONS', payload: Annotation[] }
  | { type: 'COMMIT_STATE', payload: { layout: Widget[]; annotations: Annotation[] } }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'TOGGLE_PAGE_SIGNAGE', payload: number }
  | { type: 'TOGGLE_PAGE_PUBLISHED', payload: string }
  | { type: 'REORDER_PAGES', payload: DashboardPage[] };

interface PageState {
  layout: Widget[];
  annotations: Annotation[];
}

function dashboardReducer(
  state: { dashboards: DashboardPage[]; activePageIndex: number; history: PageState[]; future: PageState[] },
  action: DashboardAction
): typeof state {
  switch (action.type) {
    case 'SET_DASHBOARDS':
      return { ...state, dashboards: action.payload, activePageIndex: 0, history: [], future: [] };
    case 'ADD_PAGE':
      return { ...state, dashboards: [...state.dashboards, action.payload], activePageIndex: state.dashboards.length, history: [], future: [] };
    case 'DELETE_PAGE': {
      if (state.dashboards.length <= 1) return state;
      const next = state.dashboards.filter((_, i) => i !== action.payload);
      const nextIdx = state.activePageIndex >= action.payload ? Math.max(0, state.activePageIndex - 1) : state.activePageIndex;
      return { ...state, dashboards: next, activePageIndex: nextIdx, history: [], future: [] };
    }
    case 'RENAME_PAGE':
      return { ...state, dashboards: state.dashboards.map((p, i) => i === action.payload.index ? { ...p, name: action.payload.name } : p) };
    case 'SET_ACTIVE_PAGE':
      return { ...state, activePageIndex: action.payload, history: [], future: [] };
    case 'UPDATE_LAYOUT':
      return { ...state, dashboards: state.dashboards.map((p, i) => i === state.activePageIndex ? { ...p, layout: action.payload } : p) };
    case 'UPDATE_ANNOTATIONS':
      return { ...state, dashboards: state.dashboards.map((p, i) => i === state.activePageIndex ? { ...p, annotations: action.payload } : p) };
    case 'COMMIT_STATE': {
      const currentPage = state.dashboards[state.activePageIndex];
      const prevState: PageState = { layout: currentPage?.layout ?? [], annotations: currentPage?.annotations ?? [] };
      return {
        ...state,
        dashboards: state.dashboards.map((p, i) => i === state.activePageIndex ? { ...p, layout: action.payload.layout, annotations: action.payload.annotations } : p),
        history: [...state.history.slice(-20), prevState],
        future: [],
      };
    }
    case 'UNDO': {
      if (state.history.length === 0) return state;
      const prev = state.history[state.history.length - 1];
      const currentPage = state.dashboards[state.activePageIndex];
      const currState: PageState = { layout: currentPage?.layout ?? [], annotations: currentPage?.annotations ?? [] };
      return {
        ...state,
        dashboards: state.dashboards.map((p, i) => i === state.activePageIndex ? { ...p, layout: prev.layout, annotations: prev.annotations } : p),
        history: state.history.slice(0, -1),
        future: [currState, ...state.future],
      };
    }
    case 'REDO': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      const currentPage = state.dashboards[state.activePageIndex];
      const currState: PageState = { layout: currentPage?.layout ?? [], annotations: currentPage?.annotations ?? [] };
      return {
        ...state,
        dashboards: state.dashboards.map((p, i) => i === state.activePageIndex ? { ...p, layout: next.layout, annotations: next.annotations } : p),
        history: [...state.history, currState],
        future: state.future.slice(1),
      };
    }
    case 'TOGGLE_PAGE_SIGNAGE':
      return {
        ...state,
        dashboards: state.dashboards.map((p, i) =>
          i === action.payload ? { ...p, includeInSignage: p.includeInSignage === false ? true : false } : p
        ),
      };
        case 'TOGGLE_PAGE_PUBLISHED':
      return {
        ...state,
        dashboards: state.dashboards.map((p) =>
          p.id === action.payload ? { ...p, published: p.published === false ? true : false } : p
        ),
      };
      case 'REORDER_PAGES':
      return { ...state, dashboards: action.payload };
    default: return state;
  }
}

function findWidgetById(widgets: Widget[], id: string): Widget | undefined {
  for (const w of widgets) {
    if (w.id === id) return w;
    if (w.children) {
      const found = findWidgetById(w.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

function updateWidgetById(widgets: Widget[], id: string, updater: (w: Widget) => Widget): Widget[] {
  return widgets.map(w => {
    if (w.id === id) return updater(w);
    if (w.children) {
      return { ...w, children: updateWidgetById(w.children, id, updater) };
    }
    return w;
  });
}

function removeWidgetById(widgets: Widget[], id: string): Widget[] {
  return widgets
    .filter(w => w.id !== id)
    .map(w => {
      if (w.children) {
        return { ...w, children: removeWidgetById(w.children, id) };
      }
      return w;
    });
}

type DashboardMode = 'view' | 'edit' | 'signage';

function DashboardInner() {
  const { data: session, status } = useSession();
  const userRole = session?.user?.role || 'viewer';
  const canEdit = userRole === 'admin' || userRole === 'editor';
  const isAdmin = userRole === 'admin';

  const router = useRouter();
  const { filters, updateDateRange, applyFilters, toggleCrossFilter, setCrossFilterValues } = useFilter();
  const { addToast } = useToast();
  const { colors } = useTheme();

  const [cacheStore, setCacheStore] = useState<CacheStore>({});
  const [loadingAll, setLoadingAll] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState({ loaded: 0, total: DATABASE_CONFIG.length });

  const [mode, setMode] = useState<DashboardMode>('view');
  const [rightTab, setRightTab] = useState<'layers'|'properties'>('properties');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<Widget[]>([]);
  const [styleClipboard, setStyleClipboard] = useState<any>(null);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(userRole === 'admin' || userRole === 'editor');
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({x:0,y:0});
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [lasso, setLasso] = useState<{startX:number,startY:number,x:number,y:number,w:number,h:number}|null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [enableSnap, setEnableSnap] = useState(true);
  const [guideLines, setGuideLines] = useState<GuideLine[]>([]);
  const [distanceLabels, setDistanceLabels] = useState<DistanceLabel[]>([]);
  const [ctxMenu, setCtxMenu] = useState<{id:string,x:number,y:number}|null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(300000);
  const [aiSummary, setAiSummary] = useState('');
  const [showAiSummary, setShowAiSummary] = useState(false);
  const [drilldown, setDrilldown] = useState<{
  field: string;
  value: string;
  widgetTitle: string;
  data?: any[];
  columns?: string[];
  images?: string[];  // ★ 追加
} | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [showAiDrawer, setShowAiDrawer] = useState(false);
  const [canvasBgColor, setCanvasBgColor] = useState('#ffffff');
  const [dbLoaded, setDbLoaded] = useState(false);

  const [confirmState, setConfirmState] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [titleEditWidgetId, setTitleEditWidgetId] = useState<string | null>(null);
  const [titleEditValue, setTitleEditValue] = useState('');

  const [editModeFlash, setEditModeFlash] = useState(false);
  useEffect(() => {
    if (mode === 'edit') {
      setEditModeFlash(true);
      const timer = setTimeout(() => setEditModeFlash(false), 400);
      return () => clearTimeout(timer);
    }
  }, [mode]);

  const [isArrowMode, setIsArrowMode] = useState(false);
  const [arrowDraft, setArrowDraft] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [selectedAnnotationIds, setSelectedAnnotationIds] = useState<string[]>([]);
  const [draggingEndpoint, setDraggingEndpoint] = useState<{ annId: string; point: 'start' | 'end' } | null>(null);

  const [signageInterval, setSignageInterval] = useState(30000);
  useEffect(() => {
    const saved = localStorage.getItem('bi-signage-interval');
    if (saved) setSignageInterval(Number(saved));
  }, []);
  useEffect(() => {
    localStorage.setItem('bi-signage-interval', String(signageInterval));
  }, [signageInterval]);

  const [excludeInput, setExcludeInput] = useState('');

  const [state, dispatch] = useReducer(dashboardReducer, {
    dashboards: [DEFAULT_PAGE],
    activePageIndex: 0,
    history: [],
    future: [],
  });
    const { dashboards, activePageIndex } = state;

  const layout = dashboards[activePageIndex]?.layout ?? [];
  const annotations = dashboards[activePageIndex]?.annotations ?? [];

  const moveWidgets = useCallback((newLayout: Widget[]) => dispatch({ type:'UPDATE_LAYOUT', payload: newLayout }), []);
  const editWidgets = useCallback((newLayout: Widget[]) => dispatch({ type:'COMMIT_STATE', payload: { layout: newLayout, annotations } }), [annotations]);

  const updateAnnotations = useCallback((newAnns: Annotation[]) => dispatch({ type:'UPDATE_ANNOTATIONS', payload: newAnns }), []);
  const commitAnnotations = useCallback((newAnns: Annotation[]) => dispatch({ type:'COMMIT_STATE', payload: { layout, annotations: newAnns } }), [layout]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [status]);

  useEffect(() => {
    if (status !== 'authenticated') return;

    const load = async () => {
      try {
        const res = await fetch('/api/dashboard/load');
        if (!res.ok) return;
        const data = await res.json();
        if (data.dashboards && data.dashboards.length > 0) {
          const migrated = migrateDashboardData(data.dashboards.map((page: any) => ({
            id: page.id || `page_${Date.now()}`,
            name: page.name || '無題',
            layout: stripFormula(page.layout || []),
            annotations: page.annotations || [],
            includeInSignage: page.includeInSignage,
            published: page.published, // ★ 追加：DBに保存された公開状態を読み込み時に保持する
          })), SCHEMA_VERSION);
          dispatch({
            type: 'SET_DASHBOARDS',
            payload: migrated,
          });
        }
        if (data.canvasBgColor) {
          setCanvasBgColor(data.canvasBgColor);
        }
      } catch (e) {
        console.error('読み込み失敗', e);
      } finally {
        setDbLoaded(true);
      }
    };

    load();
  }, [status]);

  useEffect(() => {
    if (!isMounted || !dbLoaded || status !== 'authenticated') return;

    const timer = setTimeout(async () => {
      try {
        await fetch('/api/dashboard/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dashboards: dashboards.map(page => ({
              id: page.id,
              name: page.name,
              layout: page.layout ?? [],
              annotations: page.annotations ?? [],
              includeInSignage: page.includeInSignage,
              published: page.published, // ★ 追加：非公開状態を保存対象に含める
            })),
            canvasBgColor,
          }),
        });
      } catch (e) {
        console.error('保存失敗', e);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [dashboards, isMounted, dbLoaded, status, canvasBgColor]);

  const addToastRef = useRef(addToast); useEffect(() => { addToastRef.current = addToast; }, [addToast]);

  // ★ 共有機能の無効化に伴い、?layout= URLパラメータからのレイアウト読み込み処理も削除
  //   （これが残っていると、外部から任意のレイアウトJSONを注入されてしまうため）

  const canvasSensors = useSensors(useSensor(PointerSensor,{activationConstraint:{distance:8}}));
  const layerSensors = useSensors(useSensor(PointerSensor,{activationConstraint:{distance:8}}));

  const handleWidgetDoubleClick = useCallback((id:string)=>{ if(mode==='edit'){ setSelectedIds([id]); setRightTab('properties'); } },[mode]);

  const handleGroup = useCallback(()=>{ if(mode!=='edit'||selectedIds.length<2)return; const sels=layout.filter(w=>selectedIds.includes(w.id)); const minX=Math.min(...sels.map(w=>w.x)),minY=Math.min(...sels.map(w=>w.y)),maxX=Math.max(...sels.map(w=>w.x+w.w)),maxY=Math.max(...sels.map(w=>w.y+w.h)); const children=sels.map(w=>({...w,x:w.x-minX,y:w.y-minY})); const g:Widget={ id:`group_${Date.now()}`,type:'group',title:'新規グループ',x:minX,y:minY,w:maxX-minX,h:maxY-minY,children,shape:'rectangle',bgColor:'transparent',textColor:'#0f172a',borderColor:'#e2e8f0',borderWidth:0,fontSize:48,textAlign:'center',fontFamily:'sans',hasShadow:false,hidden:false,locked:false,showTitle:true,bgAlpha:1, hideChildrenBorders: false }; editWidgets([...layout.filter(w=>!selectedIds.includes(w.id)),g]); setSelectedIds([g.id]);setRightTab('layers'); },[selectedIds,layout,editWidgets,mode]);
  const handleUngroup = useCallback(()=>{ if(mode!=='edit')return; const nl=[...layout];const ta:Widget[]=[],tr:string[]=[]; layout.forEach(w=>{if(selectedIds.includes(w.id)&&w.type==='group'&&w.children){w.children.forEach(c=>ta.push({...c,x:c.x+w.x,y:c.y+w.y}));tr.push(w.id);}}); if(!tr.length)return; editWidgets([...nl.filter(w=>!tr.includes(w.id)),...ta]); setSelectedIds(ta.map(a=>a.id)); },[selectedIds,layout,editWidgets,mode]);

  const handleConvertToSlideshow = useCallback(()=>{
    if(mode!=='edit'||selectedIds.length<2)return;
    const sels=layout.filter(w=>selectedIds.includes(w.id));
    const minX=Math.min(...sels.map(w=>w.x)),minY=Math.min(...sels.map(w=>w.y)),maxX=Math.max(...sels.map(w=>w.x+w.w)),maxY=Math.max(...sels.map(w=>w.y+w.h));
    const children=sels.map(w=>({...w,x:w.x-minX,y:w.y-minY}));
    const ss:Widget={
      id:`slideshow_${Date.now()}`,type:'slideshow',title:'スライドショー',x:minX,y:minY,w:maxX-minX,h:maxY-minY,children,shape:'rectangle',bgColor:'transparent',textColor:'#0f172a',borderColor:'#e2e8f0',borderWidth:0,fontSize:48,textAlign:'center',fontFamily:'sans',hasShadow:false,hidden:false,locked:false,showTitle:true,bgAlpha:1,
      dataConfig: defaultDataConfig('slideshow')
    };
    editWidgets([...layout.filter(w=>!selectedIds.includes(w.id)),ss]);
    setSelectedIds([ss.id]);setRightTab('layers');
  },[selectedIds,layout,editWidgets,mode]);

  const handleChildSelect = useCallback((childId: string) => {
    setSelectedIds([childId]);
    setSelectedAnnotationIds([]);
  }, []);

  useEffect(()=>{
    const kd=(e:KeyboardEvent)=>{
      if(e.code==='Space'&&e.target instanceof HTMLElement&&e.target.tagName!=='INPUT'&&e.target.tagName!=='TEXTAREA'){e.preventDefault();setIsSpacePressed(true);}
      if(e.key==='Escape'){
        if(mode==='signage'){ setMode('view'); return; }
        if(showAiDrawer){ setShowAiDrawer(false); return; }
        if(showShortcuts){ setShowShortcuts(false); return; }
        if(ctxMenu){ setCtxMenu(null); return; }
      }
      if (mode === 'edit' && selectedAnnotationIds.length > 0 && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement) && !(e.target instanceof HTMLSelectElement)) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const step = e.shiftKey ? 1 : 20;
          const updated = annotations.map(ann => {
            if (!selectedAnnotationIds.includes(ann.id)) return ann;
            if (e.shiftKey && selectedAnnotationIds.length === 1) {
              const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
              const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
              return { ...ann, x2: ann.x2 + dx, y2: ann.y2 + dy };
            } else {
              const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
              const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
              return { ...ann, x1: ann.x1 + dx, y1: ann.y1 + dy, x2: ann.x2 + dx, y2: ann.y2 + dy };
            }
          });
          commitAnnotations(updated);
          return;
        }
      }
      if (mode === 'edit' && selectedIds.length > 0 && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement) && !(e.target instanceof HTMLSelectElement)) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const step = e.shiftKey ? 1 : 20;
          editWidgets(layout.map(w => {
            if (!selectedIds.includes(w.id)) return w;
            const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
            const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
            return { ...w, x: Math.max(0, w.x + dx), y: Math.max(0, w.y + dy) };
          }));
          return;
        }
      }
      if(mode!=='edit'||(e.target instanceof HTMLInputElement)||(e.target instanceof HTMLTextAreaElement)){ if(e.key==='F1'&&!e.ctrlKey&&!e.metaKey){ e.preventDefault(); setShowShortcuts(s=>!s); } return; }
      if(e.ctrlKey||e.metaKey){
        if(e.key==='g'){e.preventDefault(); if(e.shiftKey)handleUngroup(); else handleGroup();}
        if(e.key==='c') setClipboard(layout.filter(w=>selectedIds.includes(w.id)));
        if(e.key==='v' && clipboard.length>0){ const pasted=clipboard.map(w=>({...w,id:`p_${Date.now()}_${Math.random()}`,x:w.x+20,y:w.y+20})); editWidgets([...layout,...pasted]); setSelectedIds(pasted.map(p=>p.id)); }
        if(e.key==='z'&&!e.shiftKey) {
          dispatch({ type:'UNDO' });
        }
        if((e.key==='y'||(e.key==='z'&&e.shiftKey))) {
          dispatch({ type:'REDO' });
        }
      }
      if(e.key==='F1'&&!e.ctrlKey&&!e.metaKey){ e.preventDefault(); setShowShortcuts(s=>!s); }
      if((e.key==='Delete'||e.key==='Backspace')&&selectedIds.length>0){
        editWidgets(selectedIds.reduce((acc, id) => removeWidgetById(acc, id), layout));
        setSelectedIds([]);
        addToastRef.current('ウィジェットを削除しました（Ctrl+Zで元に戻す）', 'info');
      }
      if((e.key==='Delete'||e.key==='Backspace') && selectedAnnotationIds.length > 0) {
        commitAnnotations(annotations.filter(a => !selectedAnnotationIds.includes(a.id)));
        setSelectedAnnotationIds([]);
        addToastRef.current('矢印を削除しました（Ctrl+Zで元に戻す）', 'info');
      }
    };
    const ku=(e:KeyboardEvent)=>{if(e.code==='Space')setIsSpacePressed(false);};
    window.addEventListener('keydown',kd); window.addEventListener('keyup',ku);
    return()=>{window.removeEventListener('keydown',kd);window.removeEventListener('keyup',ku);};
  },[mode,layout,selectedIds,clipboard,handleGroup,handleUngroup,editWidgets,showAiDrawer,selectedAnnotationIds,annotations,commitAnnotations,showShortcuts,ctxMenu]);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [ctxMenu]);

  const [viewportSize,setViewportSize]=useState({w:800,h:600});
  useEffect(()=>{
    const obs=new ResizeObserver(entries=>{
      const{width,height}=entries[0].contentRect;
      setViewportSize({w:width,h:height});
    });
    if(wrapperRef.current)obs.observe(wrapperRef.current);
    return()=>obs.disconnect();
  },[]);

  const fitToAll = useCallback(() => {
    const scaleX = viewportSize.w / ARTBOARD_WIDTH;
    const scaleY = viewportSize.h / ARTBOARD_HEIGHT;
    const newZoom = Math.min(scaleX, scaleY, 1.5);
    setZoom(newZoom);
    setPan({
      x: (viewportSize.w - ARTBOARD_WIDTH * newZoom) / 2,
      y: (viewportSize.h - ARTBOARD_HEIGHT * newZoom) / 2,
    });
  }, [viewportSize]);

  useEffect(() => { fitToAll(); }, [fitToAll]);

  const zoomIn = useCallback(() => setZoom(prev => Math.min(3, prev + 0.1)), []);
  const zoomOut = useCallback(() => setZoom(prev => Math.max(0.25, prev - 0.1)), []);

  useEffect(()=>{
    const el=wrapperRef.current; if(!el)return;
    const wh=(e:WheelEvent)=>{
      if(!e.ctrlKey&&!e.metaKey)return;
      e.preventDefault();
      const rect=wrapperRef.current!.getBoundingClientRect();
      const mx=e.clientX-rect.left,my=e.clientY-rect.top;
      setZoom(p=>{
        const nz=Math.min(Math.max(0.25,p-e.deltaY*0.005),3);
        const d=nz-p;
        setPan(pp=>({x:pp.x-mx*d,y:pp.y-my*d}));
        return nz;
      });
    };
    el.addEventListener('wheel',wh,{passive:false});
    return()=>el.removeEventListener('wheel',wh);
  },[]);

  const fetchAllDatabases = useCallback(async (silent = false) => {
    if(!silent) {
      setLoadingAll(true);
      setLoadingProgress({ loaded: 0, total: DATABASE_CONFIG.length });
    }
    const nc: CacheStore = {};
    let hasError = false;

    const results = await Promise.allSettled(
      DATABASE_CONFIG.map(async (c) => {
        try {
          const apiPath = c.index.startsWith('wp_')
            ? `/api/wordpress?type=${c.index.replace('wp_', '')}`
            : `/api/notion?index=${c.index}`;
          const res = await fetch(apiPath, { credentials: 'include' });
          if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          const d = await res.json();
          if (!d.success) throw new Error(d.error || 'unknown error');
          return { index: c.index, data: d.data || [] };
        } catch (e: any) {
          console.error(`Failed to fetch ${c.index}:`, e);
          if (!silent && addToastRef.current) {
            addToastRef.current(`[${c.name}] 取得エラー: ${e.message || '不明なエラー'}`, 'error');
          }
          return { index: c.index, data: [] };
        }
      })
    );

    results.forEach((result, i) => {
      const c = DATABASE_CONFIG[i];
      if (result.status === 'fulfilled') {
        nc[result.value.index] = result.value.data;
      }
      if (!silent) setLoadingProgress(prev => ({ ...prev, loaded: prev.loaded + 1 }));
    });

    if (Object.keys(nc).length > 0) {
      setCacheStore(prev => ({ ...prev, ...nc }));
    }
    if (!silent) setLoadingAll(false);
  }, []);

  useEffect(()=>{if(status==='authenticated')fetchAllDatabases(false);},[status,fetchAllDatabases]);
  useEffect(()=>{ if(refreshInterval<=0)return; const iv=setInterval(()=>fetchAllDatabases(true),refreshInterval); return()=>clearInterval(iv); },[refreshInterval,fetchAllDatabases]);

      const usedSources = useMemo(() =>
    [...new Set([
      ...layout.map(w => w.dataConfig?.sourceIndex || w.dataSourceIndex || '001'),
      ...layout.map(w => w.dataConfig?.barSourceIndex).filter(Boolean) as string[],
      ...layout.map(w => w.dataConfig?.lineSourceIndex).filter(Boolean) as string[],
      'wp_inventory', // ★ 追加
    ])],
    [layout]
  );

  const filteredDataByIndex = useMemo(()=>{
    const m:Record<string,DBItem[]>={};
    for(const idx of usedSources) m[idx]=applyFilters(cacheStore[idx]||[]);
    return m;
  },[cacheStore,applyFilters,usedSources]);

  const todayStr = formatLocalDate(new Date());
  const activeFilteredData=filteredDataByIndex['001']||[];
  const todayActionCount=useMemo(()=>activeFilteredData.filter(i=>i.date===todayStr).length,[activeFilteredData, todayStr]);
  const statusCounts=useMemo(()=>activeFilteredData.reduce((acc,i)=>{acc[i.status]=(acc[i.status]||0)+1;return acc;},{} as Record<string,number>),[activeFilteredData]);

  const applyGlobalNonDateFilters = useCallback((data: DBItem[]) => {
    return data.filter(item => {
      if (filters.statuses.length > 0 && !filters.statuses.includes(item.status)) return false;
      for (const field of Object.keys(filters.crossFilters)) {
        const values = filters.crossFilters[field];
        if (values && values.length > 0) {
          const val = extractStringValue(item[field]);
          if (!values.includes(val)) return false;
        }
      }
      return true;
    });
  }, [filters.statuses, filters.crossFilters]);

  const handleDiffFilter = useCallback((ids: string[], label: string) => {
    setCrossFilterValues('id', ids);
    addToastRef.current(`${label} (${ids.length}件) でフィルターしました`, 'info');
  }, [setCrossFilterValues]);

  const availableFieldsBySource = useMemo(()=>{ const m:Record<string,string[]>={}; for(const idx of Object.keys(cacheStore)) m[idx]=cacheStore[idx]?.length?Object.keys(cacheStore[idx][0]).filter(k=>k!=='id'):[]; return m; },[cacheStore]);
  const numericFieldsBySource = useMemo(()=>{ const m:Record<string,string[]>={}; for(const idx of Object.keys(cacheStore)) m[idx]=cacheStore[idx]?.length?Object.keys(cacheStore[idx][0]).filter(k=>typeof cacheStore[idx][0][k]==='number'):[]; return m; },[cacheStore]);

  const relationFieldsBySource = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    for (const idx of Object.keys(cacheStore)) {
      const data = cacheStore[idx] || [];
      const fields = availableFieldsBySource[idx] || [];
      const relationFields = new Set(fields.filter(f => isRelationField(data, f)));
      m[idx] = relationFields;
    }
    return m;
  }, [cacheStore, availableFieldsBySource]);

  const fieldUniqueValuesBySource = useMemo(() => {
    const result: Record<string, Record<string, string[]>> = {};
    for (const idx of Object.keys(cacheStore)) {
      const data = cacheStore[idx] || [];
      const fields = availableFieldsBySource[idx] || [];
      const fieldMap: Record<string, Set<string>> = {};
      for (const f of fields) {
        const uniqueSet = new Set<string>();
        for (const item of data) {
          const raw = item[f];
          const str = extractStringValue(raw);
          if (str && str !== '' && str !== 'undefined' && str !== '[object Object]') {
            uniqueSet.add(str);
          }
        }
        fieldMap[f] = uniqueSet;
      }
      const entry: Record<string, string[]> = {};
      for (const [f, set] of Object.entries(fieldMap)) {
        entry[f] = Array.from(set);
      }
      result[idx] = entry;
    }
    return result;
  }, [cacheStore, availableFieldsBySource]);

  const dateFieldsBySource = useMemo(()=>{ const m:Record<string,string[]>={}; for(const idx of Object.keys(cacheStore)){ const fields = availableFieldsBySource[idx]||[]; const data = cacheStore[idx]||[]; m[idx] = fields.filter(f => data.some(item => /^\d{4}-\d{2}-\d{2}/.test(extractStringValue(item[f])))); } return m; },[cacheStore,availableFieldsBySource]);

  const widgetFilteredData = useMemo(() => {
    const map: Record<string, DBItem[]> = {};
    layout.forEach(w => {
      const dc = w.dataConfig as DataConfig | undefined;
      if (!dc || w.type !== 'table-details') return;
      const srcIdx = dc.sourceIndex || w.dataSourceIndex || '001';
      const allSrc = cacheStore[srcIdx] || [];
      const dateField = resolveDateFilterField(w);
      const dateFilter = dc.dateFilter ?? 'range';
      const { start, end } = filters.dateRange;

      let baseData = allSrc;
      if (dateFilter === 'range') {
        baseData = allSrc.filter(item => {
          const d = item[dateField];
          if (!d) return false;
          return d >= start && d <= end;
        });
      } else if (dateFilter === 'today') {
        baseData = allSrc.filter(item => item[dateField] === todayStr);
      }

      const conditions = dc.filterConditions || [];
      const logic = dc.conditionLogic || 'and';

      map[w.id] = baseData.filter(item => {
        const passCross = evaluateConditions(item, conditions, logic);
        const passIndicator = (() => {
          if (!dc.field) return true;
          const val = extractStringValue(item[dc.field]);
          if (dc.filterOperator === 'empty') return !val || val === '' || val === 'undefined';
          if (dc.filterOperator === 'not_empty') return !!val && val !== '' && val !== 'undefined';
          if (!dc.filterValue) return true;
          if (dc.filterOperator === 'neq') return val !== dc.filterValue;
          return val === dc.filterValue;
        })();
        return passCross && passIndicator;
      });
    });
    return map;
  }, [layout, cacheStore, filters.dateRange, todayStr, evaluateConditions, applyGlobalNonDateFilters]);

  const allWidgetValues = useMemo(() => {
    const map: Record<string, number> = {};
    dashboards.forEach(page => {
      (page.layout ?? []).forEach(w => {
        const dc = w.dataConfig as DataConfig | undefined;
        if (!dc) return;
        const srcIdx = dc.sourceIndex || w.dataSourceIndex || '001';
        const allSrc = cacheStore[srcIdx] || [];
        const dateField = resolveDateFilterField(w);
        let val: number | undefined;

        if (w.type === 'scorecard' || w.type === 'gauge') {
          const dateFilter = dc.dateFilter ?? 'range';
          const { start, end } = filters.dateRange;

          let baseData = allSrc;
          if (dateFilter === 'range') {
            baseData = allSrc.filter(item => {
              const d = item[dateField];
              if (!d) return false;
              return d >= start && d <= end;
            });
          } else if (dateFilter === 'today') {
            baseData = allSrc.filter(item => item[dateField] === todayStr);
          }

          const crossFiltered = applyGlobalNonDateFilters(baseData);

          const conditions = dc.filterConditions || [];
          const logic = dc.conditionLogic || 'and';

          const filteredByConditions = crossFiltered.filter(item => {
            const passCross = evaluateConditions(item, conditions, logic);
            const passIndicator = (() => {
              if (!dc.field) return true;
              const val = extractStringValue(item[dc.field!]);
              if (dc.filterOperator === 'empty') return !val || val === '' || val === 'undefined';
              if (dc.filterOperator === 'not_empty') return !!val && val !== '' && val !== 'undefined';
              if (!dc.filterValue) return true;
              if (dc.filterOperator === 'neq') return val !== dc.filterValue;
              return val === dc.filterValue;
            })();
            return passCross && passIndicator;
          });

          if (dc.field) {
            const agg = dc.aggregation ?? (w.type === 'gauge' ? 'sum' : undefined);
            const values = filteredByConditions.map(item => Number(item[dc.field!]) || 0).filter(v => v !== 0);
            if (agg === 'sum') val = values.reduce((a, b) => a + b, 0);
            else if (agg === 'avg') val = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
            else if (agg === 'max') val = Math.max(...values, 0);
            else if (agg === 'min') val = Math.min(...values, 0);
            else val = filteredByConditions.length;
          } else {
            val = filteredByConditions.length;
          }
        } else if (w.type.startsWith('kpi-')) {
          const dateFilter = dc.dateFilter ?? (w.type === 'kpi-today' ? 'today' : 'range');
          const baseData =
            dateFilter === 'none'  ? allSrc :
            dateFilter === 'today' ? allSrc.filter(d => d[dateField] === todayStr) :
                                     allSrc;
          const crossFiltered = applyGlobalNonDateFilters(baseData);

          const conditions = dc.filterConditions || [];
          const logic = dc.conditionLogic || 'and';
          const filteredByConditions = crossFiltered.filter(item => {
            const passCross = evaluateConditions(item, conditions, logic);
            const passIndicator = (() => {
              if (!dc.field) return true;
              const val = extractStringValue(item[dc.field!]);
              if (dc.filterOperator === 'empty') return !val || val === '' || val === 'undefined';
              if (dc.filterOperator === 'not_empty') return !!val && val !== '' && val !== 'undefined';
              if (!dc.filterValue) return true;
              if (dc.filterOperator === 'neq') return val !== dc.filterValue;
              return val === dc.filterValue;
            })();
            return passCross && passIndicator;
          });

          const field = dc.field ?? w.kpiField;
          if (!field || field === 'count') {
            val = filteredByConditions.length;
          } else {
            const sum = filteredByConditions.reduce((acc, item) => acc + (Number(item[field]) || 0), 0);
            const agg = dc.aggregation ?? w.kpiAggregation ?? 'sum';
            val = agg === 'avg' ? (filteredByConditions.length ? sum / filteredByConditions.length : 0)
                : agg === 'max' ? Math.max(...filteredByConditions.map(i => Number(i[field]) || 0))
                : agg === 'min' ? Math.min(...filteredByConditions.map(i => Number(i[field]) || 0))
                : sum;
          }
        } else if (w.type === 'flow-node') {
          const field = dc.filterField ?? w.targetField ?? 'status';
          const value = dc.filterValue ?? w.statusTarget ?? '';
          val = allSrc.filter(item => extractStringValue(item[field]) === value).length;
        }
        if (val !== undefined) map[w.id] = Math.round(val);
      });
    });
    return map;
  }, [dashboards, cacheStore, filters, todayStr, evaluateConditions, applyGlobalNonDateFilters]);

  const computedValues = useMemo(() => {
    const map: Record<string, number> = {};
    layout.forEach(w => {
      const dc = w.dataConfig as DataConfig | undefined;
      if (!dc) return;
      const srcIdx = dc.sourceIndex || w.dataSourceIndex || '001';
      const allSrc = cacheStore[srcIdx] || [];
      const dateField = resolveDateFilterField(w);
      let val: number | undefined;

      if (w.type === 'scorecard' || w.type === 'gauge') {
        const dateFilter = dc.dateFilter ?? 'range';
        const { start, end } = filters.dateRange;

        let baseData = allSrc;
        if (dateFilter === 'range') {
          baseData = allSrc.filter(item => {
            const d = item[dateField];
            if (!d) return false;
            return d >= start && d <= end;
          });
        } else if (dateFilter === 'today') {
          baseData = allSrc.filter(item => item[dateField] === todayStr);
        }

        const crossFiltered = applyGlobalNonDateFilters(baseData);

        const conditions = dc.filterConditions || [];
        const logic = dc.conditionLogic || 'and';

        const filteredByConditions = crossFiltered.filter(item => {
          const passCross = evaluateConditions(item, conditions, logic);
          const passIndicator = (() => {
            if (!dc.field) return true;
            const val = extractStringValue(item[dc.field!]);
            if (dc.filterOperator === 'empty') return !val || val === '' || val === 'undefined';
            if (dc.filterOperator === 'not_empty') return !!val && val !== '' && val !== 'undefined';
            if (!dc.filterValue) return true;
            if (dc.filterOperator === 'neq') return val !== dc.filterValue;
            return val === dc.filterValue;
          })();
          return passCross && passIndicator;
        });

        if (dc.field) {
          const agg = dc.aggregation ?? (w.type === 'gauge' ? 'sum' : undefined);
          const values = filteredByConditions.map(item => Number(item[dc.field!]) || 0).filter(v => v !== 0);
          if (agg === 'sum') val = values.reduce((a, b) => a + b, 0);
          else if (agg === 'avg') val = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
          else if (agg === 'max') val = Math.max(...values, 0);
          else if (agg === 'min') val = Math.min(...values, 0);
          else val = filteredByConditions.length;
        } else {
          val = filteredByConditions.length;
        }
      } else if (w.type.startsWith('kpi-')) {
        const dateFilter = dc.dateFilter ?? (w.type === 'kpi-today' ? 'today' : 'range');
        const baseData =
          dateFilter === 'none'  ? allSrc :
          dateFilter === 'today' ? allSrc.filter(d => d[dateField] === todayStr) :
                                   allSrc;
        const crossFiltered = applyGlobalNonDateFilters(baseData);

        const conditions = dc.filterConditions || [];
        const logic = dc.conditionLogic || 'and';
        const filteredByConditions = crossFiltered.filter(item => {
          const passCross = evaluateConditions(item, conditions, logic);
          const passIndicator = (() => {
            if (!dc.field) return true;
            const val = extractStringValue(item[dc.field!]);
            if (dc.filterOperator === 'empty') return !val || val === '' || val === 'undefined';
            if (dc.filterOperator === 'not_empty') return !!val && val !== '' && val !== 'undefined';
            if (!dc.filterValue) return true;
            if (dc.filterOperator === 'neq') return val !== dc.filterValue;
            return val === dc.filterValue;
          })();
          return passCross && passIndicator;
        });

        const field = dc.field ?? w.kpiField;
        if (!field || field === 'count') {
          val = filteredByConditions.length;
        } else {
          const sum = filteredByConditions.reduce((acc, item) => acc + (Number(item[field]) || 0), 0);
          const agg = dc.aggregation ?? w.kpiAggregation ?? 'sum';
          val = agg === 'avg' ? (filteredByConditions.length ? sum / filteredByConditions.length : 0)
              : agg === 'max' ? Math.max(...filteredByConditions.map(i => Number(i[field]) || 0))
              : agg === 'min' ? Math.min(...filteredByConditions.map(i => Number(i[field]) || 0))
              : sum;
        }
      } else if (w.type === 'flow-node') {
        const field = dc.filterField ?? w.targetField ?? 'status';
        const value = dc.filterValue ?? w.statusTarget ?? '';
        val = allSrc.filter(item => extractStringValue(item[field]) === value).length;
      }
      if (val !== undefined) map[w.id] = Math.round(val);
    });
    return map;
  }, [layout, cacheStore, filters, todayStr, evaluateConditions, applyGlobalNonDateFilters]);

  const computedTargetValues = useMemo(()=>{
    const map:Record<string,number>={};
    layout.forEach(w=>{
      const dc = w.dataConfig as DataConfig | undefined;
      if (!dc) return;
      if (w.type !== 'gauge' && w.type !== 'chart') return;
      if (!dc.targetField && !dc.targetValue) return;
      const srcIdx = dc.targetSourceIndex || dc.sourceIndex || '001';
      const allSrc = cacheStore[srcIdx] || [];
      const dateField = resolveDateFilterField(w);
      let val: number | undefined;

      const dateFilter = dc.targetDateFilter ?? dc.dateFilter ?? 'range';
      const targetDateField = dc.targetDateField || dateField;
      const { start, end } = filters.dateRange;

      let baseData = allSrc;
      if (dateFilter === 'range') {
        baseData = allSrc.filter(item => {
          const d = item[targetDateField];
          if (!d) return false;
          return d >= start && d <= end;
        });
      } else if (dateFilter === 'today') {
        baseData = allSrc.filter(item => item[targetDateField] === todayStr);
      }

      const crossFiltered = applyGlobalNonDateFilters(baseData);
      const conditions = dc.targetFilterConditions || [];
      const logic = dc.targetConditionLogic || 'and';
      const filteredByConditions = crossFiltered.filter(item =>
        evaluateConditions(item, conditions, logic)
      );

      if (dc.targetField) {
        const agg = dc.targetAggregation ?? 'sum';
        if (agg === 'none') {
          if (filteredByConditions.length > 0) {
            const raw = filteredByConditions[0][dc.targetField];
            val = typeof raw === 'number' ? raw : Number(raw) || 0;
          } else {
            val = 0;
          }
        } else {
          const values = filteredByConditions.map(item => Number(item[dc.targetField!]) || 0).filter(v => v !== 0);
          if (agg === 'sum') val = values.reduce((a,b)=>a+b,0);
          else if (agg === 'avg') val = values.length ? values.reduce((a,b)=>a+b,0) / values.length : 0;
          else if (agg === 'max') val = Math.max(...values, 0);
          else if (agg === 'min') val = Math.min(...values, 0);
          else val = filteredByConditions.length;
        }
      } else if (dc.targetValue !== undefined) {
        val = dc.targetValue;
      }
      if (val !== undefined) map[w.id] = Math.round(val);
    });
    return map;
  },[layout, cacheStore, filters.dateRange, todayStr, evaluateConditions, applyGlobalNonDateFilters]);

  const computedPreviousValues = useMemo(()=>{
    const map:Record<string,number>={};
    if (!filters.dateRange.start || !filters.dateRange.end) return map;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatLocalDate(yesterday);

    layout.forEach(w=>{
      const dc = w.dataConfig as DataConfig | undefined;
      if (!dc) return;

      if (w.type !== 'gauge' && w.type !== 'scorecard' && !w.type.startsWith('kpi-')) return;

      const baseSrcIdx = dc.sourceIndex || w.dataSourceIndex || '001';
      const prevSrcIdx = baseSrcIdx === '001' ? '001_prev' : baseSrcIdx;
      const dateField = resolveDateFilterField(w);

      const allSrc = cacheStore[prevSrcIdx] || [];
      let val: number | undefined;

      const dateFilter = dc.dateFilter ?? (w.type === 'kpi-today' ? 'today' : 'range');

      let baseData = allSrc;

      if (prevSrcIdx === baseSrcIdx) {
        if (dateFilter === 'range') {
          baseData = allSrc.filter(item => {
            const d = item[dateField];
            if (!d) return false;
            const endLimit = filters.dateRange.end < yesterdayStr ? filters.dateRange.end : yesterdayStr;
            return d >= filters.dateRange.start && d <= endLimit;
          });
        } else if (dateFilter === 'today') {
          baseData = allSrc.filter(item => item[dateField] === yesterdayStr);
        } else {
          baseData = allSrc.filter(item => {
            const d = item[dateField];
            if (!d) return true;
            return d <= yesterdayStr;
          });
        }
      } else {
        if (dateFilter === 'range') {
          baseData = allSrc.filter(item => {
            const d = item[dateField];
            if (!d) return false;
            return d >= filters.dateRange.start && d <= filters.dateRange.end;
          });
        } else if (dateFilter === 'today') {
          baseData = allSrc.filter(item => item[dateField] === yesterdayStr);
        } else {
          baseData = allSrc;
        }
      }

      const crossFiltered = applyGlobalNonDateFilters(baseData);
      const conditions = dc.filterConditions || [];
      const logic = dc.conditionLogic || 'and';

      const filteredByConditions = crossFiltered.filter(item => {
        const passCross = evaluateConditions(item, conditions, logic);
        const passIndicator = (() => {
          if (!dc.field) return true;
          const val = extractStringValue(item[dc.field]);
          if (dc.filterOperator === 'empty') return !val || val === '' || val === 'undefined';
          if (dc.filterOperator === 'not_empty') return !!val && val !== '' && val !== 'undefined';
          if (!dc.filterValue) return true;
          if (dc.filterOperator === 'neq') return val !== dc.filterValue;
          return val === dc.filterValue;
        })();
        return passCross && passIndicator;
      });

      const field = dc.field ?? w.kpiField;
      if (field && field !== 'count') {
        const agg = dc.aggregation ?? w.kpiAggregation ?? (w.type === 'gauge' ? 'sum' : 'count');
        const values = filteredByConditions.map(item => Number(item[field]) || 0).filter(v => v !== 0);
        if (agg === 'sum') val = values.reduce((a,b)=>a+b,0);
        else if (agg === 'avg') val = values.length ? values.reduce((a,b)=>a+b,0) / values.length : 0;
        else if (agg === 'max') val = Math.max(...values, 0);
        else if (agg === 'min') val = Math.min(...values, 0);
        else val = filteredByConditions.length;
      } else {
        val = filteredByConditions.length;
      }

      if (val !== undefined) map[w.id] = Math.round(val);
    });
    return map;
  },[layout, cacheStore, filters.dateRange, evaluateConditions, applyGlobalNonDateFilters]);

  const todayDiffByWidget = useMemo(() => {
    const result: Record<string, { added: DBItem[]; removed: DBItem[] }> = {};

    layout.forEach(w => {
      if (
        (w.type === 'scorecard' || w.type.startsWith('kpi-')) &&
        w.dataConfig?.showTodayValue
      ) {
        const dc = w.dataConfig;
        const srcIdx = dc.sourceIndex || w.dataSourceIndex || '001';
        const prevSrcIdx = srcIdx === '001' ? '001_prev' : srcIdx;

        const allToday = cacheStore[srcIdx] || [];
        const allPrev = cacheStore[prevSrcIdx] || [];

        const dateField = resolveDateFilterField(w);
        const dateFilter = dc.dateFilter ?? 'range';
        const { start, end } = filters.dateRange;
        const todayStr = formatLocalDate(new Date());
        const yesterdayStr = formatLocalDate(new Date(Date.now() - 86400000));

        const filterData = (data: DBItem[], isPrevious: boolean) => {
          let filtered = data;

          if (dateFilter === 'range') {
            filtered = filtered.filter(item => {
              const d = item[dateField];
              if (!d) return false;
              if (isPrevious) {
                return d >= start && d <= yesterdayStr;
              } else {
                return d >= start && d <= end;
              }
            });
          } else if (dateFilter === 'today') {
            filtered = filtered.filter(item => item[dateField] === (isPrevious ? yesterdayStr : todayStr));
          }

          filtered = applyGlobalNonDateFilters(filtered);

          const conditions = dc.filterConditions || [];
          const logic = dc.conditionLogic || 'and';
          filtered = filtered.filter(item => evaluateConditions(item, conditions, logic));

          if (dc.field) {
            if (dc.filterOperator === 'empty') {
              filtered = filtered.filter(item => !extractStringValue(item[dc.field!]));
            } else if (dc.filterOperator === 'not_empty') {
              filtered = filtered.filter(item => !!extractStringValue(item[dc.field!]));
            } else if (dc.filterValue) {
              filtered = filtered.filter(item => extractStringValue(item[dc.field!]) === dc.filterValue);
            }
          }

          return filtered;
        };

        const todayFiltered = filterData(allToday, false);
        const prevFiltered = filterData(allPrev, true);

        const matchField = dc.todayDiffMatchField || 'id';

        const prevMap = new Map<string, DBItem>();
        prevFiltered.forEach(item => {
          const key = matchField === 'id' ? item.id : extractStringValue(item[matchField]);
          if (key) prevMap.set(key, item);
        });

        const todayMap = new Map<string, DBItem>();
        todayFiltered.forEach(item => {
          const key = matchField === 'id' ? item.id : extractStringValue(item[matchField]);
          if (key) todayMap.set(key, item);
        });

        const added: DBItem[] = [];
        const removed: DBItem[] = [];

        todayFiltered.forEach(item => {
          const key = matchField === 'id' ? item.id : extractStringValue(item[matchField]);
          if (!prevMap.has(key)) {
            added.push(item);
          }
        });

        prevFiltered.forEach(item => {
          const key = matchField === 'id' ? item.id : extractStringValue(item[matchField]);
          if (!todayMap.has(key)) {
            removed.push(item);
          }
        });

        result[w.id] = { added, removed };
      }
    });

    return result;
  }, [cacheStore, layout, filters, evaluateConditions, applyGlobalNonDateFilters]);

  const handleSelect=useCallback((id:string)=>{setSelectedIds([id]);setSelectedAnnotationIds([]);},[]);
  const handleSelectToggle=useCallback((id:string)=>setSelectedIds(p=>p.includes(id)?p.filter(i=>i!==id):[...p,id]),[]);
  const handleResizeEnd=useCallback((id:string,nw:number,nh:number)=>{ if(mode==='edit') editWidgets(layout.map(w=>w.id===id?{...w,w:nw,h:nh}:w)); },[layout,editWidgets,mode]);
  const handleChangeSize=useCallback((id:string,nw:number,nh:number)=>{ if(mode==='edit') moveWidgets(layout.map(w=>w.id===id?{...w,w:nw,h:nh}:w)); },[layout,moveWidgets,mode]);
  const handleMoveWidget = useCallback((id:string,dx:number,dy:number)=>{
    if(mode==='edit') moveWidgets(layout.map(w=>w.id===id?{...w,x:w.x+dx,y:w.y+dy}:w));
  },[layout,moveWidgets,mode]);

  const layoutRef=useRef(layout); useEffect(()=>{layoutRef.current=layout;},[layout]);
  const selectedIdsRef=useRef(selectedIds); useEffect(()=>{selectedIdsRef.current=selectedIds;},[selectedIds]);

  const getSnapGuides=useCallback((aid:string,cx:number,cy:number,cw:number,ch:number)=>{
    const TH=5; const g:GuideLine[]=[]; const l:DistanceLabel[]=[]; let sx=cx,sy=cy;
    const cXC=cx+cw/2,cR=cx+cw,cYC=cy+ch/2,cB=cy+ch;
    layoutRef.current.forEach(t=>{
      if(t.id===aid||selectedIdsRef.current.includes(t.id))return;
      const tXC=t.x+t.w/2,tR=t.x+t.w,tYC=t.y+t.h/2,tB=t.y+t.h;
      [{val:cx,targetVal:t.x},{val:cx,targetVal:tR},{val:cR,targetVal:t.x},{val:cR,targetVal:tR},{val:cXC,targetVal:tXC}].forEach(({val,targetVal})=>{if(Math.abs(val-targetVal)<TH){g.push({type:'vertical',position:targetVal});if(val===cx)sx=targetVal;else if(val===cR)sx=targetVal-cw;else sx=targetVal-cw/2;}});
      [{val:cy,targetVal:t.y},{val:cy,targetVal:tB},{val:cB,targetVal:t.y},{val:cB,targetVal:tB},{val:cYC,targetVal:tYC}].forEach(({val,targetVal})=>{if(Math.abs(val-targetVal)<TH){g.push({type:'horizontal',position:targetVal});if(val===cy)sy=targetVal;else if(val===cB)sy=targetVal-ch;else sy=targetVal-ch/2;}});
    });
    if(g.length>0){ layoutRef.current.forEach(t=>{if(t.id===aid||selectedIdsRef.current.includes(t.id))return; const isX=Math.abs(cx-t.x)<TH||Math.abs(cXC-(t.x+t.w/2))<TH; if(isX){const d=Math.round(Math.abs(cy-t.y));l.push({x:cx+cw/2,y:Math.min(cy,t.y)+d/2,distance:d,vertical:true});}}); }
    return {guides:g,labels:l,snapX:sx,snapY:sy};
  },[layoutRef,selectedIdsRef]);

  const handleDragMove=(e:DragMoveEvent)=>{if(mode!=='edit')return; const{active,delta}=e; const w=layout.find(w=>w.id===active.id); if(!w)return; const cx=w.x+delta.x/zoom,cy=w.y+delta.y/zoom; const{guides,labels}=getSnapGuides(w.id,cx,cy,w.w,w.h); setGuideLines(guides);setDistanceLabels(labels);};
  const handleDragEnd=(e:DragEndEvent)=>{
    if(mode!=='edit'){ setGuideLines([]);setDistanceLabels([]); return; }
    setGuideLines([]);setDistanceLabels([]);
    const{active,delta}=e; if(delta.x===0&&delta.y===0)return;
    const isM=selectedIds.includes(active.id as string)&&selectedIds.length>1;
    moveWidgets(layout.map(item=>{
      if(item.id===active.id||(isM&&selectedIds.includes(item.id))){
        let nx=item.x+delta.x/zoom,ny=item.y+delta.y/zoom;
        if(enableSnap){nx=Math.round(nx/20)*20;ny=Math.round(ny/20)*20;}
        return{...item,x:Math.max(0,nx),y:Math.max(0,ny)};
      }return item;
    }));
  };

  const handleLayerSortEnd=(e:DragEndEvent)=>{if(mode!=='edit')return; const{active,over}=e; if(over&&active.id!==over.id){const oi=layout.findIndex(w=>w.id===active.id);const ni=layout.findIndex(w=>w.id===over.id); editWidgets(arrayMove(layout,oi,ni));}};

  const getSnappedEndpoint = useCallback((rawX: number, rawY: number) => {
    let snapX = rawX;
    let snapY = rawY;
    let minBoxDist = 20;
    let snapped = false;

    layout.forEach(w => {
      const pts = [
        { x: w.x + w.w / 2, y: w.y },
        { x: w.x + w.w, y: w.y + w.h / 2 },
        { x: w.x + w.w / 2, y: w.y + w.h },
        { x: w.x, y: w.y + w.h / 2 }
      ];
      pts.forEach(p => {
        const dist = Math.hypot(p.x - rawX, p.y - rawY);
        if (dist < minBoxDist) {
          minBoxDist = dist;
          snapX = p.x;
          snapY = p.y;
          snapped = true;
        }
      });
    });

    if (!snapped && enableSnap) {
      snapX = Math.round(rawX / 20) * 20;
      snapY = Math.round(rawY / 20) * 20;
    }
    return { x: snapX, y: snapY, snapped };
  }, [layout, enableSnap]);

  const handleWrapperPointerDown=(e:React.PointerEvent)=>{
    if(mode==='signage')return;
    if (e.target instanceof SVGElement && (e.target.closest('.annotation-handle') || e.target.closest('.annotation-handle-start') || e.target.closest('.annotation-handle-end'))) {
      return;
    }
    if(isArrowMode && mode === 'edit') {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if(!rect) return;
      const rawX = (e.clientX - rect.left - pan.x) / zoom;
      const rawY = (e.clientY - rect.top - pan.y) / zoom;
      const { x: snappedX, y: snappedY } = getSnappedEndpoint(rawX, rawY);
      setArrowDraft({ x1: snappedX, y1: snappedY, x2: snappedX, y2: snappedY });
      setSelectedAnnotationIds([]);
      return;
    }
    if(isSpacePressed){setIsPanning(true);return;}
    if(mode!=='edit'||e.target!==wrapperRef.current)return;
    const rect=wrapperRef.current?.getBoundingClientRect(); if(!rect)return;
    const x=(e.clientX-rect.left-pan.x)/zoom,y=(e.clientY-rect.top-pan.y)/zoom;
    setLasso({startX:x,startY:y,x,y,w:0,h:0}); if(!e.shiftKey)setSelectedIds([]);
  };

  const handleWrapperPointerMove=(e:React.PointerEvent)=>{
    if(mode==='signage')return;
    if (draggingEndpoint) {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      const rawX = (e.clientX - rect.left - pan.x) / zoom;
      const rawY = (e.clientY - rect.top - pan.y) / zoom;
      const { x: snappedX, y: snappedY } = getSnappedEndpoint(rawX, rawY);
      updateAnnotations(annotations.map(ann => {
        if (ann.id !== draggingEndpoint.annId) return ann;
        if (draggingEndpoint.point === 'start') return { ...ann, x1: snappedX, y1: snappedY };
        return { ...ann, x2: snappedX, y2: snappedY };
      }));
      return;
    }
    if(isArrowMode && arrowDraft) {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if(!rect) return;
      const rawX = (e.clientX - rect.left - pan.x) / zoom;
      const rawY = (e.clientY - rect.top - pan.y) / zoom;
      const { x: snappedX2, y: snappedY2 } = getSnappedEndpoint(rawX, rawY);
      setArrowDraft(prev => prev ? { ...prev, x2: snappedX2, y2: snappedY2 } : null);
      return;
    }
    if(isPanning){setPan(p=>({x:p.x+e.movementX,y:p.y+e.movementY}));return;}
    if(!lasso||!wrapperRef.current)return;
    const rect=wrapperRef.current.getBoundingClientRect(); const cx=Math.max(0,(e.clientX-rect.left-pan.x)/zoom),cy=Math.max(0,(e.clientY-rect.top-pan.y)/zoom);
    setLasso({...lasso,x:Math.min(lasso.startX,cx),y:Math.min(lasso.startY,cy),w:Math.abs(cx-lasso.startX),h:Math.abs(cy-lasso.startY)});
  };

  const handleWrapperPointerUp=()=>{
    if(mode==='signage')return;
    if (draggingEndpoint) {
      setDraggingEndpoint(null);
      commitAnnotations(annotations);
      return;
    }
    if(isArrowMode && arrowDraft) {
      const { x1, y1, x2, y2 } = arrowDraft;
      if (Math.abs(x2 - x1) > 5 || Math.abs(y2 - y1) > 5) {
        const newAnnotation: Annotation = {
          id: `arrow_${Date.now()}`,
          x1, y1, x2, y2,
          color: '#6366f1',
          thickness: 2,
          arrowStart: false,
          arrowEnd: true,
          lineStyle: 'solid',
          arrowSize: 'medium',
          arrowShape: 'triangle',
          routeType: 'stairHVH',
        };
        commitAnnotations([...annotations, newAnnotation]);
        setSelectedAnnotationIds([newAnnotation.id]);
        setSelectedIds([]);
      }
      setArrowDraft(null);
      return;
    }
    if(isPanning){setIsPanning(false);return;}
    if(!lasso)return;
    if(lasso.w>5&&lasso.h>5){
      const lx = lasso.x, ly = lasso.y, lr = lasso.x + lasso.w, lb = lasso.y + lasso.h;
      const news = layout.filter(w => !(w.x > lr || w.x + w.w < lx || w.y > lb || w.y + w.h < ly)).map(w => w.id);
      const overlappingAnnIds = annotations.filter(ann => {
        const ax1 = Math.min(ann.x1, ann.x2);
        const ax2 = Math.max(ann.x1, ann.x2);
        const ay1 = Math.min(ann.y1, ann.y2);
        const ay2 = Math.max(ann.y1, ann.y2);
        return !(ax1 > lr || ax2 < lx || ay1 > lb || ay2 < ly);
      }).map(a => a.id);
      setSelectedIds(news);
      setSelectedAnnotationIds(overlappingAnnIds);
    } else {
      setSelectedIds([]);
    }
    setLasso(null);
  };

  const handleAnnotationClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (mode === 'edit') {
      if (e.shiftKey) {
        setSelectedAnnotationIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
      } else {
        setSelectedAnnotationIds([id]);
      }
      setSelectedIds([]);
    }
  };

  const startHandleDrag = (annId: string, point: 'start' | 'end') => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingEndpoint({ annId, point });
  };

  const addWidget=useCallback((type:WidgetType,shape:ShapeType)=>{
    if(mode!=='edit')return;
    const nid=`w_${Date.now()}`;
    const viewCenterX = -pan.x / zoom + (wrapperRef.current?.clientWidth || 800) / 2 / zoom;
    const viewCenterY = -pan.y / zoom + (wrapperRef.current?.clientHeight || 600) / 2 / zoom;
    let nw, nh, fontSize;
    if (type === 'table-details') {
      nw = 1200; nh = 600; fontSize = 28;
    } else if (type === 'text-block') {
      nw = 400; nh = 200; fontSize = 16;
    } else if (type === 'chart') {
      nw = 400; nh = 320; fontSize = 16;
    } else if (type === 'outline') {
      nw = 300; nh = 200; fontSize = 14;
    } else if (type === 'slideshow') {
      nw = 600; nh = 400; fontSize = 16;
    } else if (type === 'comparison') {
      nw = 400; nh = 200; fontSize = 36;
    } else if (shape === 'circle') {
      nw = 400; nh = 400; fontSize = 96;
    } else {
      nw = 520; nh = 320; fontSize = 96;
    }
    const cx = Math.max(0, Math.min(viewCenterX - nw / 2, ARTBOARD_WIDTH - nw));
    const cy = Math.max(0, Math.min(viewCenterY - nh / 2, ARTBOARD_HEIGHT - nh));
    const nwgt:Widget={
      id:nid, type, title:type==='table-details'?'明細表':(type==='text-block'?'テキストブロック':(type==='outline'?'枠線':(type==='slideshow'?'スライドショー':(type==='chart'?'グラフ':(type==='comparison'?'比較':'新規データ'))))),
      x:cx, y:cy, w:nw, h:nh,
      shape:type==='table-details'?'rectangle':shape,
      bgColor:type==='text-block'?'#ffffff':(type==='outline'?'transparent':(type==='slideshow'?'#ffffff':(type==='comparison'?'#f8fafc':'#ffffff'))),
      textColor:type==='text-block'?'#0f172a':(type==='comparison'?'#1e293b':'#0f172a'),
      borderColor:type==='text-block'?'#e2e8f0':(type==='outline'?'#6366f1':(type==='comparison'?'#e2e8f0':'#e2e8f0')),
      borderWidth:type==='text-block'?1:(type==='outline'?2:(type==='comparison'?1:1)),
      fontSize:fontSize,
      textAlign:'center', fontFamily:'sans', hasShadow:type==='outline'?false:true, hidden:false, locked:false,
      showTitle:type!=='text-block' && type!=='outline', bgAlpha:1,
      dataConfig: defaultDataConfig(type),
      tableConfig: type==='table-details'?{columns:undefined,pageSize:50,sortable:true,headerBgColor:'rgba(248, 250, 252, 0.8)',headerTextColor:'#64748b'}:undefined,
      textContent: type==='text-block' ? '新しいテキストブロック' : undefined,
      children: type==='slideshow' ? [] : undefined,
    };
    editWidgets([...layout,nwgt]);
    setSelectedIds([nid]);
  },[mode,pan,zoom,layout,editWidgets]);

  const updateSelectedDesign=useCallback((key: keyof Widget | '_multi', val: any) => {
    if(mode!=='edit')return;
    let next = layout;
    for (const id of selectedIds) {
      next = updateWidgetById(next, id, (w) => {
        if (key === '_multi') {
          const updates = val as Partial<Widget>;
          const up = { ...w, ...updates };
          if (updates.shape === 'circle') {
            const max = Math.max(up.w, up.h);
            up.w = max; up.h = max;
          }
          if (updates.hideChildrenBorders !== undefined) {
            up.hideChildrenBorders = updates.hideChildrenBorders;
          }
          return up;
        }
        const up = { ...w, [key]: val };
        if (key === 'shape' && val === 'circle') {
          const max = Math.max(up.w, up.h);
          up.w = max; up.h = max;
        }
        if (key === 'hideChildrenBorders') {
          up.hideChildrenBorders = val;
        }
        return up;
      });
    }
    editWidgets(next);
  }, [layout, selectedIds, editWidgets, mode]);

  const updateSelectedAnnotations = useCallback((updates: Partial<Annotation>) => {
    if(mode!=='edit' || selectedAnnotationIds.length === 0) return;
    commitAnnotations(annotations.map(a => selectedAnnotationIds.includes(a.id) ? { ...a, ...updates } : a));
  }, [mode, selectedAnnotationIds, annotations, commitAnnotations]);

  const handleAddComment=useCallback((wid:string,text:string)=>{const cmt:WidgetComment={id:`c_${Date.now()}`,userId:session?.user?.email||'anonymous',userName:session?.user?.name||'ユーザー',text,createdAt:new Date().toISOString()}; editWidgets(layout.map(w=>w.id===wid?{...w,comments:[...(w.comments||[]),cmt]}:w)); addToastRef.current('コメントを追加しました','success');},[layout,editWidgets,session]);
  const handleDeleteComment=useCallback((wid:string,cid:string)=>{editWidgets(layout.map(w=>w.id===wid?{...w,comments:(w.comments||[]).filter(c=>c.id!==cid)}:w));},[layout,editWidgets]);

  const handleRenameWidget=useCallback((id:string,t:string)=>{ if(mode==='edit') editWidgets(updateWidgetById(layout, id, w => ({ ...w, title: t }))); },[layout,editWidgets,mode]);

  const handleExport=useCallback(()=>{
    const pageData = { layout, annotations };
    const blob=new Blob([JSON.stringify(pageData,null,2)],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=`dashboard-${Date.now()}.json`;
    a.click();
    addToastRef.current('エクスポートしました','success');
  },[layout, annotations]);

  const handleImport=(e:React.ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0];
    if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      try{
        const data = JSON.parse(ev.target?.result as string);
        if (Array.isArray(data)) {
          editWidgets(stripFormula(data));
        } else if (data.layout) {
          dispatch({ type: 'COMMIT_STATE', payload: { layout: stripFormula(data.layout), annotations: data.annotations || [] } });
        }
        addToastRef.current('インポートしました','success');
      }catch{
        addToastRef.current('インポートに失敗しました','error');
      }
    };
    reader.readAsText(file);
  };

  // ★ 共有機能は無効化済み（handleShareは未使用）
  // const handleShare=useCallback(()=>{
  //   const pageData = { layout, annotations };
  //   const json=JSON.stringify(pageData);
  //   const encoded=safeBase64Encode(json);
  //   const url=`${window.location.origin}${window.location.pathname}?layout=${encodeURIComponent(encoded)}`;
  //   navigator.clipboard.writeText(url).then(()=>addToastRef.current('共有URLをコピーしました','success'));
  // },[layout, annotations]);

  const handleExportPDF = useCallback(async () => {
    const canvasDiv = wrapperRef.current?.querySelector('[style*="translate"]') as HTMLElement;
    if (!canvasDiv) return;
    addToastRef.current('PDF生成中...', 'info');
    try {
      const canvas = await html2canvas(canvasDiv, {
        scale: 2,
        useCORS: true,
        backgroundColor: canvasBgColor,
        width: ARTBOARD_WIDTH,
        height: ARTBOARD_HEIGHT,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [ARTBOARD_WIDTH * 0.264583, ARTBOARD_HEIGHT * 0.264583],
      });
      pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());
      pdf.save(`dashboard-${dashboards[activePageIndex]?.name || 'page'}-${Date.now()}.pdf`);
      addToastRef.current('PDFを書き出しました', 'success');
    } catch (e) { addToastRef.current('PDF生成に失敗しました', 'error'); }
  },[dashboards,activePageIndex,canvasBgColor]);

  const statusOptions=useMemo(()=>[...new Set(activeFilteredData.map(d=>d.status))],[activeFilteredData]);
  const handleChartCrossFilter=useCallback((field:string,value:string,widgetTitle?:string,data?:any[])=>{
    toggleCrossFilter(field,value);
    setDrilldown({field,value,widgetTitle:widgetTitle||field, data});
  },[toggleCrossFilter]);

  const handleStatusChange = useCallback(async (itemId: string, newStatus: string, item: DBItem) => {
    const targetIndex = Object.keys(cacheStore).find(idx => cacheStore[idx]?.some(d => d.id === itemId));
    const previousItem = targetIndex ? cacheStore[targetIndex]?.find(d => d.id === itemId) : null;
    if (targetIndex && previousItem) {
      setCacheStore(prev => ({
        ...prev,
        [targetIndex]: (prev[targetIndex] || []).map(d =>
          d.id === itemId ? { ...d, status: newStatus } : d
        ),
      }));
    }
    try {
      const res = await fetch('/api/notion-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: itemId, status: newStatus }),
      });
      const json = await res.json();
      if (!json.success) {
        if (targetIndex && previousItem) {
          setCacheStore(prev => ({
            ...prev,
            [targetIndex]: (prev[targetIndex] || []).map(d =>
              d.id === itemId ? { ...d, status: previousItem.status } : d
            ),
          }));
        }
        addToastRef.current('Notionの更新に失敗しました', 'error');
      } else {
        addToastRef.current('ステータスを更新しました', 'success');
      }
    } catch {
      if (targetIndex && previousItem) {
        setCacheStore(prev => ({
          ...prev,
          [targetIndex]: (prev[targetIndex] || []).map(d =>
            d.id === itemId ? { ...d, status: previousItem.status } : d
          ),
        }));
      }
      addToastRef.current('Notionの更新に失敗しました', 'error');
    }
    if (['Web掲載', '販売準備完了', '公開', 'Web公開', 'Publish'].includes(newStatus)) {
      try {
        const wpRes = await fetch('/api/wp-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item: { ...item, status: newStatus } }),
        });
        const wpJson = await wpRes.json();
        if (wpJson.success) addToastRef.current('Webへの公開が完了しました', 'success');
        else addToastRef.current('WordPress同期に失敗しました', 'error');
      } catch {
        addToastRef.current('WordPress同期に失敗しました', 'error');
      }
    }
  }, [cacheStore]);

  const handleDuplicateWidget = useCallback((id: string) => { if(mode!=='edit')return; const w = findWidgetById(layout, id); if (!w) return; editWidgets([...layout, { ...w, id: `dup_${Date.now()}`, x: w.x + 30, y: w.y + 30 }]); },[layout,editWidgets,mode]);
  const handleToggleLockWidget = useCallback((id: string) => { if(mode!=='edit')return; editWidgets(updateWidgetById(layout, id, w => ({ ...w, locked: !w.locked }))); },[layout,editWidgets,mode]);

  const toggleSignageInclusion = useCallback((idx: number) => {
    dispatch({ type: 'TOGGLE_PAGE_SIGNAGE', payload: idx });
  }, []);

  const handleSignageNextPage = useCallback(() => {
    const eligible = dashboards
      .map((p, i) => ({ page: p, index: i }))
      .filter(({ page }) => page.includeInSignage !== false);
    if (eligible.length === 0) return;
    const currentEligibleIdx = eligible.findIndex(({ index }) => index === activePageIndex);
    const nextEligibleIdx = (currentEligibleIdx + 1) % eligible.length;
    const nextPageIndex = eligible[nextEligibleIdx].index;
    dispatch({ type: 'SET_ACTIVE_PAGE', payload: nextPageIndex });
  }, [activePageIndex, dashboards]);

  const handleSignagePrevPage = useCallback(() => {
    const eligible = dashboards
      .map((p, i) => ({ page: p, index: i }))
      .filter(({ page }) => page.includeInSignage !== false);
    if (eligible.length === 0) return;
    const currentEligibleIdx = eligible.findIndex(({ index }) => index === activePageIndex);
    const prevEligibleIdx = (currentEligibleIdx - 1 + eligible.length) % eligible.length;
    const prevPageIndex = eligible[prevEligibleIdx].index;
    dispatch({ type: 'SET_ACTIVE_PAGE', payload: prevPageIndex });
  }, [activePageIndex, dashboards]);

  const eligiblePages = useMemo(() => {
    return dashboards
      .map((p, i) => ({ page: p, index: i }))
      .filter(({ page }) => page.includeInSignage !== false);
  }, [dashboards]);

  const currentPageDisplayIndex = eligiblePages.findIndex(({ index }) => index === activePageIndex);
  const eligiblePageCount = eligiblePages.length;

  const toggleMode = useCallback((newMode: DashboardMode) => {
    setMode(newMode);
    if (newMode === 'signage') {
      setSelectedIds([]);
      const eligible = dashboards
        .map((p, i) => ({ page: p, index: i }))
        .filter(({ page }) => page.includeInSignage !== false);
      if (eligible.length > 0 && dashboards[activePageIndex]?.includeInSignage === false) {
        dispatch({ type: 'SET_ACTIVE_PAGE', payload: eligible[0].index });
      }
    } else if (newMode === 'edit') {
    } else {
      setSelectedIds([]);
    }
  }, [dashboards, activePageIndex]);

  const handleAiSend = useCallback(async (prompt: string): Promise<{ message: string; widget?: any }> => {
    const allData = Object.values(filteredDataByIndex).flat();
    const uniqueFields = [...new Set(Object.values(availableFieldsBySource).flat())];
    try {
      const res = await fetch('/api/ai-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, fields: uniqueFields, data: allData }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'AIサービスエラー');
      }
      return {
        message: json.message || '回答がありませんでした',
        widget: json.widget,
      };
    } catch (e: any) {
      return { message: `AIエラー: ${e.message}` };
    }
  }, [filteredDataByIndex, availableFieldsBySource]);

  const handleWidgetGenerated = useCallback((widget: any) => {
    const newWidget = { ...widget, id: `ai_${Date.now()}`, dataConfig: defaultDataConfig(widget.type) };
    if (mode === 'edit') {
      editWidgets([...layout, newWidget]);
      setSelectedIds([newWidget.id]);
      addToastRef.current('AIがウィジェットを生成しました', 'success');
    } else {
      addToastRef.current('AIウィジェット生成は編集モードでのみ有効です', 'info');
    }
  }, [mode, layout, editWidgets]);

  const handleGenerateSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/ai-summary', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ data:activeFilteredData, statusCounts, todayCount:todayActionCount }) });
      const json = await res.json();
      if (json.summary) { setAiSummary(json.summary); setShowAiSummary(true); } else { addToastRef.current('レポート生成に失敗しました','error'); }
    } catch { addToastRef.current('AIエラー','error'); }
  },[activeFilteredData,statusCounts,todayActionCount]);

  const setQuickDate = useCallback((preset: string) => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    let start = '', end = '';
    if (preset === 'today') {
      const today = formatLocalDate(now);
      start = today; end = today;
    } else if (preset === 'thisWeek') {
      const day = now.getDay();
      const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      start = formatLocalDate(mon); end = formatLocalDate(sun);
    } else if (preset === 'thisMonth') {
      start = formatLocalDate(new Date(y, m, 1));
      end = formatLocalDate(new Date(y, m + 1, 0));
    } else if (preset === 'lastMonth') {
      start = formatLocalDate(new Date(y, m - 1, 1));
      end = formatLocalDate(new Date(y, m, 0));
    } else if (preset === 'thisYear') {
      start = formatLocalDate(new Date(y, 0, 1));
      end = formatLocalDate(new Date(y, 11, 31));
    }
    if (start && end) updateDateRange({ start, end });
  }, [updateDateRange]);

  const selectedWidgets = layout.filter(w => selectedIds.includes(w.id));
  const isMultiSelected = selectedIds.length > 1;
  const activeEditorWidget = isMultiSelected ? null : findWidgetById(layout, selectedIds[0]);

  const minX = selectedWidgets.length ? Math.min(...selectedWidgets.map(w => w.x)) : 0;
  const maxX = selectedWidgets.length ? Math.max(...selectedWidgets.map(w => w.x + w.w)) : 0;
  const minY = selectedWidgets.length ? Math.min(...selectedWidgets.map(w => w.y)) : 0;
  const maxY = selectedWidgets.length ? Math.max(...selectedWidgets.map(w => w.y + w.h)) : 0;
  const maxW = selectedWidgets.length ? Math.max(...selectedWidgets.map(w => w.w)) : 0;
  const maxH = selectedWidgets.length ? Math.max(...selectedWidgets.map(w => w.h)) : 0;

  const handleAlign = useCallback((type: string) => {
    if(mode!=='edit')return;
    let next = [...layout];
    if (['left','right','top','bottom','center-x','center-y','match-w','match-h'].includes(type)) {
      next = layout.map(w => {
        if (!selectedIds.includes(w.id)) return w;
        let n = { ...w };
        if (type === 'left') n.x = minX; if (type === 'right') n.x = maxX - w.w;
        if (type === 'top') n.y = minY; if (type === 'bottom') n.y = maxY - w.h;
        if (type === 'center-x') n.x = minX + (maxX - minX) / 2 - w.w / 2;
        if (type === 'center-y') n.y = minY + (maxY - minY) / 2 - w.h / 2;
        if (type === 'match-w') n.w = maxW; if (type === 'match-h') n.h = maxH;
        return n;
      });
    } else if (type === 'dist-x' || type === 'dist-y') {
      const isX = type === 'dist-x'; const sorted = [...selectedWidgets].sort((a, b) => isX ? a.x - b.x : a.y - b.y);
      if (sorted.length < 3) return;
      const totalSize = sorted.reduce((sum, w) => sum + (isX ? w.w : w.h), 0);
      const gap = ((isX ? maxX - minX : maxY - minY) - totalSize) / (sorted.length - 1);
      let cur = isX ? minX : minY;
      sorted.forEach((sw, i) => {
        const idx = next.findIndex(nw => nw.id === sw.id);
        if (i === 0) next[idx] = { ...next[idx], [isX ? 'x' : 'y']: isX ? minX : minY };
        else if (i === sorted.length - 1) next[idx] = { ...next[idx], [isX ? 'x' : 'y']: isX ? maxX - sw.w : maxY - sw.h };
        else next[idx] = { ...next[idx], [isX ? 'x' : 'y']: Math.round(cur) };
        cur += (isX ? sw.w : sw.h) + gap;
      });
    }
    editWidgets(next);
  }, [layout, selectedIds, selectedWidgets, minX, maxX, minY, maxY, maxW, maxH, editWidgets, mode]);

  const handleTemplateSelect = useCallback((tplWidgets: Partial<Widget>[]) => {
    if (mode !== 'edit') return;
    const newWidgets = tplWidgets.map(pw => ({
      ...pw,
      id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      dataConfig: pw.dataConfig || defaultDataConfig(pw.type || 'kpi-total'),
    } as Widget));
    editWidgets([...layout, ...newWidgets]);
    addToastRef.current('テンプレートを適用しました', 'success');
  }, [mode, layout, editWidgets]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      signIn();
    }
  }, [status]);

  if (status === 'loading') {
    return <div className="h-screen flex items-center justify-center text-slate-500">認証を確認中...</div>;
  }

  if (status === 'unauthenticated') {
    return null;
  }

  if (loadingAll) {
    const pct = Math.round((loadingProgress.loaded / loadingProgress.total) * 100);
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="w-full max-w-md px-8">
          <div className="flex items-center justify-center mb-6">
            <AppLogo className="h-8 w-auto" />
          </div>
          <h2 className="text-lg font-semibold text-slate-700 text-center mb-2">データを読み込み中...</h2>
          <p className="text-sm text-slate-500 text-center mb-6">Notionから最新のデータを取得しています</p>
          <div className="w-full bg-slate-200 rounded-full h-2.5 mb-2">
            <div
              className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-xs text-slate-400 text-center">{loadingProgress.loaded} / {loadingProgress.total} データベース完了</div>
        </div>
      </div>
    );
  }

  if(mode==='signage') return (
  <SignageView
    layout={layout}
    computedValues={computedValues}
    computedTargetValues={computedTargetValues}
    computedPreviousValues={computedPreviousValues}
    filteredDataByIndex={filteredDataByIndex}
    statusOptions={statusOptions}
    onExit={() => setMode('view')}
    handleStatusChange={handleStatusChange}
    filters={filters}
    widgetFilteredData={widgetFilteredData}
    handleChartCrossFilter={handleChartCrossFilter}
    toggleCrossFilter={toggleCrossFilter}
    pagesCount={eligiblePageCount}
    onNextPage={handleSignageNextPage}
    onPrevPage={handleSignagePrevPage}
    currentPageDisplayIndex={currentPageDisplayIndex}
    annotations={annotations}
    canvasBgColor={canvasBgColor}
    drilldown={drilldown}
    setDrilldown={setDrilldown}
    signageInterval={signageInterval}
    todayDiffMap={todayDiffByWidget}
    availableFields={availableFieldsBySource['001'] || []}
    handleDiffFilter={handleDiffFilter}
    allWidgetValues={allWidgetValues}
    CanvasWidgetComponent={CanvasWidget}  // ★ これを追加
  />
);

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden text-slate-900 selection:bg-indigo-500/30">

      <aside className={`shrink-0 bg-white border-r border-slate-200 flex flex-col z-30 relative transition-all duration-300 ${leftSidebarOpen ? 'w-[320px]' : 'w-[72px]'}`}>
        <button
          onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
          className="absolute -right-4 top-20 z-50 bg-white border border-slate-200 shadow-md rounded-full w-8 h-8 flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-transform"
        >
          {leftSidebarOpen ? <Icons.ArrowRight className="w-4 h-4 rotate-180" /> : <Icons.ArrowRight className="w-4 h-4" />}
        </button>

        <div className={`h-16 border-b border-slate-200 flex items-center justify-center shrink-0 bg-slate-50/50 ${leftSidebarOpen ? 'px-6' : 'px-2'}`}>
          <AppLogo
            className={leftSidebarOpen ? "h-8 w-auto max-w-[160px]" : "w-6 h-6"}
          />
        </div>

        <div className={`flex-1 overflow-y-auto ${leftSidebarOpen ? 'p-6' : 'p-3 py-6'} space-y-8 overflow-x-hidden`}>
                                                  <section>
            <DashboardPageList
              dashboards={dashboards}
              activePageId={dashboards[activePageIndex]?.id ?? null}
              canEdit={canEdit}
              onSelect={(pageId) => {
                const realIndex = dashboards.findIndex(p => p.id === pageId);
                if (realIndex >= 0) dispatch({ type: 'SET_ACTIVE_PAGE', payload: realIndex });
              }}
              onAdd={() => {
                if (mode === 'edit')
                  dispatch({
                    type: 'ADD_PAGE',
                    payload: {
                      id: `page_${Date.now()}`,
                      name: `ページ ${dashboards.length + 1}`,
                      layout: [],
                      annotations: [],
                      includeInSignage: true,
                      published: true,
                    },
                  });
              }}
              onDelete={(pageId) => {
                const realIndex = dashboards.findIndex(p => p.id === pageId);
                if (realIndex < 0) return;
                setConfirmState({
                  message: `ページ「${dashboards[realIndex]?.name || `ページ ${realIndex + 1}`}」を完全に削除しますか？この操作は元に戻せません。`,
                  onConfirm: () => {
                    dispatch({ type: 'DELETE_PAGE', payload: realIndex });
                    setConfirmState(null);
                  },
                });
              }}
              onRename={(pageId, name) => {
                const realIndex = dashboards.findIndex(p => p.id === pageId);
                if (realIndex >= 0 && mode === 'edit')
                  dispatch({ type: 'RENAME_PAGE', payload: { index: realIndex, name } });
              }}
              onToggleSignage={(pageId) => {
                const realIndex = dashboards.findIndex(p => p.id === pageId);
                if (realIndex >= 0) toggleSignageInclusion(realIndex);
              }}
              // ★ onTogglePublished は廃止。公開状態はエリア間ドラッグで onReorder 経由で更新される
              onReorder={(reordered) => dispatch({ type: 'REORDER_PAGES', payload: reordered })}
              collapsed={!leftSidebarOpen}
            />
          </section>

          {!leftSidebarOpen && (
            <div className="flex flex-col items-center gap-3 mt-4">
              <button
                onClick={() => fetchAllDatabases(false)}
                className="w-10 h-10 rounded-xl flex items-center justify-center bg-white text-slate-500 hover:text-indigo-600 border border-slate-200 hover:border-indigo-400 transition-colors"
                title="データを更新"
              >
                <Icons.Download className="w-5 h-5" />
              </button>
              <button
                onClick={() => toggleMode('signage')}
                className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-800 text-white hover:bg-slate-900 transition-colors shadow-md"
                title="サイネージモードを開始"
              >
                <Icons.Monitor className="w-5 h-5" />
              </button>
            </div>
          )}

          <div className={`transition-opacity duration-300 flex flex-col gap-8 ${leftSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
            <div className="border-b border-slate-100"/>
            {mode === 'edit' && (
              <>
                <section>
                  <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Icons.Plus className="w-4 h-4"/> ウィジェット追加</h3>
                  <div className="flex flex-col gap-2">
                    <button onClick={()=>addWidget('scorecard','rounded')} className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:border-indigo-400 hover:text-indigo-600 hover:shadow-sm transition-all group">
                      <span className="p-1.5 bg-indigo-50 rounded-lg text-indigo-500 group-hover:bg-indigo-100 transition-colors"><Icons.ChartBar className="w-4 h-4" /></span>
                      スコアカードを追加
                    </button>
                    <button onClick={()=>addWidget('gauge','rounded')} className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:border-indigo-400 hover:text-indigo-600 hover:shadow-sm transition-all group">
                      <span className="p-1.5 bg-indigo-50 rounded-lg text-indigo-500 group-hover:bg-indigo-100 transition-colors"><Icons.Gauge className="w-4 h-4" /></span>
                      ゲージを追加
                    </button>
                    <button onClick={()=>addWidget('chart','rectangle')} className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:border-indigo-400 hover:text-indigo-600 hover:shadow-sm transition-all group">
                      <span className="p-1.5 bg-indigo-50 rounded-lg text-indigo-500 group-hover:bg-indigo-100 transition-colors"><Icons.ChartBar className="w-4 h-4" /></span>
                      グラフを追加
                    </button>
                    <button onClick={()=>addWidget('table-details','rectangle')} className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:border-indigo-400 hover:text-indigo-600 hover:shadow-sm transition-all group">
                      <span className="p-1.5 bg-indigo-50 rounded-lg text-indigo-500 group-hover:bg-indigo-100 transition-colors"><Icons.Table className="w-4 h-4" /></span>
                      明細テーブルを追加
                    </button>
                    <button onClick={()=>addWidget('text-block','rectangle')} className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:border-indigo-400 hover:text-indigo-600 hover:shadow-sm transition-all group">
                      <span className="p-1.5 bg-indigo-50 rounded-lg text-indigo-500 group-hover:bg-indigo-100 transition-colors"><Icons.FileText className="w-4 h-4" /></span>
                      テキストブロックを追加
                    </button>
                    <button onClick={()=>addWidget('outline','rectangle')} className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:border-indigo-400 hover:text-indigo-600 hover:shadow-sm transition-all group">
                      <span className="p-1.5 bg-indigo-50 rounded-lg text-indigo-500 group-hover:bg-indigo-100 transition-colors"><Icons.Grid className="w-4 h-4" /></span>
                      アウトラインを追加
                    </button>
                    <button onClick={()=>addWidget('slideshow','rectangle')} className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:border-indigo-400 hover:text-indigo-600 hover:shadow-sm transition-all group">
                      <span className="p-1.5 bg-indigo-50 rounded-lg text-indigo-500 group-hover:bg-indigo-100 transition-colors"><Icons.Play className="w-4 h-4" /></span>
                      スライドショーを追加
                    </button>
                    <button onClick={()=>addWidget('comparison','rectangle')} className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:border-indigo-400 hover:text-indigo-600 hover:shadow-sm transition-all group">
                      <span className="p-1.5 bg-indigo-50 rounded-lg text-indigo-500 group-hover:bg-indigo-100 transition-colors"><Icons.ChartBar className="w-4 h-4" /></span>
                      比較を追加
                    </button>
                  </div>
                </section>
                <div className="border-b border-slate-100"/>
                <section>
                  <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Icons.ArrowRight className="w-4 h-4"/> コネクタ (矢印)</h3>
                  <button
                    onClick={() => setIsArrowMode(prev => !prev)}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 border rounded-xl text-sm font-medium transition-all ${
                      isArrowMode
                        ? 'bg-indigo-50 border-indigo-400 text-indigo-700 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-400 hover:text-indigo-600 hover:shadow-sm'
                    }`}
                  >
                    <Icons.ArrowRight className="w-4 h-4" />
                    {isArrowMode ? '矢印モード解除' : '矢印を描画'}
                  </button>
                  {annotations.filter(a => a.arrowEnd || a.arrowStart).length > 0 && (
                    <div className="mt-2 text-xs text-slate-500">
                      {annotations.filter(a => a.arrowEnd || a.arrowStart).length} 本の矢印
                      {selectedAnnotationIds.length > 1 && `（${selectedAnnotationIds.length}本選択中）`}
                    </div>
                  )}
                </section>
                <div className="border-b border-slate-100"/>
              </>
            )}
                                                <section className="space-y-4">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Icons.Settings className="w-4 h-4"/> システム設定</h3>
              {canEdit && (
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-2 block">自動更新間隔</label>
                  <select value={refreshInterval} onChange={e=>setRefreshInterval(Number(e.target.value))} className="w-full text-sm border border-slate-200 px-3 py-2 rounded-xl bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none shadow-sm cursor-pointer">
                    <option value={60000}>1分</option><option value={180000}>3分</option><option value={300000}>5分</option><option value={600000}>10分</option><option value={0}>手動のみ</option>
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-2 block">サイネージ切り替え間隔</label>
                <select
                  value={signageInterval}
                  onChange={e => setSignageInterval(Number(e.target.value))}
                  className="w-full text-sm border border-slate-200 px-3 py-2 rounded-xl bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none shadow-sm cursor-pointer"
                >
                 <option value={10000}>10秒</option>
                  <option value={15000}>15秒</option>
                  <option value={30000}>30秒</option>
                  <option value={60000}>1分</option>
                  <option value={120000}>2分</option>
                  <option value={180000}>3分</option>
                  <option value={240000}>4分</option>
                  <option value={300000}>5分</option>
                </select>
              </div>
              {canEdit && (
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-2 block">アートボード背景色</label>
                  <input
                    type="color"
                    value={canvasBgColor}
                    onChange={(e) => setCanvasBgColor(e.target.value)}
                    className="w-full h-8 rounded border p-0.5 bg-white cursor-pointer"
                  />
                </div>
              )}
              <button onClick={() => toggleMode('signage')} className="w-full py-3 bg-slate-800 text-white text-sm font-semibold rounded-xl hover:bg-slate-900 shadow-md transition-all flex justify-center items-center gap-2">
                <Icons.Monitor className="w-4 h-4" /> サイネージモードを開始
              </button>
            </section>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 min-h-0 relative bg-slate-50/50">
        <header className="shrink-0 h-16 bg-white border-b border-slate-200 z-30 flex items-center justify-between px-8 shadow-sm">
          <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            {mode === 'edit' ? <span className="text-indigo-600">📐 デザイン・エディタ</span> : dashboards[activePageIndex]?.name||'Dashboard'}
          </h1>
          <div className="flex items-center gap-3">
            {mode === 'edit' && (
              <div className="flex items-center gap-2 mr-2">
                <button onClick={handleExport} className="px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-all flex items-center gap-1.5" title="JSONファイルとして保存"><Icons.Download className="w-4 h-4"/>書出</button>
                <button onClick={handleExportPDF} className="px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-all flex items-center gap-1.5" title="PDFとして保存"><Icons.FileText className="w-4 h-4"/>PDF</button>
                <label className="px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-all cursor-pointer flex items-center gap-1.5" title="JSONファイルから読み込み"><Icons.Upload className="w-4 h-4"/>読込 <input type="file" accept=".json" onChange={handleImport} className="hidden"/></label>
                {/* ★ 共有機能は無効化のためボタンを削除 */}
              </div>
            )}
            {canEdit && (
              <button
                onClick={() => setMode(mode === 'edit' ? 'view' : 'edit')}
                className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                  mode === 'edit'
                    ? 'bg-indigo-600 text-white shadow-md hover:bg-indigo-700'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm'
                }`}
              >
                {mode === 'edit' ? <><Icons.Check className="w-4 h-4" /> 編集を完了</> : <><Icons.Settings className="w-4 h-4" /> ダッシュボードを編集</>}
              </button>
            )}
            <button
              onClick={() => signOut()}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all flex items-center gap-1.5"
            >
              <Icons.X className="w-4 h-4"/> ログアウト
            </button>
          </div>
        </header>

        <div className="shrink-0 flex items-center gap-4 px-8 py-3 bg-white border-b border-slate-200 z-20 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest mr-2">Period</span>
            {[
              { label: '今日', preset: 'today' },
              { label: '今週', preset: 'thisWeek' },
              { label: '今月', preset: 'thisMonth' },
              { label: '先月', preset: 'lastMonth' },
              { label: '今年', preset: 'thisYear' },
            ].map(({ label, preset }) => (
              <button key={preset} onClick={() => setQuickDate(preset)} className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all">
                {label}
              </button>
            ))}
          </div>
          <div className="h-6 w-px bg-slate-200 mx-2"></div>
          <div className="flex items-center gap-2">
            <input type="date" value={filters.dateRange.start} onChange={e => updateDateRange({ start: e.target.value })} className="text-sm bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
            <span className="text-slate-400 px-1">〜</span>
            <input type="date" value={filters.dateRange.end} onChange={e => updateDateRange({ end: e.target.value })} className="text-sm bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
            <span className="text-xs font-medium text-slate-400 ml-3 bg-slate-100 px-2 py-1 rounded-md">
              {Math.ceil((new Date(filters.dateRange.end).getTime() - new Date(filters.dateRange.start).getTime()) / 86400000) + 1}日間
            </span>
          </div>
        </div>

        <ActiveFilterBar />

        <div ref={wrapperRef} className="flex-1 relative overflow-hidden" style={{cursor:isArrowMode?'crosshair':(isSpacePressed?(isPanning?'grabbing':'grab'):'default'), backgroundColor: colors.canvas}} onPointerDown={handleWrapperPointerDown} onPointerMove={handleWrapperPointerMove} onPointerUp={handleWrapperPointerUp}>
          <div className="absolute bottom-8 left-8 z-40 flex items-center gap-1 bg-white/90 backdrop-blur-md shadow-lg rounded-xl p-1.5 border border-slate-200/80">
            <button onClick={zoomOut} className="text-xs font-bold text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors">−</button>
            <div className="px-3 py-1 text-xs font-bold text-slate-700 bg-slate-100 rounded-lg mr-1 tracking-tight">{(zoom*100).toFixed(0)}%</div>
            <button onClick={zoomIn} className="text-xs font-bold text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors">+</button>
            <div className="w-px h-4 bg-slate-200 mx-1"></div>
            <button onClick={()=>{setZoom(1);setPan({x:0,y:0});}} className="text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 px-3 py-1.5 rounded-lg transition-colors">100%</button>
            <div className="w-px h-4 bg-slate-200 mx-1"></div>
            <button onClick={fitToAll} className="text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"><Icons.Monitor className="w-3.5 h-3.5"/> Fit</button>
            <div className="w-px h-4 bg-slate-200 mx-1"></div>
            <button onClick={() => setShowGrid(prev => !prev)} className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${showGrid ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`} title="グリッド表示を切り替え">
              <Icons.Grid className="w-3.5 h-3.5" /> Grid
            </button>
            {mode === 'edit' && (
              <button
                onClick={() => setEnableSnap(prev => !prev)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                  enableSnap ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                }`}
                title="グリッドスナップ"
              >
                {enableSnap ? '🔲 Snap' : '⬜ Snap'}
              </button>
            )}
          </div>

          {mode === 'edit' && (
            <Minimap
              layout={layout}
              pan={pan}
              zoom={zoom}
              viewportW={viewportSize.w}
              viewportH={viewportSize.h}
              onNavigate={(pos) => setPan(pos)}
            />
          )}

          {mode === 'edit' && selectedIds.length>1 && (
            <div className="absolute bg-white/95 backdrop-blur-xl shadow-2xl border border-slate-200 rounded-xl p-2 flex gap-1 z-50 transform -translate-x-1/2 -translate-y-full mb-4" style={{left:pan.x+(minX+(maxX-minX)/2)*zoom,top:pan.y+minY*zoom}} onPointerDown={e=>e.stopPropagation()}>
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-md">{selectedIds.length}個選択中</div>
              <button onClick={()=>handleAlign('left')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors">◧</button><button onClick={()=>handleAlign('center-x')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors">◫</button><button onClick={()=>handleAlign('right')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors">◨</button><div className="w-px h-6 bg-slate-200 mx-1 self-center"/><button onClick={()=>handleAlign('top')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors">⬒</button><button onClick={()=>handleAlign('center-y')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors">⊟</button><button onClick={()=>handleAlign('bottom')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors">⬓</button><div className="w-px h-6 bg-slate-200 mx-1 self-center"/><button onClick={()=>handleAlign('dist-x')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 font-bold transition-colors">↔</button><button onClick={()=>handleAlign('dist-y')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 font-bold transition-colors">↕</button><div className="w-px h-6 bg-slate-200 mx-1 self-center"/><button onClick={()=>handleAlign('match-w')} className="px-3 py-1.5 hover:bg-slate-100 rounded-lg text-slate-600 text-xs font-bold transition-colors">↔統一</button><button onClick={()=>handleAlign('match-h')} className="px-3 py-1.5 hover:bg-slate-100 rounded-lg text-slate-600 text-xs font-bold transition-colors">↕統一</button>
              <button
                onClick={() => handleConvertToSlideshow()}
                className="px-3 py-1.5 hover:bg-slate-100 rounded-lg text-slate-600 text-xs font-bold transition-colors flex items-center gap-1"
                title="選択項目をスライドショーに変換"
              >
                <Icons.Play className="w-3.5 h-3.5" /> スライドショー化
              </button>
            </div>
          )}
          {lasso&&<div className="absolute border-2 border-indigo-500 bg-indigo-500/10 z-50 pointer-events-none rounded" style={{left:pan.x+lasso.x*zoom,top:pan.y+lasso.y*zoom,width:lasso.w*zoom,height:lasso.h*zoom}}/>}
          {guideLines.map((g,i)=>g.type==='vertical'?<div key={`vg-${i}`} className="absolute top-0 bottom-0 border-l border-indigo-400 z-50 pointer-events-none opacity-50" style={{left:pan.x+g.position*zoom,width:1}}/>:<div key={`hg-${i}`} className="absolute left-0 right-0 border-t border-indigo-400 z-50 pointer-events-none opacity-50" style={{top:pan.y+g.position*zoom,height:1}}/>)}
          {distanceLabels.map((l,i)=><div key={`dl-${i}`} className="absolute bg-indigo-600 text-white text-xs px-2 py-1 rounded-md z-50 pointer-events-none font-medium shadow-md" style={{left:pan.x+l.x*zoom,top:pan.y+l.y*zoom,transform:'translate(-50%,-50%)'}}>{l.distance}px</div>)}

          <div style={{
            transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            width: `${ARTBOARD_WIDTH}px`,
            height: `${ARTBOARD_HEIGHT}px`,
            position: 'absolute',
            background: canvasBgColor,
            boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
          }}>
            <div className="absolute inset-0" style={{backgroundImage:showGrid?`radial-gradient(#cbd5e1 1px, transparent 1px)`:'none',backgroundSize:'24px 24px', opacity: 0.5}}/>

            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 50 }}>
              <defs>
                {getMarkerDefs(annotations)}
              </defs>
              {annotations.map(ann => {
                const isSelected = selectedAnnotationIds.includes(ann.id);
                let dashArray = 'none';
                if (ann.lineStyle === 'dashed') dashArray = '8 4';
                else if (ann.lineStyle === 'dotted') dashArray = '2 3';
                const path = getRoutePath(ann);
                return (
                  <g key={ann.id}>
                    <path
                      d={path}
                      stroke="transparent"
                      strokeWidth={ann.thickness + 10}
                      fill="none"
                      className="cursor-pointer pointer-events-auto"
                      onClick={(e) => handleAnnotationClick(e, ann.id)}
                    />
                    <path
                      d={path}
                      stroke={ann.color}
                      strokeWidth={ann.thickness}
                      strokeDasharray={dashArray}
                      fill="none"
                      markerStart={ann.arrowStart ? `url(#arrowhead-reverse-${ann.id})` : undefined}
                      markerEnd={ann.arrowEnd ? `url(#arrowhead-${ann.id})` : undefined}
                      className="pointer-events-none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {isSelected && (
                      <>
                        <circle
                          cx={ann.x1} cy={ann.y1} r={6}
                          fill="white" stroke="#6366f1" strokeWidth={2}
                          className="pointer-events-auto cursor-pointer annotation-handle annotation-handle-start"
                          onPointerDown={startHandleDrag(ann.id, 'start')}
                        />
                        <circle
                          cx={ann.x2} cy={ann.y2} r={6}
                          fill="white" stroke="#6366f1" strokeWidth={2}
                          className="pointer-events-auto cursor-pointer annotation-handle annotation-handle-end"
                          onPointerDown={startHandleDrag(ann.id, 'end')}
                        />
                      </>
                    )}
                  </g>
                );
              })}
              {arrowDraft && (
                <>
                  <line
                    x1={arrowDraft.x1} y1={arrowDraft.y1} x2={arrowDraft.x2} y2={arrowDraft.y2}
                    stroke="#6366f1" strokeWidth={2} strokeDasharray="4" opacity={0.6}
                    markerEnd="url(#arrowhead-draft)" fill="none" />
                  <circle cx={arrowDraft.x1} cy={arrowDraft.y1} r={4} fill="#6366f1" opacity={0.6} />
                </>
              )}
            </svg>

            {(!isMounted || loadingAll) ? (
              layout.map(w => <SkeletonWidget key={w.id} x={w.x} y={w.y} w={w.w} h={w.h} />)
            ) : (
              <DndContext id="canvas-dnd" sensors={canvasSensors} onDragMove={handleDragMove} onDragEnd={handleDragEnd}>
                {layout.map((w, idx) => {
                  const content = renderWidgetContent(
  w,
  computedValues,
  computedTargetValues,
  computedPreviousValues,
  filteredDataByIndex,
  widgetFilteredData,
  statusOptions,
  handleStatusChange,
  handleChartCrossFilter,
  filters,
  toggleCrossFilter,
  filters.dateRange,
  mode,
  editWidgets,
  layout,
  todayDiffByWidget,
  availableFieldsBySource['001'] || [],
  handleDiffFilter,
  allWidgetValues,
  
  (field: string, value: string, widgetTitle: string, data?: any[], columns?: string[], images?: string[]) => {
  setDrilldown({ field, value, widgetTitle, data, columns, images });
  },
  
  cacheStore  // ★ 追加（カンマ忘れずに）
);
                  const flashClass = editModeFlash ? 'ring-1 ring-slate-300 transition-all duration-300' : '';
                  return (
                    <div key={w.id} className={flashClass}>
                      <CanvasWidget key={w.id} widget={w} isEditMode={mode === 'edit'} isSignageMode={false} zoom={zoom} zIndex={idx}
                        isSelected={selectedIds.includes(w.id)} onSelect={handleSelect} onSelectToggle={handleSelectToggle}
                        onResizeEnd={handleResizeEnd} onChangeSize={handleChangeSize} onMove={handleMoveWidget}
                        onClickFlowNode={(s)=>toggleCrossFilter('status',s)}
                        onRename={handleRenameWidget}
                        onContextMenu={mode === 'edit' ? (id,x,y)=>setCtxMenu({id,x,y}) : undefined}
                        onDoubleClick={handleWidgetDoubleClick}
                        computedValue={computedValues[w.id]}
                        selectedCount={selectedIds.length}
                      >
                        {content}
                      </CanvasWidget>
                    </div>
                  );
                })}
              </DndContext>
            )}
          </div>
        </div>
      </main>

      {mode === 'edit' && (
        <div className={`relative shrink-0 flex transition-all duration-300 ${rightSidebarOpen ? 'w-[360px]' : 'w-0'}`}>
          <button
            onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
            className="absolute -left-4 top-20 z-50 bg-white border border-slate-200 shadow-md rounded-full w-8 h-8 flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-transform"
          >
            {rightSidebarOpen ? <Icons.ArrowRight className="w-4 h-4" /> : <Icons.ArrowRight className="w-4 h-4 rotate-180" />}
          </button>

          <aside className="w-[360px] bg-white border-l border-slate-200 flex flex-col z-40 shadow-2xl overflow-hidden">
            <div className="flex border-b border-slate-200 text-sm font-semibold text-slate-500 bg-slate-50/50 shrink-0">
              <button onClick={()=>setRightTab('layers')} className={`flex-1 py-3 transition-all relative ${rightTab==='layers'?'text-indigo-600 bg-white':'hover:text-slate-800 hover:bg-slate-50'}`}>レイヤー{rightTab==='layers'&&<div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600"></div>}</button>
              <button onClick={()=>setRightTab('properties')} className={`flex-1 py-3 transition-all relative ${rightTab==='properties'?'text-indigo-600 bg-white':'hover:text-slate-800 hover:bg-slate-50'}`}>プロパティ{rightTab==='properties'&&<div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600"></div>}</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50/30">
              {rightTab==='layers' ? (
                <div className="space-y-1">
                  <DndContext id="layer-dnd" sensors={layerSensors} collisionDetection={closestCenter} onDragEnd={handleLayerSortEnd}>
                    <SortableContext items={layout.map(w=>w.id)} strategy={verticalListSortingStrategy}>
                      {[...layout].reverse().map(w=>
                        <LayerRow key={w.id} widget={w} isSelected={selectedIds.includes(w.id)} onSelect={id=>{setSelectedIds([id]); setSelectedAnnotationIds([]);}} onToggleVisible={id=>editWidgets(layout.map(x=>x.id===id?{...x,hidden:!x.hidden}:x))} onToggleLock={id=>editWidgets(layout.map(x=>x.id===id?{...x,locked:!x.locked}:x))} onRename={(id,val)=>editWidgets(layout.map(x=>x.id===id?{...x,title:val}:x))} onContextMenu={mode === 'edit' ? (id,x,y)=>setCtxMenu({id,x,y}) : undefined}/>
                      )}
                    </SortableContext>
                  </DndContext>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedAnnotationIds.length > 0 ? (() => {
                    const selectedAnns = annotations.filter(a => selectedAnnotationIds.includes(a.id));
                    const ann = selectedAnns[0];
                    if (!ann) return null;
                    return (
                      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <Icons.ArrowRight className="w-4 h-4"/> 矢印のプロパティ
                            {selectedAnns.length > 1 && <span className="text-xs font-normal text-slate-500">（{selectedAnns.length}本選択中）</span>}
                          </h4>
                          <button
                            onClick={() => {
                              commitAnnotations(annotations.filter(a => !selectedAnnotationIds.includes(a.id)));
                              setSelectedAnnotationIds([]);
                              addToastRef.current('矢印を削除しました（Ctrl+Zで元に戻す）', 'info');
                            }}
                            className="text-slate-400 hover:text-rose-500 p-1"
                          >
                            <Icons.Trash className="w-4 h-4" />
                          </button>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-500 mb-1 block">色</label>
                          <input
                            type="color"
                            value={ann.color}
                            onChange={e => updateSelectedAnnotations({ color: e.target.value })}
                            className="w-full h-8 rounded border p-0.5 bg-white cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-500 mb-1 block">線の太さ</label>
                          <input
                            type="range"
                            min="1"
                            max="10"
                            value={ann.thickness}
                            onChange={e => updateSelectedAnnotations({ thickness: parseInt(e.target.value) })}
                            className="w-full accent-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-500 mb-1 block">線の種類</label>
                          <select
                            value={ann.lineStyle}
                            onChange={e => updateSelectedAnnotations({ lineStyle: e.target.value as any })}
                            className="w-full text-sm border border-slate-200 px-2 py-1.5 rounded-lg bg-slate-50 text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-50 outline-none shadow-sm"
                          >
                            <option value="solid">実線</option>
                            <option value="dashed">破線</option>
                            <option value="dotted">点線</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-500 mb-1 block">経路</label>
                          <select
                            value={ann.routeType}
                            onChange={e => updateSelectedAnnotations({ routeType: e.target.value as any })}
                            className="w-full text-sm border border-slate-200 px-2 py-1.5 rounded-lg bg-slate-50 text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-50 outline-none shadow-sm"
                          >
                            <option value="stairHVH">直角（横・縦・横）</option>
                            <option value="stairVHV">直角（縦・横・縦）</option>
                            <option value="stairHV">直角（横・縦）</option>
                            <option value="stairVH">直角（縦・横）</option>
                            <option value="orthogonal">自動直角カーブ（距離で補正）</option>
                            <option value="direct">直線</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={ann.arrowStart}
                              onChange={e => updateSelectedAnnotations({ arrowStart: e.target.checked })}
                              className="w-4 h-4 rounded text-indigo-600"
                            />
                            <span className="text-xs text-slate-600">始点の矢印</span>
                          </label>
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={ann.arrowEnd}
                              onChange={e => updateSelectedAnnotations({ arrowEnd: e.target.checked })}
                              className="w-4 h-4 rounded text-indigo-600"
                            />
                            <span className="text-xs text-slate-600">終点の矢印</span>
                          </label>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-500 mb-1 block">矢印のサイズ</label>
                          <div className="flex gap-2">
                            {(['small','medium','large'] as const).map(size => (
                              <button
                                key={size}
                                onClick={() => updateSelectedAnnotations({ arrowSize: size })}
                                className={`flex-1 py-1 text-xs rounded-lg border transition-all ${
                                  ann.arrowSize === size ? 'bg-indigo-50 border-indigo-400 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'
                                }`}
                              >
                                {size === 'small' ? '小' : size === 'medium' ? '中' : '大'}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-500 mb-1 block">矢印の形状</label>
                          <div className="flex gap-2">
                            {(['triangle','sharp','blunt'] as const).map(shape => (
                              <button
                                key={shape}
                                onClick={() => updateSelectedAnnotations({ arrowShape: shape })}
                                className={`flex-1 py-1 text-xs rounded-lg border transition-all ${
                                  ann.arrowShape === shape ? 'bg-indigo-50 border-indigo-400 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'
                                }`}
                              >
                                {shape === 'triangle' ? '三角' : shape === 'sharp' ? '鋭角' : '鈍角'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })() : null}

                  {activeEditorWidget && computedValues[activeEditorWidget.id] !== undefined && (
                    <div className="p-3 bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 rounded-xl shadow-sm">
                      <div className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-1 flex items-center gap-1"><Icons.ChartBar className="w-4 h-4"/> 現在の値</div>
                      <div className="text-2xl font-bold text-slate-800">{computedValues[activeEditorWidget.id].toLocaleString()}</div>
                      <div className="text-sm font-medium text-slate-500">{activeEditorWidget.title}</div>
                      <div className="text-[10px] font-mono text-slate-400 mt-1">ID: {activeEditorWidget.id}</div>
                    </div>
                  )}
                  {isMultiSelected ? (
                    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                      <div className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2"><Icons.Copy className="w-4 h-4"/> {selectedIds.length}個選択中</div>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-medium text-slate-500 mb-1 block">カラー</label>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="flex flex-col gap-1"><span className="text-[10px] text-slate-400">背景</span><input type="color" value={selectedWidgets[0]?.bgColor || '#ccc'} onChange={e=>updateSelectedDesign('bgColor',e.target.value)} className="w-full h-8 rounded border p-0.5 bg-white cursor-pointer"/></div>
                            <div className="flex flex-col gap-1"><span className="text-[10px] text-slate-400">文字</span><input type="color" value={selectedWidgets[0]?.textColor || '#ccc'} onChange={e=>updateSelectedDesign('textColor',e.target.value)} className="w-full h-8 rounded border p-0.5 bg-white cursor-pointer"/></div>
                            <div className="flex flex-col gap-1"><span className="text-[10px] text-slate-400">枠線</span><input type="color" value={selectedWidgets[0]?.borderColor || '#ccc'} onChange={e=>updateSelectedDesign('borderColor',e.target.value)} className="w-full h-8 rounded border p-0.5 bg-white cursor-pointer"/></div>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-500 mb-1 block">枠線の太さ</label>
                          <input type="range" min="0" max="20" value={selectedWidgets[0]?.borderWidth ?? 1} onChange={e=>updateSelectedDesign('borderWidth',parseInt(e.target.value))} className="w-full accent-indigo-500"/>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-500 mb-1 block">文字サイズ</label>
                          <input type="range" min="8" max="120" value={selectedWidgets[0]?.fontSize ?? 48} onChange={e=>updateSelectedDesign('fontSize',parseInt(e.target.value))} className="w-full accent-indigo-500"/>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-500 mb-1 block">背景透明度</label>
                          <input type="range" min="0" max="1" step="0.01" value={selectedWidgets[0]?.bgAlpha ?? 1} onChange={e=>updateSelectedDesign('bgAlpha',parseFloat(e.target.value))} className="w-full accent-indigo-500"/>
                        </div>
                      </div>
                    </div>
                  ) : activeEditorWidget && (
                    activeEditorWidget.type === 'scorecard' ||
                    activeEditorWidget.type === 'table-details' ||
                    activeEditorWidget.type === 'gauge' ||
                    activeEditorWidget.type === 'outline' ||
                    activeEditorWidget.type === 'slideshow' ||
                    activeEditorWidget.type === 'chart' ||
                    activeEditorWidget.type.startsWith('kpi-') ||
                    activeEditorWidget.type === 'group' ||
                    activeEditorWidget.type === 'comparison'
                  ) ? (
                    <>
                      <details open className="bg-white rounded-xl border border-slate-200 shadow-sm">
                        <summary className="text-xs font-bold text-slate-500 uppercase tracking-widest p-3 cursor-pointer flex items-center justify-between">
                          <span className="flex items-center gap-2"><Icons.FileText className="w-4 h-4"/> データ設定</span>
                        </summary>
                        <div className="p-3 space-y-4">
                          <div>
                            <label className="text-xs font-medium text-slate-500 mb-1 block">📂 データソース</label>
                            <select
                              value={activeEditorWidget.dataConfig?.sourceIndex || activeEditorWidget.dataSourceIndex || '001'}
                              onChange={e => {
                                const dc = activeEditorWidget.dataConfig || { sourceIndex: '001' };
                                updateSelectedDesign('dataConfig', { ...dc, sourceIndex: e.target.value });
                              }}
                              className="w-full text-sm border border-slate-200 px-2 py-1.5 rounded-lg bg-slate-50 text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-50 transition-all outline-none shadow-sm cursor-pointer"
                            >
                              <option value="none">なし（デザインのみ）</option>
                              {DATABASE_CONFIG.map(c => <option key={c.index} value={c.index}>{c.name}</option>)}
                            </select>
                          </div>

                          {(() => {
                            const dc = activeEditorWidget.dataConfig || ({} as DataConfig);
                            const srcIdx = dc.sourceIndex || activeEditorWidget.dataSourceIndex || '001';

                            if (srcIdx === 'none') {
                               return <div className="text-xs text-slate-400 p-2 text-center bg-slate-50 rounded-lg">データソースなしモードです。<br/>数値は表示されず、タイトルとスタイルのみが適用されます。</div>;
                            }

                            const allFields = availableFieldsBySource[srcIdx] || [];
                            const dateFields = dateFieldsBySource[srcIdx] || [];
                            const uniqueValsMap = fieldUniqueValuesBySource[srcIdx] || {};
                            const conditions = dc.filterConditions || [];

                            const fieldsWithLabel = allFields.map(f => {
                              const isRelation = relationFieldsBySource[srcIdx]?.has(f);
                              return isRelation ? `${f} (リレーション)` : f;
                            });

                            const currentFieldLabel = dc.field
                              ? (relationFieldsBySource[srcIdx]?.has(dc.field)
                                  ? `${dc.field} (リレーション)`
                                  : dc.field)
                              : '';

                            const addCondition = () => {
                              if (conditions.length >= 10) return;
                              const newCond = { field: '', value: '' };
                              updateSelectedDesign('dataConfig', { ...dc, filterConditions: [...conditions, newCond] });
                            };
                            const updateCondition = (index: number, key: 'field' | 'value', val: string) => {
                              const updated = conditions.map((cond, i) => {
                                if (i !== index) return cond;
                                if (key === 'field') {
                                  return { ...cond, field: val, value: '' };
                                }
                                return { ...cond, value: val };
                              });
                              updateSelectedDesign('dataConfig', { ...dc, filterConditions: updated });
                            };
                            const removeCondition = (index: number) => {
                              updateSelectedDesign('dataConfig', { ...dc, filterConditions: conditions.filter((_, i) => i !== index) });
                            };

                            return (
                              <>
                                <div>
  <div className="flex items-center justify-between mb-1.5">
    <label className="text-xs font-medium text-slate-700">📊 指標フィールド</label>
    <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">全{allFields.length}件</span>
  </div>
  <SelectWithSearch
    options={fieldsWithLabel}
    value={currentFieldLabel}
    onChange={v => {
      const actualField = v.replace(/\s*\(リレーション\)$/, '') || undefined;
      updateSelectedDesign('dataConfig', { ...dc, field: actualField });
    }}
    placeholder="未選択（全行カウント）"
  />
</div>

{/* ★ 集計方法（フィールド選択時のみ表示） */}
{dc.field && (
  <div>
    <label className="text-xs font-medium text-slate-700 mb-1 block">📐 集計方法</label>
    <select
      value={dc.aggregation ?? 'count'}
      onChange={e => updateSelectedDesign('dataConfig', { ...dc, aggregation: e.target.value as any })}
      className="w-full text-sm border border-slate-200 px-2 py-1.5 rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
    >
      <option value="count">件数</option>
      <option value="sum">合計</option>
      <option value="avg">平均</option>
      <option value="max">最大</option>
      <option value="min">最小</option>
    </select>
  </div>
)}

{dc.field && (() => {
  const uniqueVals = uniqueValsMap[dc.field] || [];
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-slate-700">🎯 指標値フィルター</label>
                                        {(dc.filterValue || dc.filterOperator) && (
                                          <button onClick={() => updateSelectedDesign('dataConfig', { ...dc, filterValue: undefined, filterOperator: undefined })} className="text-[10px] text-slate-400 hover:text-rose-500">クリア</button>
                                        )}
                                      </div>
                                      <div className="flex gap-2">
                                        <select
                                          value={dc.filterOperator || 'eq'}
                                          onChange={e => updateSelectedDesign('dataConfig', { ...dc, filterOperator: e.target.value as any })}
                                          className="w-1/3 text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white outline-none shrink-0"
                                        >
                                         <option value="eq">一致</option>
        <option value="neq">不一致</option>
        <option value="empty">空欄</option>
        <option value="not_empty">空欄以外</option>
                                        </select>
                                        {(!dc.filterOperator || dc.filterOperator === 'eq' || dc.filterOperator === 'neq') && (
  <div className="w-2/3">
                                            <SelectWithSearch
                                              options={uniqueVals}
                                              value={dc.filterValue || ''}
                                              onChange={v => updateSelectedDesign('dataConfig', { ...dc, filterValue: v })}
                                              placeholder="値で絞り込む"
                                            />
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}
                                <div className="pt-2 border-t border-slate-100">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-medium text-slate-700">📅 基準とする日付フィールド</label>
                                    <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">日付型{dateFields.length}件</span>
                                  </div>
                                  <SelectWithSearch
                                    options={dateFields}
                                    value={dc.dateFilterField || dc.scoreDateField || 'date'}
                                    onChange={v => updateSelectedDesign('dataConfig', { ...dc, dateFilterField: v })}
                                    placeholder="日付フィールドを選択"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-slate-700 mb-2 block">📅 期間フィルター</label>
                                  <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                                    {([
                                      { value: 'range', label: '期間連動' },
                                      { value: 'today', label: '本日のみ' },
                                      { value: 'none', label: '全期間' },
                                    ] as const).map(opt => (
                                      <button
                                        key={opt.value}
                                        onClick={() => updateSelectedDesign('dataConfig', { ...dc, dateFilter: opt.value })}
                                        className={`flex-1 text-sm font-medium py-1.5 rounded-lg transition-all shadow-sm ${
                                          (dc.dateFilter ?? 'range') === opt.value
                                          ? 'bg-white text-indigo-600'
                                          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 shadow-none'
                                        }`}
                                      >
                                        {opt.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <FilterConditionsEditor
  conditions={conditions}
  allFields={allFields}
  fieldUniqueValues={fieldUniqueValuesBySource[srcIdx] || {}}
  sourceIndex={srcIdx}
  onUpdate={(newConds) => updateSelectedDesign('dataConfig', { ...dc, filterConditions: newConds })}
  maxConditions={10}
/>

                                {activeEditorWidget.type === 'comparison' && (
  <div className="space-y-4 pt-4 border-t border-slate-100">
    <label className="text-xs font-bold text-slate-700">🔗 比較設定</label>

    <div>
      <label className="text-xs font-medium text-slate-500 mb-1 block">実績ラベル</label>
      <input
        type="text"
        value={activeEditorWidget.dataConfig?.compareActualLabel || '実績'}
        onChange={e => updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, compareActualLabel: e.target.value })}
        className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white outline-none"
      />
    </div>

    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-slate-500">実績の計算要素</label>
        <span className="text-[10px] text-slate-400">
          {(activeEditorWidget.dataConfig?.compareActualItems || []).length}/20
        </span>
      </div>

      <div className="text-[11px] font-bold text-indigo-600 mb-1">
        実績合計: {(() => {
          const items = activeEditorWidget.dataConfig?.compareActualItems || [];
          return items.reduce((sum, it) => {
            const val = allWidgetValues[it.widgetId] ?? 0;
            return it.operator === 'minus' ? sum - val : sum + val;
          }, 0).toLocaleString();
        })()}
      </div>

      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
        {(activeEditorWidget.dataConfig?.compareActualItems || []).map((item, idx) => (
          <div key={idx}>
            <div className="flex items-center gap-1">
              <select
                value={item.operator}
                onChange={e => {
                  const newItems = [...(activeEditorWidget.dataConfig?.compareActualItems || [])];
                  newItems[idx] = { ...newItems[idx], operator: e.target.value as 'plus' | 'minus' };
                  updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, compareActualItems: newItems });
                }}
                className="w-12 text-xs border border-slate-200 rounded px-1 py-1.5 bg-white outline-none shrink-0"
              >
                <option value="plus">＋</option>
                <option value="minus">－</option>
              </select>

              <SelectWithSearch
                options={(() => {
                  const allWidgets = dashboards.flatMap(page => page.layout);
                  return allWidgets
                    .filter(w => ['scorecard', 'kpi-total', 'kpi-today', 'kpi-filtered'].includes(w.type))
                    .map(w => `${w.title || w.type} (${w.id})`);
                })()}
                value={(() => {
                  const wid = item.widgetId;
                  if (!wid) return '';
                  const allWidgets = dashboards.flatMap(page => page.layout);
                  const w = allWidgets.find(w => w.id === wid);
                  return w ? `${w.title || w.type} (${wid})` : wid;
                })()}
                onChange={v => {
                  const match = v.match(/\(([^)]+)\)$/);
                  const newId = match ? match[1] : v;
                  const newItems = [...(activeEditorWidget.dataConfig?.compareActualItems || [])];
                  newItems[idx] = { ...newItems[idx], widgetId: newId };
                  updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, compareActualItems: newItems });
                }}
                placeholder="ウィジェットを選択"
              />

              <button
                onClick={() => {
                  const newItems = (activeEditorWidget.dataConfig?.compareActualItems || []).filter((_, i) => i !== idx);
                  updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, compareActualItems: newItems.length > 0 ? newItems : undefined });
                }}
                className="text-slate-400 hover:text-rose-500 p-1 shrink-0"
              >✕</button>
            </div>

            <div className="text-[9px] text-slate-400 ml-14">
              {item.widgetId
                ? (allWidgetValues[item.widgetId] !== undefined
                    ? `値: ${allWidgetValues[item.widgetId].toLocaleString()}`
                    : '値なし')
                : ''}
            </div>
          </div>
        ))}
      </div>

      {(activeEditorWidget.dataConfig?.compareActualItems || []).length < 20 && (
        <button
          onClick={() => {
            const newItems = [...(activeEditorWidget.dataConfig?.compareActualItems || []), { widgetId: '', operator: 'plus' as const }];
            updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, compareActualItems: newItems });
          }}
          className="w-full text-xs py-1.5 border-2 border-dashed border-slate-200 bg-slate-50 rounded-lg text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-all flex items-center justify-center gap-1 mt-1"
        >
          <Icons.Plus className="w-3 h-3" /> 実績に項目を追加
        </button>
      )}
    </div>

    <div className="border-t border-slate-100" />

    <div>
      <label className="text-xs font-medium text-slate-500 mb-1 block">目標ラベル</label>
      <input
        type="text"
        value={activeEditorWidget.dataConfig?.compareTargetLabel || '目標'}
        onChange={e => updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, compareTargetLabel: e.target.value })}
        className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white outline-none"
      />
    </div>

    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-slate-500">目標の計算要素</label>
        <span className="text-[10px] text-slate-400">
          {(activeEditorWidget.dataConfig?.compareTargetItems || []).length}/20
        </span>
      </div>

      <div className="text-[11px] font-bold text-indigo-600 mb-1">
        目標合計: {(() => {
          const items = activeEditorWidget.dataConfig?.compareTargetItems || [];
          return items.reduce((sum, it) => {
            const val = allWidgetValues[it.widgetId] ?? 0;
            return it.operator === 'minus' ? sum - val : sum + val;
          }, 0).toLocaleString();
        })()}
      </div>

      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
        {(activeEditorWidget.dataConfig?.compareTargetItems || []).map((item, idx) => (
          <div key={idx}>
            <div className="flex items-center gap-1">
              <select
                value={item.operator}
                onChange={e => {
                  const newItems = [...(activeEditorWidget.dataConfig?.compareTargetItems || [])];
                  newItems[idx] = { ...newItems[idx], operator: e.target.value as 'plus' | 'minus' };
                  updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, compareTargetItems: newItems });
                }}
                className="w-12 text-xs border border-slate-200 rounded px-1 py-1.5 bg-white outline-none shrink-0"
              >
                <option value="plus">＋</option>
                <option value="minus">－</option>
              </select>

              <SelectWithSearch
                options={(() => {
                  const allWidgets = dashboards.flatMap(page => page.layout);
                  return allWidgets
                    .filter(w => ['scorecard', 'kpi-total', 'kpi-today', 'kpi-filtered'].includes(w.type))
                    .map(w => `${w.title || w.type} (${w.id})`);
                })()}
                value={(() => {
                  const wid = item.widgetId;
                  if (!wid) return '';
                  const allWidgets = dashboards.flatMap(page => page.layout);
                  const w = allWidgets.find(w => w.id === wid);
                  return w ? `${w.title || w.type} (${wid})` : wid;
                })()}
                onChange={v => {
                  const match = v.match(/\(([^)]+)\)$/);
                  const newId = match ? match[1] : v;
                  const newItems = [...(activeEditorWidget.dataConfig?.compareTargetItems || [])];
                  newItems[idx] = { ...newItems[idx], widgetId: newId };
                  updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, compareTargetItems: newItems });
                }}
                placeholder="ウィジェットを選択"
              />

              <button
                onClick={() => {
                  const newItems = (activeEditorWidget.dataConfig?.compareTargetItems || []).filter((_, i) => i !== idx);
                  updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, compareTargetItems: newItems.length > 0 ? newItems : undefined });
                }}
                className="text-slate-400 hover:text-rose-500 p-1 shrink-0"
              >✕</button>
            </div>

            <div className="text-[9px] text-slate-400 ml-14">
              {item.widgetId
                ? (allWidgetValues[item.widgetId] !== undefined
                    ? `値: ${allWidgetValues[item.widgetId].toLocaleString()}`
                    : '値なし')
                : ''}
            </div>
          </div>
        ))}
      </div>

      {(activeEditorWidget.dataConfig?.compareTargetItems || []).length < 20 && (
        <button
          onClick={() => {
            const newItems = [...(activeEditorWidget.dataConfig?.compareTargetItems || []), { widgetId: '', operator: 'plus' as const }];
            updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, compareTargetItems: newItems });
          }}
          className="w-full text-xs py-1.5 border-2 border-dashed border-slate-200 bg-slate-50 rounded-lg text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-all flex items-center justify-center gap-1 mt-1"
        >
          <Icons.Plus className="w-3 h-3" /> 目標に項目を追加
        </button>
      )}
    </div>
  </div>
)}

                                {activeEditorWidget.type === 'table-details' && (
                                  <div className="space-y-3 pt-4 border-t border-slate-100">
                                    <label className="text-xs font-bold text-slate-700">📋 表示カラム</label>
                                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2">
                                      {allFields.map(field => {
                                        const selected = activeEditorWidget.tableConfig?.columns ?? [];
                                        const isChecked = selected.length === 0 || selected.includes(field);
                                        return (
                                          <label key={field} className="flex items-center gap-2.5 text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg transition-colors border border-transparent hover:border-slate-200">
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={e => {
                                                const current = activeEditorWidget.tableConfig?.columns ?? [];
                                                let next: string[];
                                                if (e.target.checked) {
                                                  if (current.length === 0) {
                                                    next = allFields.filter(f => f !== field);
                                                  } else {
                                                    next = [...new Set([...current, field])];
                                                  }
                                                } else {
                                                  if (current.length === 0) {
                                                    next = [field];
                                                  } else {
                                                    next = current.filter(f => f !== field);
                                                  }
                                                }
                                                updateSelectedDesign('_multi', { tableConfig: { ...activeEditorWidget.tableConfig, columns: next.length === allFields.length ? undefined : next } });
                                              }}
                                              className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                            />
                                            <span className="truncate">{field}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                    <p className="text-xs font-medium text-slate-400 bg-slate-50 px-3 py-2 rounded-lg inline-block">💡 チェックがない場合は全カラム表示</p>
                                  </div>
                                )}
                                {activeEditorWidget.type === 'table-details' && (
  <div className="space-y-3 pt-4 border-t border-slate-100">
    <label className="text-xs font-bold text-slate-700">📏 列幅設定</label>
    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
      {allFields.map(field => {
        const currentWidth = activeEditorWidget.tableConfig?.columnWidths?.[field] || '';
        return (
          <div key={field} className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600 w-24 truncate">{field}</span>
            <input
              type="number"
              min="40"
              max="600"
              value={currentWidth}
              onChange={e => {
                const val = e.target.value ? Number(e.target.value) : undefined;
                const current = activeEditorWidget.tableConfig || {};
                const widths = { ...(current.columnWidths || {}) };
                if (val) {
                  widths[field] = val;
                } else {
                  delete widths[field];
                }
                updateSelectedDesign('_multi', {
                  tableConfig: { ...current, columnWidths: Object.keys(widths).length > 0 ? widths : undefined }
                });
              }}
              className="w-20 text-xs border border-slate-200 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              placeholder="自動"
            />
            <span className="text-[10px] text-slate-400">px</span>
            <button
              onClick={() => {
                const current = activeEditorWidget.tableConfig || {};
                const widths = { ...(current.columnWidths || {}) };
                delete widths[field];
                updateSelectedDesign('_multi', {
                  tableConfig: { ...current, columnWidths: Object.keys(widths).length > 0 ? widths : undefined }
                });
              }}
              className="text-slate-400 hover:text-rose-500 text-[10px]"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
    <p className="text-[9px] text-slate-400">数値を入力するとその幅で固定されます（空欄で自動調整）</p>
    <button
      onClick={() => {
        const current = activeEditorWidget.tableConfig || {};
        updateSelectedDesign('_multi', {
          tableConfig: { ...current, columnWidths: undefined }
        });
      }}
      className="w-full text-xs py-2 border border-rose-200 bg-rose-50 rounded-lg text-rose-500 hover:bg-rose-100 transition-all"
    >
      すべての列幅設定を解除
    </button>
  </div>
)}
{activeEditorWidget.type === 'table-details' && (
  <>
    <div className="space-y-3 pt-4 border-t border-slate-100">
      <label className="text-xs font-bold text-slate-700">📐 行の高さ</label>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min="12"
          max="120"
          step="2"
          value={activeEditorWidget.tableConfig?.rowHeight || 0}
          onChange={e => {
            const val = Number(e.target.value);
            const current = activeEditorWidget.tableConfig || {};
            updateSelectedDesign('_multi', {
              tableConfig: { ...current, rowHeight: val > 0 ? val : undefined }
            });
          }}
          className="flex-1 accent-indigo-500"
        />
        <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg min-w-[60px] text-center">
          {activeEditorWidget.tableConfig?.rowHeight 
            ? `${activeEditorWidget.tableConfig.rowHeight}px` 
            : 'Auto'}
        </span>
      </div>
      <p className="text-[9px] text-slate-400">スライダーで高さを指定（Autoは内容に合わせて自動調整）</p>
    </div>
  </>
)}
                                {activeEditorWidget.type === 'table-details' && (
  <div className="space-y-3 pt-4 border-t border-slate-100">
    <label className="text-xs font-bold text-slate-700">📊 Y軸（グループ化）</label>
    <p className="text-[10px] text-slate-400">指定したフィールドの値でピボット的にグループ行を挿入します</p>
    <div>
      <label className="text-xs font-medium text-slate-500 mb-1 block">グループ化フィールド</label>
      <SelectWithSearch
        options={availableFieldsBySource[activeEditorWidget.dataConfig?.sourceIndex || activeEditorWidget.dataSourceIndex || '001'] || []}
        value={activeEditorWidget.tableConfig?.groupBy || ''}
        onChange={v => {
          const current = activeEditorWidget.tableConfig || {};
          updateSelectedDesign('_multi', {
            tableConfig: { ...current, groupBy: v || undefined }
          });
        }}
        placeholder="グループ化しない"
      />
    </div>
    {activeEditorWidget.tableConfig?.groupBy && (
      <>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">グループ内ソートフィールド</label>
          <SelectWithSearch
            options={availableFieldsBySource[activeEditorWidget.dataConfig?.sourceIndex || activeEditorWidget.dataSourceIndex || '001'] || []}
            value={activeEditorWidget.tableConfig?.groupSortField || ''}
            onChange={v => {
              const current = activeEditorWidget.tableConfig || {};
              updateSelectedDesign('_multi', {
                tableConfig: { ...current, groupSortField: v || undefined }
              });
            }}
            placeholder="デフォルト順"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">グループ内ソート順</label>
          <div className="flex gap-2">
            {(['asc', 'desc'] as const).map(order => (
              <button
                key={order}
                onClick={() => {
                  const current = activeEditorWidget.tableConfig || {};
                  updateSelectedDesign('_multi', {
                    tableConfig: { ...current, groupSortOrder: order }
                  });
                }}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                  (activeEditorWidget.tableConfig?.groupSortOrder || 'asc') === order
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-700'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                {order === 'asc' ? '昇順 ▲' : '降順 ▼'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">グループ集計行</label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={activeEditorWidget.tableConfig?.showGroupSubtotal !== false}
              onChange={e => {
                const current = activeEditorWidget.tableConfig || {};
                updateSelectedDesign('_multi', {
                  tableConfig: { ...current, showGroupSubtotal: e.target.checked }
                });
              }}
              className="w-4 h-4 rounded text-indigo-600"
            />
            <span className="text-xs text-slate-600">グループ内の件数を表示</span>
          </label>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">グループヘッダー背景色</label>
          <input
            type="color"
            value={activeEditorWidget.tableConfig?.groupHeaderBgColor || '#f1f5f9'}
            onChange={e => {
              const current = activeEditorWidget.tableConfig || {};
              updateSelectedDesign('_multi', {
                tableConfig: { ...current, groupHeaderBgColor: e.target.value }
              });
            }}
            className="w-full h-8 rounded border p-0.5 bg-white cursor-pointer"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">グループヘッダー文字色</label>
          <input
            type="color"
            value={activeEditorWidget.tableConfig?.groupHeaderTextColor || '#334155'}
            onChange={e => {
              const current = activeEditorWidget.tableConfig || {};
              updateSelectedDesign('_multi', {
                tableConfig: { ...current, groupHeaderTextColor: e.target.value }
              });
            }}
            className="w-full h-8 rounded border p-0.5 bg-white cursor-pointer"
          />
        </div>

        <div className="space-y-2 pt-3 border-t border-slate-100">
          <label className="text-xs font-medium text-slate-500 mb-1 block">除外キーワード</label>
          <p className="text-[10px] text-slate-400 mb-1">ここで指定した値の行はグループ化から除外されます</p>
          <div className="flex flex-wrap gap-1 mb-2">
            {(activeEditorWidget.tableConfig?.excludeKeywords || []).map((keyword, idx) => (
              <span key={idx} className="inline-flex items-center gap-1 bg-slate-100 px-2 py-1 rounded text-xs text-slate-700">
                {keyword}
                <button
                  onClick={() => {
                    const newKeywords = (activeEditorWidget.tableConfig?.excludeKeywords || []).filter((_, i) => i !== idx);
                    updateSelectedDesign('_multi', {
                      tableConfig: { ...activeEditorWidget.tableConfig, excludeKeywords: newKeywords.length > 0 ? newKeywords : undefined }
                    });
                  }}
                  className="text-slate-400 hover:text-rose-500"
                >✕</button>
              </span>
            ))}
          </div>
          <input
            type="text"
            placeholder="キーワードを入力して Enter"
            value={excludeInput}
            onChange={(e) => setExcludeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && excludeInput.trim()) {
                const newKeyword = excludeInput.trim();
                const currentKeywords = activeEditorWidget.tableConfig?.excludeKeywords || [];
                if (!currentKeywords.includes(newKeyword)) {
                  updateSelectedDesign('_multi', {
                    tableConfig: { ...activeEditorWidget.tableConfig, excludeKeywords: [...currentKeywords, newKeyword] }
                  });
                }
                setExcludeInput('');
              }
            }}
            className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>

        <button
          onClick={() => {
            const current = activeEditorWidget.tableConfig || {};
            updateSelectedDesign('_multi', {
              tableConfig: {
                ...current,
                groupBy: undefined,
                groupSortField: undefined,
                groupSortOrder: undefined,
                showGroupSubtotal: undefined,
                groupHeaderBgColor: undefined,
                groupHeaderTextColor: undefined,
                excludeKeywords: undefined,
                excludeKeywordField: undefined,
              }
            });
          }}
          className="w-full text-xs py-2 border border-rose-200 bg-rose-50 rounded-lg text-rose-500 hover:bg-rose-100 transition-all"
        >
          グループ化を解除
        </button>
      </>
    )}
  </div>
)}

{activeEditorWidget.type === 'table-details' && activeEditorWidget.tableConfig?.groupBy && (
  <>
    <div className="space-y-3 pt-4 border-t border-slate-100">
      <label className="text-xs font-bold text-slate-700">🎨 グループヘッダー条件付きスタイル</label>
      <p className="text-[9px] text-slate-400">グループ名の条件に一致した場合にヘッダー色が適用されます</p>

      {(activeEditorWidget.tableConfig?.groupHeaderConditionalStyles || []).map((rule, idx) => (
        <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500">ルール #{idx + 1}</span>
            <button
              onClick={() => {
                const current = activeEditorWidget.tableConfig || {};
                const styles = (current.groupHeaderConditionalStyles || []).filter((_, i) => i !== idx);
                updateSelectedDesign('_multi', {
                  tableConfig: { ...current, groupHeaderConditionalStyles: styles.length > 0 ? styles : undefined }
                });
              }}
              className="text-rose-400 hover:text-rose-600 text-[10px]"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-slate-400 block mb-0.5">条件</label>
              <select
                value={rule.condition}
                onChange={e => {
                  const current = activeEditorWidget.tableConfig || {};
                  const styles = [...(current.groupHeaderConditionalStyles || [])];
                  styles[idx] = { ...styles[idx], condition: e.target.value as any };
                  updateSelectedDesign('_multi', {
                    tableConfig: { ...current, groupHeaderConditionalStyles: styles }
                  });
                }}
                className="w-full text-xs border border-slate-200 rounded px-2 py-1 bg-white outline-none"
              >
                <option value="contains">含む</option>
                <option value="starts_with">で始まる</option>
                <option value="ends_with">で終わる</option>
                <option value="equals">一致</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] text-slate-400 block mb-0.5">テキスト</label>
              <input
                type="text"
                value={rule.text}
                onChange={e => {
                  const current = activeEditorWidget.tableConfig || {};
                  const styles = [...(current.groupHeaderConditionalStyles || [])];
                  styles[idx] = { ...styles[idx], text: e.target.value };
                  updateSelectedDesign('_multi', {
                    tableConfig: { ...current, groupHeaderConditionalStyles: styles }
                  });
                }}
                className="w-full text-xs border border-slate-200 rounded px-2 py-1 bg-white outline-none"
                placeholder="キーワード"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-slate-400 block mb-0.5">背景色</label>
              <input
                type="color"
                value={rule.bgColor}
                onChange={e => {
                  const current = activeEditorWidget.tableConfig || {};
                  const styles = [...(current.groupHeaderConditionalStyles || [])];
                  styles[idx] = { ...styles[idx], bgColor: e.target.value };
                  updateSelectedDesign('_multi', {
                    tableConfig: { ...current, groupHeaderConditionalStyles: styles }
                  });
                }}
                className="w-full h-8 rounded border p-0.5 bg-white cursor-pointer"
              />
            </div>
            <div>
              <label className="text-[9px] text-slate-400 block mb-0.5">文字色</label>
              <input
                type="color"
                value={rule.textColor}
                onChange={e => {
                  const current = activeEditorWidget.tableConfig || {};
                  const styles = [...(current.groupHeaderConditionalStyles || [])];
                  styles[idx] = { ...styles[idx], textColor: e.target.value };
                  updateSelectedDesign('_multi', {
                    tableConfig: { ...current, groupHeaderConditionalStyles: styles }
                  });
                }}
                className="w-full h-8 rounded border p-0.5 bg-white cursor-pointer"
              />
            </div>
          </div>
        </div>
      ))}

      <button
        onClick={() => {
          const current = activeEditorWidget.tableConfig || {};
          const styles = [...(current.groupHeaderConditionalStyles || [])];
          styles.push({ condition: 'contains', text: '', bgColor: '#fef2f2', textColor: '#dc2626' });
          updateSelectedDesign('_multi', {
            tableConfig: { ...current, groupHeaderConditionalStyles: styles }
          });
        }}
        className="w-full text-xs py-2 border-2 border-dashed border-slate-200 bg-slate-50 rounded-lg text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-all flex items-center justify-center gap-1"
      >
        <Icons.Plus className="w-3 h-3"/> 条件を追加
      </button>
    </div>

    <div className="space-y-3 pt-4 border-t border-slate-100">
      <label className="text-xs font-bold text-slate-700">📐 グループヘッダーサイズ</label>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-medium text-slate-500 mb-1 block">高さ (px)</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="20"
              max="80"
              step="2"
              value={activeEditorWidget.tableConfig?.groupHeaderHeight || 48}
              onChange={e => {
                const current = activeEditorWidget.tableConfig || {};
                updateSelectedDesign('_multi', {
                  tableConfig: { ...current, groupHeaderHeight: Number(e.target.value) }
                });
              }}
              className="flex-1 accent-indigo-500"
            />
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded min-w-[40px] text-center flex-shrink-0">
              {activeEditorWidget.tableConfig?.groupHeaderHeight || 48}px
            </span>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-medium text-slate-500 mb-1 block">文字サイズ (px)</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="8"
              max="24"
              step="1"
              value={activeEditorWidget.tableConfig?.groupHeaderFontSize || 14}
              onChange={e => {
                const current = activeEditorWidget.tableConfig || {};
                updateSelectedDesign('_multi', {
                  tableConfig: { ...current, groupHeaderFontSize: Number(e.target.value) }
                });
              }}
              className="flex-1 accent-indigo-500"
            />
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded min-w-[40px] text-center flex-shrink-0">
              {activeEditorWidget.tableConfig?.groupHeaderFontSize || 14}px
            </span>
          </div>
        </div>
      </div>
    </div>
  </>
)}
                                {activeEditorWidget.type === 'chart' && (
                                  <div className="space-y-3 pt-4 border-t border-slate-100">
                                    <label className="text-xs font-bold text-slate-700">📊 グラフ詳細設定</label>

                                    <div>
                                      <label className="text-xs font-medium text-slate-500 mb-1 block">グラフの種類</label>
                                      <select
                                        value={dc.chartType || 'bar'}
                                        onChange={e => updateSelectedDesign('dataConfig', { ...dc, chartType: e.target.value })}
                                        className="w-full text-sm border border-slate-200 px-2 py-1.5 rounded-lg bg-white"
                                      >
                                        <option value="bar">棒グラフ (Bar)</option>
                                        <option value="line">折れ線グラフ (Line)</option>
                                        <option value="donut">円グラフ (Donut)</option>
                                      </select>
                                    </div>

                                    <div>
                                      <label className="text-xs font-medium text-slate-500 mb-1 block">X軸 (ディメンション)</label>
                                      <SelectWithSearch
                                        options={allFields}
                                        value={dc.xField || 'status'}
                                        onChange={v => updateSelectedDesign('dataConfig', { ...dc, xField: v })}
                                        placeholder="フィールドを選択"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs font-medium text-slate-500 mb-1 block">Y軸 (メジャー・集計値)</label>
                                      <SelectWithSearch
                                        options={['count', ...allFields]}
                                        value={dc.yField || 'count'}
                                        onChange={v => updateSelectedDesign('dataConfig', { ...dc, yField: v })}
                                        placeholder="count または 数値フィールド"
                                      />
                                    </div>

                                    {dc.yField && dc.yField !== 'count' && (
                                      <div>
                                        <label className="text-xs font-medium text-slate-500 mb-1 block">集計方法 (Y軸)</label>
                                        <select
                                          value={dc.chartAggregation || 'sum'}
                                          onChange={e => updateSelectedDesign('dataConfig', { ...dc, chartAggregation: e.target.value })}
                                          className="w-full text-sm border border-slate-200 px-2 py-1.5 rounded-lg bg-white"
                                        >
                                          <option value="sum">合計 (Sum)</option>
                                          <option value="avg">平均 (Avg)</option>
                                          <option value="max">最大 (Max)</option>
                                          <option value="min">最小 (Min)</option>
                                        </select>
                                      </div>
                                    )}

                                    <div>
                                      <label className="text-xs font-medium text-slate-500 mb-1 block">並び順</label>
                                      <select
                                        value={dc.sortOrder || 'value-desc'}
                                        onChange={e => updateSelectedDesign('dataConfig', { ...dc, sortOrder: e.target.value })}
                                        className="w-full text-sm border border-slate-200 px-2 py-1.5 rounded-lg bg-white"
                                      >
                                        <option value="value-desc">値の大きい順</option>
                                        <option value="value-asc">値の小さい順</option>
                                        <option value="asc">名前 昇順</option>
                                        <option value="desc">名前 降順</option>
                                      </select>
                                    </div>

                                    <div>
                                      <label className="text-xs font-medium text-slate-500 mb-1 block">表示件数上限</label>
                                      <input
                                        type="number"
                                        value={dc.limit ?? 20}
                                        onChange={e => updateSelectedDesign('dataConfig', { ...dc, limit: Number(e.target.value) })}
                                        className="w-full text-sm border border-slate-200 px-2 py-1.5 rounded-lg bg-white"
                                      />
                                    </div>

                                    <div className="space-y-4 pt-4 border-t border-slate-100">
                                      <label className="text-xs font-bold text-slate-700">📊 複合グラフ設定（棒＋折れ線＋目標線）</label>
                                      <p className="text-[10px] text-slate-400">以下を設定すると、X軸=日付の複合グラフに切り替わります</p>

                                      <details open>
                                        <summary className="text-xs font-semibold text-slate-600 cursor-pointer py-1">🟦 棒グラフ系列</summary>
                                        <div className="pl-2 space-y-2 mt-2">
                                          <div>
                                            <label className="text-[10px] text-slate-500">データソース</label>
                                            <select
                                              value={dc.barSourceIndex || ''}
                                              onChange={e => updateSelectedDesign('dataConfig', { ...dc, barSourceIndex: e.target.value || undefined })}
                                              className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white mt-0.5"
                                            >
                                              <option value="">未設定（メインソース流用）</option>
                                              {DATABASE_CONFIG.map(c => <option key={c.index} value={c.index}>{c.name}</option>)}
                                            </select>
                                          </div>
                                          <div>
                                            <label className="text-[10px] text-slate-500">集計フィールド</label>
                                            <SelectWithSearch
                                              options={availableFieldsBySource[dc.barSourceIndex || srcIdx] || []}
                                              value={dc.barField || ''}
                                              onChange={v => updateSelectedDesign('dataConfig', { ...dc, barField: v || undefined })}
                                              placeholder="件数（count）"
                                            />
                                          </div>
                                          <div>
                                            <label className="text-[10px] text-slate-500">集計方法</label>
                                            <select
                                              value={dc.barAggregation || 'sum'}
                                              onChange={e => updateSelectedDesign('dataConfig', { ...dc, barAggregation: e.target.value as any })}
                                              className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white mt-0.5"
                                            >
                                              <option value="count">件数</option>
                                              <option value="sum">合計</option>
                                              <option value="avg">平均</option>
                                              <option value="max">最大</option>
                                              <option value="min">最小</option>
                                            </select>
                                          </div>
                                          <div>
                                            <label className="text-[10px] text-slate-500">ラベル名</label>
                                            <input type="text" value={dc.barLabel || ''} onChange={e => updateSelectedDesign('dataConfig', { ...dc, barLabel: e.target.value })} className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white mt-0.5" placeholder="売上" />
                                          </div>
                                          <div>
                                            <label className="text-[10px] text-slate-500">バーの色</label>
                                            <input type="color" value={dc.barColor || '#6366f1'} onChange={e => updateSelectedDesign('dataConfig', { ...dc, barColor: e.target.value })} className="w-full h-7 rounded border p-0.5 bg-white cursor-pointer mt-0.5" />
                                          </div>
                                          <div>
                                            <label className="text-[10px] text-slate-500">日付フィールド</label>
                                            <SelectWithSearch
                                              options={dateFieldsBySource[dc.barSourceIndex || srcIdx] || []}
                                              value={dc.comboDateField || 'date'}
                                              onChange={v => updateSelectedDesign('dataConfig', { ...dc, comboDateField: v })}
                                              placeholder="date"
                                            />
                                          </div>
                                        </div>
                                      </details>

                                      <details open>
                                        <summary className="text-xs font-semibold text-slate-600 cursor-pointer py-1">📈 折れ線グラフ系列</summary>
                                        <div className="pl-2 space-y-2 mt-2">
                                          <div>
                                            <label className="text-[10px] text-slate-500">データソース</label>
                                            <select
                                              value={dc.lineSourceIndex || ''}
                                              onChange={e => updateSelectedDesign('dataConfig', { ...dc, lineSourceIndex: e.target.value || undefined })}
                                              className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white mt-0.5"
                                            >
                                              <option value="">未設定（棒グラフと同じソース）</option>
                                              {DATABASE_CONFIG.map(c => <option key={c.index} value={c.index}>{c.name}</option>)}
                                            </select>
                                          </div>
                                          <div>
                                            <label className="text-[10px] text-slate-500">集計フィールド</label>
                                            <SelectWithSearch
                                              options={availableFieldsBySource[dc.lineSourceIndex || dc.barSourceIndex || srcIdx] || []}
                                              value={dc.lineField || ''}
                                              onChange={v => updateSelectedDesign('dataConfig', { ...dc, lineField: v || undefined })}
                                              placeholder="未設定（非表示）"
                                            />
                                          </div>
                                          <div>
                                            <label className="text-[10px] text-slate-500">集計方法</label>
                                            <select
                                              value={dc.lineAggregation || 'sum'}
                                              onChange={e => updateSelectedDesign('dataConfig', { ...dc, lineAggregation: e.target.value as any })}
                                              className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white mt-0.5"
                                            >
                                              <option value="count">件数</option>
                                              <option value="sum">合計</option>
                                              <option value="avg">平均</option>
                                              <option value="max">最大</option>
                                              <option value="min">最小</option>
                                            </select>
                                          </div>
                                          <div>
                                            <label className="text-[10px] text-slate-500">ラベル名</label>
                                            <input type="text" value={dc.lineLabel || ''} onChange={e => updateSelectedDesign('dataConfig', { ...dc, lineLabel: e.target.value })} className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white mt-0.5" placeholder="粗利" />
                                          </div>
                                          <div>
                                            <label className="text-[10px] text-slate-500">線の色</label>
                                            <input type="color" value={dc.lineColor || '#10b981'} onChange={e => updateSelectedDesign('dataConfig', { ...dc, lineColor: e.target.value })} className="w-full h-7 rounded border p-0.5 bg-white cursor-pointer mt-0.5" />
                                          </div>
                                          <div>
                                            <label className="text-[10px] text-slate-500">日付フィールド</label>
                                            <SelectWithSearch
                                              options={dateFieldsBySource[dc.lineSourceIndex || dc.barSourceIndex || srcIdx] || []}
                                              value={dc.comboLineDateField || 'date'}
                                              onChange={v => updateSelectedDesign('dataConfig', { ...dc, comboLineDateField: v })}
                                              placeholder="date"
                                            />
                                          </div>
                                        </div>
                                      </details>

                                      <details>
                                        <summary className="text-xs font-semibold text-slate-600 cursor-pointer py-1">🎯 目標線（累積日割り）</summary>
                                        <div className="pl-2 space-y-2 mt-2">
                                          <div>
                                            <label className="text-[10px] text-slate-500">期間合計目標値</label>
                                            <input
                                              type="number"
                                              value={dc.comboTargetTotal ?? ''}
                                              onChange={e => updateSelectedDesign('dataConfig', { ...dc, comboTargetTotal: e.target.value ? Number(e.target.value) : undefined })}
                                              className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white mt-0.5"
                                              placeholder="例: 30（月30件目標）"
                                            />
                                          </div>
                                          <div>
                                            <label className="text-[10px] text-slate-500">目標線の色</label>
                                            <input type="color" value={dc.comboTargetColor || '#ef4444'} onChange={e => updateSelectedDesign('dataConfig', { ...dc, comboTargetColor: e.target.value })} className="w-full h-7 rounded border p-0.5 bg-white cursor-pointer mt-0.5" />
                                          </div>
                                          <div>
                                            <label className="text-[10px] text-slate-500">目標線の太さ</label>
                                            <input type="range" min="1" max="6" value={dc.comboTargetWidth ?? 2} onChange={e => updateSelectedDesign('dataConfig', { ...dc, comboTargetWidth: Number(e.target.value) })} className="w-full accent-indigo-500 mt-0.5" />
                                          </div>
                                          <div>
                                            <label className="text-[10px] text-slate-500">ラベル</label>
                                            <input type="text" value={dc.comboTargetLabel || ''} onChange={e => updateSelectedDesign('dataConfig', { ...dc, comboTargetLabel: e.target.value })} className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white mt-0.5" placeholder="目標" />
                                          </div>
                                          <div>
                                            <label className="text-[10px] text-slate-500 block mb-1">休業日（土日は自動除外）</label>
                                            <p className="text-[9px] text-slate-400 mb-1">1行1日付でISO形式（例: 2025-01-01）を入力</p>
                                            <textarea
                                              value={(dc.comboTargetWorkdays || []).join('\n')}
                                              onChange={e => {
                                                const days = e.target.value.split('\n').map(s => s.trim()).filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s));
                                                updateSelectedDesign('dataConfig', { ...dc, comboTargetWorkdays: days.length > 0 ? days : undefined });
                                              }}
                                              className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white resize-y min-h-[60px] mt-0.5"
                                              placeholder={"2025-01-01\n2025-01-13\n2025-02-11"}
                                            />
                                          </div>
                                        </div>
                                      </details>

                                      <div>
                                        <label className="text-[10px] text-slate-500 block mb-1">X軸の粒度</label>
                                        <div className="flex gap-2">
                                          {(['day', 'week', 'month'] as const).map(d => (
                                            <button
                                              key={d}
                                              onClick={() => updateSelectedDesign('dataConfig', { ...dc, comboDimension: d })}
                                              className={`flex-1 py-1 text-xs rounded-lg border transition-all ${(dc.comboDimension || 'day') === d ? 'bg-indigo-50 border-indigo-400 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'}`}
                                            >
                                              {d === 'day' ? '日' : d === 'week' ? '週' : '月'}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {activeEditorWidget.type === 'gauge' && (
                                  <div className="space-y-3 pt-4 border-t border-slate-100">
                                    <div className="pt-4 border-t border-slate-100">
                                      <label className="text-xs font-bold text-slate-700 mb-2 block">🎯 目標値設定</label>
                                      <div className="mb-3">
                                        <p className="text-xs text-slate-500 mb-2">目標値はデータソースから動的に取得します</p>
                                      </div>
                                      <div>
                                        <label className="text-xs font-medium text-slate-500 mb-1 block">目標値データソース</label>
                                        <select
                                          value={dc.targetSourceIndex || srcIdx}
                                          onChange={e => updateSelectedDesign('dataConfig', { ...dc, targetSourceIndex: e.target.value })}
                                          className="w-full text-sm border border-slate-200 px-2 py-1.5 rounded-lg bg-white"
                                        >
                                          {DATABASE_CONFIG.map(c => <option key={c.index} value={c.index}>{c.name}</option>)}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="text-xs font-medium text-slate-500 mb-1 block">目標値フィールド</label>
                                        <SelectWithSearch
                                          options={availableFieldsBySource[dc.targetSourceIndex || srcIdx] || []}
                                          value={dc.targetField || ''}
                                          onChange={v => updateSelectedDesign('dataConfig', { ...dc, targetField: v })}
                                          placeholder="フィールドを選択"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs font-medium text-slate-500 mb-1 block">目標値集計</label>
                                        <select
                                          value={dc.targetAggregation ?? 'sum'}
                                          onChange={e => updateSelectedDesign('dataConfig', { ...dc, targetAggregation: e.target.value as any })}
                                          className="w-full text-sm border border-slate-200 px-2 py-1.5 rounded-lg bg-white"
                                        >
                                          <option value="sum">合計</option>
                                          <option value="avg">平均</option>
                                          <option value="max">最大</option>
                                          <option value="min">最小</option>
                                          <option value="count">件数</option>
                                          <option value="none">生の値（最初のレコード）</option>
                                        </select>
                                      </div>
                                      <div>
                                        <label className="text-xs font-medium text-slate-500 mb-1 block">目標値期間フィルター</label>
                                        <select
                                          value={dc.targetDateFilter ?? dc.dateFilter ?? 'range'}
                                          onChange={e => updateSelectedDesign('dataConfig', { ...dc, targetDateFilter: e.target.value as any })}
                                          className="w-full text-sm border border-slate-200 px-2 py-1.5 rounded-lg bg-white"
                                        >
                                          <option value="range">期間連動</option>
                                          <option value="today">本日のみ</option>
                                          <option value="none">全期間</option>
                                        </select>
                                      </div>
                                      <div>
                                        <label className="text-xs font-medium text-slate-500 mb-1 block">目標値日付フィールド</label>
                                        <SelectWithSearch
                                          options={dateFieldsBySource[dc.targetSourceIndex || srcIdx] || []}
                                          value={dc.targetDateField || dc.scoreDateField || 'date'}
                                          onChange={v => updateSelectedDesign('dataConfig', { ...dc, targetDateField: v })}
                                          placeholder="日付フィールド"
                                        />
                                      </div>
                                      <div>
                                        <div className="flex items-center justify-between mb-2">
                                          <label className="text-xs font-medium text-slate-500 mb-1 block">目標値フィルター条件</label>
                                          <div className="flex gap-1">
                                            <button
                                              onClick={() => updateSelectedDesign('dataConfig', { ...dc, targetConditionLogic: 'and' })}
                                              className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-all ${
                                                (dc.targetConditionLogic ?? 'and') === 'and'
                                                  ? 'bg-indigo-100 text-indigo-700'
                                                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                              }`}
                                            >
                                              AND
                                            </button>
                                            <button
                                              onClick={() => updateSelectedDesign('dataConfig', { ...dc, targetConditionLogic: 'or' })}
                                              className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-all ${
                                                (dc.targetConditionLogic ?? 'and') === 'or'
                                                  ? 'bg-indigo-100 text-indigo-700'
                                                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                              }`}
                                            >
                                              OR
                                            </button>
                                          </div>
                                        </div>
                                        <div className="space-y-2">
                                          {(dc.targetFilterConditions || []).map((cond, idx) => (
                                            <div key={idx} className="flex gap-1 items-center bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                                              <div className="flex-1 min-w-0">
                                                <SelectWithSearch
                                                  options={availableFieldsBySource[dc.targetSourceIndex || srcIdx] || []}
                                                  value={cond.field}
                                                  onChange={v => {
                                                    const newConds = [...(dc.targetFilterConditions || [])];
                                                    newConds[idx] = { ...newConds[idx], field: v, value: '' };
                                                    updateSelectedDesign('dataConfig', { ...dc, targetFilterConditions: newConds });
                                                  }}
                                                  placeholder="フィールド"
                                                />
                                              </div>
                                              <select
                                                value={cond.operator || 'eq'}
                                                onChange={e => {
                                                  const newConds = [...(dc.targetFilterConditions || [])];
                                                  newConds[idx] = { ...newConds[idx], operator: e.target.value as any };
                                                  updateSelectedDesign('dataConfig', { ...dc, targetFilterConditions: newConds });
                                                }}
                                                className="w-16 text-[10px] border border-slate-200 rounded px-0.5 py-1.5 bg-white outline-none shrink-0"
                                              >
                                                <option value="eq">一致</option>
        <option value="neq">不一致</option>
        <option value="empty">空欄</option>
        <option value="not_empty">空欄以外</option>
                                              </select>
                                              {(!cond.operator || cond.operator === 'eq' || cond.operator === 'neq') && (
                                                <div className="flex-1 min-w-0">
                                                  <SelectWithSearch
                                                    options={cond.field ? (fieldUniqueValuesBySource[dc.targetSourceIndex || srcIdx]?.[cond.field] || []) : []}
                                                    value={cond.value}
                                                    onChange={v => {
                                                      const newConds = [...(dc.targetFilterConditions || [])];
                                                      newConds[idx] = { ...newConds[idx], value: v };
                                                      updateSelectedDesign('dataConfig', { ...dc, targetFilterConditions: newConds });
                                                    }}
                                                    placeholder="値"
                                                  />
                                                </div>
                                              )}
                                              <button
                                                onClick={() => {
                                                  const newConds = (dc.targetFilterConditions || []).filter((_, i) => i !== idx);
                                                  updateSelectedDesign('dataConfig', { ...dc, targetFilterConditions: newConds });
                                                }}
                                                className="text-rose-500 p-1 shrink-0 hover:bg-rose-50 rounded"
                                              >
                                                <Icons.X className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          ))}
                                          <button
                                            onClick={() => {
                                              const newConds = [...(dc.targetFilterConditions || []), { field: '', value: '' }];
                                              updateSelectedDesign('dataConfig', { ...dc, targetFilterConditions: newConds });
                                            }}
                                            className="text-xs text-indigo-600 hover:text-indigo-700"
                                          >
                                            + 条件追加
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                    <div>
                                      <label className="text-xs font-medium text-slate-500 mb-1 block">ゲージ最小値</label>
                                      <input
                                        type="number"
                                        value={dc.gaugeMinValue ?? 0}
                                        onChange={e => updateSelectedDesign('dataConfig', { ...dc, gaugeMinValue: Number(e.target.value) })}
                                        className="w-full text-sm border border-slate-200 px-2 py-1.5 rounded-lg bg-white"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs font-medium text-slate-500 mb-1 block">単位</label>
                                      <input
                                        type="text"
                                        value={dc.gaugeUnit || ''}
                                        onChange={e => updateSelectedDesign('dataConfig', { ...dc, gaugeUnit: e.target.value })}
                                        className="w-full text-sm border border-slate-200 px-2 py-1.5 rounded-lg bg-white"
                                        placeholder="万円, 件, %"
                                      />
                                    </div>
                                    <div className="space-y-3 pt-2 border-t border-slate-100">
                                      <label className="text-xs font-bold text-slate-700">🎨 ゲージの色設定</label>
                                      <div>
                                        <label className="text-xs font-medium text-slate-500 mb-1 block">デフォルト色（背景）</label>
                                        <input
                                          type="color"
                                          value={dc.colorDefault || '#e2e8f0'}
                                          onChange={e => updateSelectedDesign('dataConfig', { ...dc, colorDefault: e.target.value })}
                                          className="w-full h-8 rounded border p-0.5 bg-white cursor-pointer"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs font-medium text-slate-500 mb-1 block">実績色（標準）</label>
                                        <input
                                          type="color"
                                          value={dc.colorCurrent || '#10b981'}
                                          onChange={e => updateSelectedDesign('dataConfig', { ...dc, colorCurrent: e.target.value })}
                                          className="w-full h-8 rounded border p-0.5 bg-white cursor-pointer"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs font-medium text-slate-500 mb-1 block">目標未達時の色</label>
                                        <input
                                          type="color"
                                          value={dc.colorUnderTarget || '#ef4444'}
                                          onChange={e => updateSelectedDesign('dataConfig', { ...dc, colorUnderTarget: e.target.value })}
                                          className="w-full h-8 rounded border p-0.5 bg-white cursor-pointer"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs font-medium text-slate-500 mb-1 block">目標超過時の色</label>
                                        <input
                                          type="color"
                                          value={dc.colorOverTarget || '#8b5cf6'}
                                          onChange={e => updateSelectedDesign('dataConfig', { ...dc, colorOverTarget: e.target.value })}
                                          className="w-full h-8 rounded border p-0.5 bg-white cursor-pointer"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs font-medium text-slate-500 mb-1 block">目標値マーカーの色</label>
                                        <input
                                          type="color"
                                          value={dc.colorTargetMarker || '#cbd5e1'}
                                          onChange={e => updateSelectedDesign('dataConfig', { ...dc, colorTargetMarker: e.target.value })}
                                          className="w-full h-8 rounded border p-0.5 bg-white cursor-pointer"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs font-medium text-slate-500 mb-1 block">差分（今日の実績）の色</label>
                                        <div className="flex gap-2">
                                          <div className="flex-1">
                                            <span className="text-[10px] text-slate-400 block mb-0.5">増加時</span>
                                            <input
                                              type="color"
                                              value={dc.colorDelta || '#06b6d4'}
                                              onChange={e => updateSelectedDesign('dataConfig', { ...dc, colorDelta: e.target.value })}
                                              className="w-full h-8 rounded border p-0.5 bg-white cursor-pointer"
                                            />
                                          </div>
                                          <div className="flex-1">
                                            <span className="text-[10px] text-slate-400 block mb-0.5">減少時</span>
                                            <input
                                              type="color"
                                              value={dc.colorDeltaMinus || '#ef4444'}
                                              onChange={e => updateSelectedDesign('dataConfig', { ...dc, colorDeltaMinus: e.target.value })}
                                              className="w-full h-8 rounded border p-0.5 bg-white cursor-pointer"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    <div>
                                      <label className="text-xs font-medium text-slate-500 mb-1 block">実績値集計方法</label>
                                      <select
                                        value={dc.aggregation ?? 'sum'}
                                        onChange={e => updateSelectedDesign('dataConfig', { ...dc, aggregation: e.target.value as any })}
                                        className="w-full text-sm border border-slate-200 px-2 py-1.5 rounded-lg bg-white"
                                      >
                                        <option value="sum">合計</option>
                                        <option value="avg">平均</option>
                                        <option value="max">最大</option>
                                        <option value="min">最小</option>
                                        <option value="count">件数</option>
                                      </select>
                                    </div>
                                    <div className="space-y-3 pt-4 border-t border-slate-100">
                                      <label className="text-xs font-bold text-slate-700">📏 下部テキストサイズ</label>
                                      <div>
                                        <div className="flex justify-between items-center mb-1">
                                          <label className="text-xs font-medium text-slate-700">ラベルサイズ</label>
                                          <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{activeEditorWidget.dataConfig?.statsLabelFontSize || 10}px</span>
                                        </div>
                                        <input type="range" min="8" max="24" value={activeEditorWidget.dataConfig?.statsLabelFontSize || 10} onChange={e => updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, statsLabelFontSize: parseInt(e.target.value) })} className="w-full accent-indigo-500" />
                                      </div>
                                      <div>
                                        <div className="flex justify-between items-center mb-1">
                                          <label className="text-xs font-medium text-slate-700">数値サイズ</label>
                                          <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{activeEditorWidget.dataConfig?.statsValueFontSize ?? Math.max(14, (activeEditorWidget.fontSize || 48) * 0.25)}px</span>
                                        </div>
                                        <input type="range" min="10" max="36" value={activeEditorWidget.dataConfig?.statsValueFontSize ?? Math.max(14, (activeEditorWidget.fontSize || 48) * 0.25)} onChange={e => updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, statsValueFontSize: parseInt(e.target.value) })} className="w-full accent-indigo-500" />
                                      </div>
                                      <p className="text-[9px] text-slate-400">※ 未設定の場合はメイン数値サイズに連動します</p>
                                    </div>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </details>

                      <details open className="bg-white rounded-xl border border-slate-200 shadow-sm">
                        <summary className="text-xs font-bold text-slate-500 uppercase tracking-widest p-3 cursor-pointer flex items-center justify-between">
                          <span className="flex items-center gap-2"><Icons.Settings className="w-4 h-4"/> デザイン・スタイル</span>
                        </summary>
                        <div className="p-3 space-y-4">
                          <div>
                            <label className="text-xs font-medium text-slate-500 mb-1 block">形状</label>
                            <select value={activeEditorWidget.shape} onChange={e=>updateSelectedDesign('shape',e.target.value)} className="w-full text-sm border border-slate-200 px-2 py-1.5 rounded-lg bg-slate-50 text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none shadow-sm cursor-pointer">
                              <option value="rectangle">四角形</option>
                              <option value="rounded">角丸四角</option>
                              <option value="pill">カプセル</option>
                              <option value="circle">真円</option>
                              <option value="text-only">テキストのみ</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-500 mb-1 block">文字横位置</label>
                            <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                              <button onClick={()=>updateSelectedDesign('textAlign','left')} className={`flex-1 py-1 text-xs font-medium rounded-md transition-all ${activeEditorWidget.textAlign==='left'?'bg-white text-indigo-600 shadow-sm':'text-slate-500'}`}>左</button>
                              <button onClick={()=>updateSelectedDesign('textAlign','center')} className={`flex-1 py-1 text-xs font-medium rounded-md transition-all ${activeEditorWidget.textAlign==='center'?'bg-white text-indigo-600 shadow-sm':'text-slate-500'}`}>中央</button>
                              <button onClick={()=>updateSelectedDesign('textAlign','right')} className={`flex-1 py-1 text-xs font-medium rounded-md transition-all ${activeEditorWidget.textAlign==='right'?'bg-white text-indigo-600 shadow-sm':'text-slate-500'}`}>右</button>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-500 mb-1 block">カラー</label>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="flex flex-col gap-1"><span className="text-[10px] text-slate-400">背景</span><input type="color" value={activeEditorWidget.bgColor} onChange={e=>updateSelectedDesign('bgColor',e.target.value)} className="w-full h-8 rounded border p-0.5 bg-white cursor-pointer"/></div>
                              <div className="flex flex-col gap-1"><span className="text-[10px] text-slate-400">文字</span><input type="color" value={activeEditorWidget.textColor} onChange={e=>updateSelectedDesign('textColor',e.target.value)} className="w-full h-8 rounded border p-0.5 bg-white cursor-pointer"/></div>
                              <div className="flex flex-col gap-1"><span className="text-[10px] text-slate-400">枠線</span><input type="color" value={activeEditorWidget.borderColor} onChange={e=>updateSelectedDesign('borderColor',e.target.value)} className="w-full h-8 rounded border p-0.5 bg-white cursor-pointer"/></div>
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <label className="text-xs font-medium text-slate-700">背景透明度</label>
                              <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">{Math.round((activeEditorWidget.bgAlpha ?? 1) * 100)}%</span>
                            </div>
                            <input type="range" min="0" max="1" step="0.01" value={activeEditorWidget.bgAlpha ?? 1} onChange={e=>updateSelectedDesign('bgAlpha',parseFloat(e.target.value))} className="w-full accent-indigo-500"/>
                          </div>
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <label className="text-xs font-medium text-slate-700">枠線の太さ</label>
                              <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">{activeEditorWidget.borderWidth}px</span>
                            </div>
                            <input type="range" min="0" max="20" value={activeEditorWidget.borderWidth} onChange={e=>updateSelectedDesign('borderWidth',parseInt(e.target.value))} className="w-full accent-indigo-500"/>
                          </div>
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <label className="text-xs font-medium text-slate-700">文字サイズ</label>
                              <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">{activeEditorWidget.fontSize}px</span>
                            </div>
                            <input type="range" min="8" max="120" value={activeEditorWidget.fontSize} onChange={e=>updateSelectedDesign('fontSize',parseInt(e.target.value))} className="w-full accent-indigo-500"/>
                          </div>

                          {activeEditorWidget.type === 'outline' && (
                            <div>
                              <label className="text-xs font-medium text-slate-500 mb-1 block">線の種類</label>
                              <select
                                value={activeEditorWidget.outlineConfig?.borderStyle || 'solid'}
                                onChange={(e) => {
                                  const current = activeEditorWidget.outlineConfig || {};
                                  updateSelectedDesign('outlineConfig', { ...current, borderStyle: e.target.value });
                                }}
                                className="w-full text-sm border border-slate-200 px-2 py-1.5 rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                              >
                                <option value="solid">実線</option>
                                <option value="dashed">破線</option>
                                <option value="dotted">点線</option>
                              </select>
                            </div>
                          )}

                          {activeEditorWidget.type === 'table-details' && (
                            <div className="space-y-3 pt-4 border-t border-slate-100">
                              <label className="text-xs font-bold text-slate-700">🎨 ヘッダーカラー</label>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] font-medium text-slate-500 mb-1 block">背景色</label>
                                  <input
                                    type="color"
                                    value={activeEditorWidget.tableConfig?.headerBgColor || '#f8fafc'}
                                    onChange={e => {
                                      const current = activeEditorWidget.tableConfig || {};
                                      updateSelectedDesign('_multi', {
                                        tableConfig: { ...current, headerBgColor: e.target.value }
                                      });
                                    }}
                                    className="w-full h-8 rounded border p-0.5 bg-white cursor-pointer"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-medium text-slate-500 mb-1 block">文字色</label>
                                  <input
                                    type="color"
                                    value={activeEditorWidget.tableConfig?.headerTextColor || '#64748b'}
                                    onChange={e => {
                                      const current = activeEditorWidget.tableConfig || {};
                                      updateSelectedDesign('_multi', {
                                        tableConfig: { ...current, headerTextColor: e.target.value }
                                      });
                                    }}
                                    className="w-full h-8 rounded border p-0.5 bg-white cursor-pointer"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {activeEditorWidget.type === 'table-details' && (
                            <div className="space-y-3 pt-4 border-t border-slate-100">
                              <label className="text-xs font-bold text-slate-700">📐 ヘッダーテキストサイズ</label>
                              <div className="flex items-center gap-3">
                                <input
                                  type="range"
                                  min="8"
                                  max="24"
                                  step="1"
                                  value={activeEditorWidget.tableConfig?.headerFontSize || 11}
                                  onChange={e => {
                                    const current = activeEditorWidget.tableConfig || {};
                                    updateSelectedDesign('_multi', {
                                      tableConfig: { ...current, headerFontSize: Number(e.target.value) }
                                    });
                                  }}
                                  className="flex-1 accent-indigo-500"
                                />
                                <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg min-w-[48px] text-center">
                                  {activeEditorWidget.tableConfig?.headerFontSize || 11}px
                                </span>
                              </div>
                            </div>
                          )}

                          {activeEditorWidget.type === 'table-details' && (
                            <div className="space-y-3 pt-4 border-t border-slate-100">
                              <label className="text-xs font-bold text-slate-700">📏 罫線設定</label>

                              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-slate-500">横線（行の区切り）</span>
                                </div>
                                <div className="flex gap-2">
                                  <div className="flex-1">
                                    <span className="text-[10px] text-slate-400 block mb-0.5">カラー</span>
                                    <input
                                      type="color"
                                      value={activeEditorWidget.tableConfig?.horizontalBorderColor || activeEditorWidget.tableConfig?.borderColor || '#e2e8f0'}
                                      onChange={e => {
                                        const current = activeEditorWidget.tableConfig || {};
                                        updateSelectedDesign('_multi', { tableConfig: { ...current, horizontalBorderColor: e.target.value } });
                                      }}
                                      className="w-full h-8 rounded border p-0.5 bg-white cursor-pointer"
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <span className="text-[10px] text-slate-400 block mb-0.5">太さ (px)</span>
                                    <input
                                      type="number"
                                      min="0"
                                      max="10"
                                      value={activeEditorWidget.tableConfig?.horizontalBorderWidth ?? activeEditorWidget.tableConfig?.borderWidth ?? 1}
                                      onChange={e => {
                                        const current = activeEditorWidget.tableConfig || {};
                                        updateSelectedDesign('_multi', { tableConfig: { ...current, horizontalBorderWidth: Number(e.target.value) } });
                                      }}
                                      className="w-full h-8 text-xs border border-slate-200 rounded px-2 outline-none bg-white"
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-slate-500">縦線（列の区切り）</span>
                                </div>
                                <div className="flex gap-2">
                                  <div className="flex-1">
                                    <span className="text-[10px] text-slate-400 block mb-0.5">カラー</span>
                                    <input
                                      type="color"
                                      value={activeEditorWidget.tableConfig?.verticalBorderColor || activeEditorWidget.tableConfig?.borderColor || '#e2e8f0'}
                                      onChange={e => {
                                        const current = activeEditorWidget.tableConfig || {};
                                        updateSelectedDesign('_multi', { tableConfig: { ...current, verticalBorderColor: e.target.value } });
                                      }}
                                      className="w-full h-8 rounded border p-0.5 bg-white cursor-pointer"
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <span className="text-[10px] text-slate-400 block mb-0.5">太さ (px)</span>
                                    <input
                                      type="number"
                                      min="0"
                                      max="10"
                                      value={activeEditorWidget.tableConfig?.verticalBorderWidth ?? activeEditorWidget.tableConfig?.borderWidth ?? 1}
                                      onChange={e => {
                                        const current = activeEditorWidget.tableConfig || {};
                                        updateSelectedDesign('_multi', { tableConfig: { ...current, verticalBorderWidth: Number(e.target.value) } });
                                      }}
                                      className="w-full h-8 text-xs border border-slate-200 rounded px-2 outline-none bg-white"
                                    />
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={() => {
                                  const current = activeEditorWidget.tableConfig || {};
                                  updateSelectedDesign('_multi', {
                                    tableConfig: {
                                      ...current,
                                      horizontalBorderColor: undefined,
                                      horizontalBorderWidth: undefined,
                                      verticalBorderColor: undefined,
                                      verticalBorderWidth: undefined,
                                      borderColor: undefined,
                                      borderWidth: undefined,
                                    }
                                  });
                                }}
                                className="text-xs text-slate-400 hover:text-rose-500 transition-colors underline"
                              >
                                罫線設定をリセット
                              </button>
                            </div>
                          )}

                          {activeEditorWidget.type === 'table-details' && (
                            <div className="space-y-3 pt-4 border-t border-slate-100">
                              <label className="text-xs font-bold text-slate-700">👁️ 表示制御</label>
                              <div className="flex gap-6">
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={activeEditorWidget.tableConfig?.showHeader !== false}
                                    onChange={e => {
                                      const current = activeEditorWidget.tableConfig || {};
                                      updateSelectedDesign('_multi', {
                                        tableConfig: { ...current, showHeader: e.target.checked }
                                      });
                                    }}
                                    className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                  />
                                  <span className="text-xs font-medium text-slate-700">ヘッダーを表示</span>
                                </label>
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={activeEditorWidget.tableConfig?.showFooter !== false}
                                    onChange={e => {
                                      const current = activeEditorWidget.tableConfig || {};
                                      updateSelectedDesign('_multi', {
                                        tableConfig: { ...current, showFooter: e.target.checked }
                                      });
                                    }}
                                    className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                  />
                                  <span className="text-xs font-medium text-slate-700">フッターを表示</span>
                                </label>
                              </div>
                            </div>
                          )}

                          {activeEditorWidget.type === 'scorecard' || activeEditorWidget.type.startsWith('kpi-') ? (
                            <>
                              <div>
                                <label className="text-xs font-medium text-slate-500 mb-1 block">メイン数値 横位置 (X軸)</label>
                                <input type="range" min="-200" max="200" value={activeEditorWidget.dataConfig?.valueX || 0} onChange={e=>updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, valueX: parseInt(e.target.value) })} className="w-full accent-indigo-500"/>
                              </div>
                              <div>
                                <label className="text-xs font-medium text-slate-500 mb-1 block">メイン数値 縦位置 (Y軸)</label>
                                <input type="range" min="-200" max="200" value={activeEditorWidget.dataConfig?.valueY || 0} onChange={e=>updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, valueY: parseInt(e.target.value) })} className="w-full accent-indigo-500"/>
                              </div>
                            </>
                          ) : null}

                          <div className="pt-2 flex flex-col gap-3">
                            <label className="flex items-center space-x-3 cursor-pointer group">
                              <input type="checkbox" checked={activeEditorWidget.hasShadow} onChange={e=>updateSelectedDesign('hasShadow',e.target.checked)} className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 transition-all cursor-pointer"/>
                              <span className="text-xs font-medium text-slate-700 group-hover:text-slate-900">ドロップシャドウ</span>
                            </label>
                          </div>

                          {activeEditorWidget.type === 'chart' && (
                            <div className="pt-4 border-t border-slate-100 space-y-3">
                              <label className="text-xs font-bold text-slate-700">🎨 チャートデザイン</label>
                              <div>
                                <label className="text-xs font-medium text-slate-500 mb-1 block">カラースキーム</label>
                                <select
                                  value={activeEditorWidget.dataConfig?.colorScheme || 'default'}
                                  onChange={e => updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, colorScheme: e.target.value })}
                                  className="w-full text-sm border border-slate-200 px-2 py-1.5 rounded-lg bg-slate-50 text-slate-900 outline-none"
                                >
                                  <option value="default">デフォルト (カラフル)</option>
                                  <option value="brand">ブランド (ピンク系)</option>
                                  <option value="warm">ウォーム (赤・オレンジ系)</option>
                                  <option value="cool">クール (青・紫系)</option>
                                </select>
                              </div>
                              <label className="flex items-center space-x-3 cursor-pointer group">
                                <input type="checkbox" checked={activeEditorWidget.dataConfig?.showDataLabels || false} onChange={e=>updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, showDataLabels: e.target.checked })} className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 transition-all cursor-pointer"/>
                                <span className="text-xs font-medium text-slate-700 group-hover:text-slate-900">データラベルを表示（棒グラフのみ）</span>
                              </label>
                            </div>
                          )}

                          <div className="pt-4 border-t border-slate-100 space-y-3">
                            <label className="text-xs font-bold text-slate-700">📌 タイトル詳細設定</label>
                            <label className="flex items-center space-x-3 cursor-pointer group">
                              <input type="checkbox" checked={activeEditorWidget.showTitle !== false} onChange={e=>updateSelectedDesign('showTitle',e.target.checked)} className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 transition-all cursor-pointer"/>
                              <span className="text-xs font-medium text-slate-700 group-hover:text-slate-900">タイトルを表示</span>
                            </label>
                            {activeEditorWidget.showTitle !== false && (
                              <>
                                <div>
                                  <div className="flex justify-between items-center mb-1">
                                    <label className="text-xs font-medium text-slate-700">タイトルテキスト</label>
                                  </div>
                                  <textarea
                                    value={activeEditorWidget.title}
                                    onChange={e => updateSelectedDesign('title', e.target.value)}
                                    className="w-full text-sm border border-slate-200 px-2 py-1.5 rounded-lg bg-white outline-none resize-y min-h-[60px]"
                                    placeholder="Shift + Enter で改行"
                                  />
                                </div>
                                <div>
                                  <div className="flex justify-between items-center mb-1">
                                    <label className="text-xs font-medium text-slate-700">フォントサイズ</label>
                                    <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{activeEditorWidget.dataConfig?.titleFontSize || 12}px</span>
                                  </div>
                                  <input type="range" min="8" max="72" value={activeEditorWidget.dataConfig?.titleFontSize || 12} onChange={e=>updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, titleFontSize: parseInt(e.target.value) })} className="w-full accent-indigo-500"/>
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-slate-500 mb-1 block">文字色</label>
                                  <input type="color" value={activeEditorWidget.dataConfig?.titleColor || activeEditorWidget.textColor || '#64748b'} onChange={e=>updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, titleColor: e.target.value })} className="w-full h-8 rounded border p-0.5 bg-white cursor-pointer"/>
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-slate-500 mb-1 block">横位置 (X軸調整)</label>
                                  <input type="range" min="-200" max="200" value={activeEditorWidget.dataConfig?.titleX || 0} onChange={e=>updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, titleX: parseInt(e.target.value) })} className="w-full accent-indigo-500"/>
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-slate-500 mb-1 block">縦位置 (Y軸調整)</label>
                                  <input type="range" min="-200" max="200" value={activeEditorWidget.dataConfig?.titleY || 0} onChange={e=>updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, titleY: parseInt(e.target.value) })} className="w-full accent-indigo-500"/>
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-slate-500 mb-1 block">配置</label>
                                  <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                                    <button onClick={()=>updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, titleAlign: 'left' })} className={`flex-1 py-1 text-xs font-medium rounded-md transition-all ${activeEditorWidget.dataConfig?.titleAlign === 'left' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>左</button>
                                    <button onClick={()=>updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, titleAlign: 'center' })} className={`flex-1 py-1 text-xs font-medium rounded-md transition-all ${(!activeEditorWidget.dataConfig?.titleAlign || activeEditorWidget.dataConfig?.titleAlign === 'center') ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>中央</button>
                                    <button onClick={()=>updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, titleAlign: 'right' })} className={`flex-1 py-1 text-xs font-medium rounded-md transition-all ${activeEditorWidget.dataConfig?.titleAlign === 'right' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>右</button>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>

                          {activeEditorWidget.type === 'scorecard' && (
                            <>
                              <div className="pt-4 border-t border-slate-100 space-y-3">
                                <label className="text-xs font-bold text-slate-700">📅 今日の実績表示</label>
                                <label className="flex items-center space-x-3 cursor-pointer group">
                                  <input
                                    type="checkbox"
                                    checked={activeEditorWidget.dataConfig?.showTodayValue || false}
                                    onChange={e=>updateSelectedDesign('dataConfig',{ ...activeEditorWidget.dataConfig, showTodayValue: e.target.checked})}
                                    className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 transition-all cursor-pointer"
                                  />
                                  <span className="text-xs font-medium text-slate-700 group-hover:text-slate-900">今日の実績（増加分）を表示</span>
                                </label>
                                {activeEditorWidget.dataConfig?.showTodayValue && (
                                  <>
                                    <div>
                                      <label className="text-xs font-medium text-slate-500 mb-1 block">照合フィールド（デフォルト: ページID）</label>
                                      <SelectWithSearch
                                        options={['id', ...availableFieldsBySource[activeEditorWidget.dataConfig?.sourceIndex || '001'] || []]}
                                        value={activeEditorWidget.dataConfig?.todayDiffMatchField || 'id'}
                                        onChange={v => {
                                          updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, todayDiffMatchField: v === 'id' ? undefined : v });
                                        }}
                                        placeholder="ページID"
                                      />
                                    </div>
                                    <div className="flex gap-2">
                                      <div className="flex-1"><label className="text-[10px] font-medium text-slate-500 mb-1 block">増加時の色</label><input type="color" value={activeEditorWidget.dataConfig?.colorDelta || '#06b6d4'} onChange={e=>updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, colorDelta: e.target.value })} className="w-full h-8 rounded border p-0.5 bg-white cursor-pointer"/></div>
                                      <div className="flex-1"><label className="text-[10px] font-medium text-slate-500 mb-1 block">減少時の色</label><input type="color" value={activeEditorWidget.dataConfig?.colorDeltaMinus || '#ef4444'} onChange={e=>updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, colorDeltaMinus: e.target.value })} className="w-full h-8 rounded border p-0.5 bg-white cursor-pointer"/></div>
                                    </div>
                                    <div>
                                      <div className="flex justify-between items-center mb-1"><label className="text-xs font-medium text-slate-700">文字サイズ</label><span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{activeEditorWidget.dataConfig?.todayFontSize || Math.max(16, activeEditorWidget.fontSize * 0.25)}px</span></div>
                                      <input type="range" min="8" max="72" value={activeEditorWidget.dataConfig?.todayFontSize || Math.max(16, activeEditorWidget.fontSize * 0.25)} onChange={e=>updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, todayFontSize: parseInt(e.target.value) })} className="w-full accent-indigo-500"/>
                                    </div>
                                    <div><label className="text-xs font-medium text-slate-500 mb-1 block">横位置 (X軸調整)</label><input type="range" min="-200" max="200" value={activeEditorWidget.dataConfig?.todayX || 0} onChange={e=>updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, todayX: parseInt(e.target.value) })} className="w-full accent-indigo-500"/></div>
                                    <div><label className="text-xs font-medium text-slate-500 mb-1 block">縦位置 (Y軸調整)</label><input type="range" min="-200" max="200" value={activeEditorWidget.dataConfig?.todayY || 0} onChange={e=>updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, todayY: parseInt(e.target.value) })} className="w-full accent-indigo-500"/></div>
                                  </>
                                )}
                                {activeEditorWidget.dataConfig?.showTodayValue && (
                                  <div className="space-y-3 pt-3 border-t border-slate-100">
                                    <label className="text-xs font-bold text-slate-700">📐 増加/減少 位置調整</label>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div><label className="text-[10px] text-slate-500">増加 X</label><input type="range" min="-200" max="200" value={activeEditorWidget.dataConfig?.addedX || 0} onChange={e => updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, addedX: parseInt(e.target.value) })} className="w-full accent-indigo-500"/></div>
                                      <div><label className="text-[10px] text-slate-500">増加 Y</label><input type="range" min="-200" max="200" value={activeEditorWidget.dataConfig?.addedY || 0} onChange={e => updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, addedY: parseInt(e.target.value) })} className="w-full accent-indigo-500"/></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div><label className="text-[10px] text-slate-500">減少 X</label><input type="range" min="-200" max="200" value={activeEditorWidget.dataConfig?.removedX || 0} onChange={e => updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, removedX: parseInt(e.target.value) })} className="w-full accent-indigo-500"/></div>
                                      <div><label className="text-[10px] text-slate-500">減少 Y</label><input type="range" min="-200" max="200" value={activeEditorWidget.dataConfig?.removedY || 0} onChange={e => updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, removedY: parseInt(e.target.value) })} className="w-full accent-indigo-500"/></div>
                                    </div>
                                  </div>
                                )}
                                {activeEditorWidget.dataConfig?.showTodayValue && (
                                  <div className="space-y-2 pt-3 border-t border-slate-100">
                                    <label className="text-xs font-bold text-slate-700">📋 ポップアップ表示フィールド（最大10件）</label>
                                    <p className="text-[10px] text-slate-400">ホバー時に表示するフィールドを選択してください</p>
                                    {[0,1,2,3,4,5,6,7,8,9].map(idx => {
                                      const currentFields = activeEditorWidget.dataConfig?.todayPopupFields || [];
                                      const srcIdx = activeEditorWidget.dataConfig?.sourceIndex || '001';
                                      return (
                                        <div key={idx} className="flex items-center gap-2">
                                          <span className="text-[10px] text-slate-400 w-4">{idx+1}</span>
                                          <div className="flex-1">
                                            <SelectWithSearch
                                              options={availableFieldsBySource[srcIdx] || []}
                                              value={currentFields[idx] || ''}
                                              onChange={v => {
                                                const updated = [...currentFields];
                                                if (v) { updated[idx] = v; } else { updated.splice(idx, 1); }
                                                const filtered = updated.filter(Boolean).slice(0, 10);
                                                updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, todayPopupFields: filtered.length > 0 ? filtered : undefined });
                                              }}
                                              placeholder="未設定"
                                            />
                                          </div>
                                          {(activeEditorWidget.dataConfig?.todayPopupFields || [])[idx] && (
                                            <button onClick={() => { const updated = [...(activeEditorWidget.dataConfig?.todayPopupFields || [])]; updated.splice(idx, 1); updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, todayPopupFields: updated.length > 0 ? updated : undefined }); }} className="text-slate-400 hover:text-rose-500 p-1"><Icons.X className="w-3 h-3"/></button>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                                                              {/* ★ ドリルダウン表示フィールド（独立） */}
                                {activeEditorWidget.type === 'scorecard' && (
                                  <div className="space-y-2 pt-3 border-t border-slate-100">
                                    <label className="text-xs font-bold text-slate-700">🔍 ドリルダウン表示フィールド（最大10件）</label>
                                    <p className="text-[10px] text-slate-400">メイン数値クリック時に表示するフィールド（未設定の場合は全フィールド）</p>
                                    {[0,1,2,3,4,5,6,7,8,9].map(idx => {
                                      const currentFields = activeEditorWidget.dataConfig?.drilldownFields || [];
                                      const srcIdx = activeEditorWidget.dataConfig?.sourceIndex || '001';
                                      const allFields = availableFieldsBySource[srcIdx] || [];
                                      return (
                                        <div key={idx} className="flex items-center gap-2">
                                          <span className="text-[10px] text-slate-400 w-4">{idx+1}</span>
                                          <div className="flex-1">
                                            <SelectWithSearch
                                              options={allFields}
                                              value={currentFields[idx] || ''}
                                              onChange={v => {
                                                const updated = [...currentFields];
                                                if (v) { updated[idx] = v; } else { updated.splice(idx, 1); }
                                                const filtered = updated.filter(Boolean).slice(0, 10);
                                                updateSelectedDesign('dataConfig', { 
                                                  ...activeEditorWidget.dataConfig, 
                                                  drilldownFields: filtered.length > 0 ? filtered : undefined 
                                                });
                                              }}
                                              placeholder="未設定"
                                            />
                                          </div>
                                          {(activeEditorWidget.dataConfig?.drilldownFields || [])[idx] && (
                                            <button 
                                              onClick={() => { 
                                                const updated = [...(activeEditorWidget.dataConfig?.drilldownFields || [])]; 
                                                updated.splice(idx, 1); 
                                                updateSelectedDesign('dataConfig', { 
                                                  ...activeEditorWidget.dataConfig, 
                                                  drilldownFields: updated.length > 0 ? updated : undefined 
                                                }); 
                                              }} 
                                              className="text-slate-400 hover:text-rose-500 p-1"
                                            >
                                              <Icons.X className="w-3 h-3"/>
                                            </button>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                              <div className="space-y-3 pt-4 border-t border-slate-100">
                                <label className="text-xs font-bold text-slate-700">🎨 条件付き文字色</label>
                                {(activeEditorWidget.dataConfig?.conditionalTextRules || []).map((rule, idx) => (
                                  <div key={idx} className="flex gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                                    <select value={rule.operator} onChange={e => { const newRules = [...(activeEditorWidget.dataConfig?.conditionalTextRules || [])]; newRules[idx] = { ...newRules[idx], operator: e.target.value as any }; updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, conditionalTextRules: newRules }); }} className="text-xs border border-slate-200 rounded px-1 py-1 bg-white outline-none">
                                      <option value="gt">＞</option><option value="lt">＜</option><option value="gte">≧</option><option value="lte">≦</option><option value="eq">＝</option>
                                    </select>
                                    <input type="number" value={rule.value} onChange={e => { const newRules = [...(activeEditorWidget.dataConfig?.conditionalTextRules || [])]; newRules[idx] = { ...newRules[idx], value: Number(e.target.value) }; updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, conditionalTextRules: newRules }); }} className="w-20 text-xs border border-slate-200 rounded px-2 py-1 bg-white outline-none" placeholder="値"/>
                                    <input type="color" value={rule.textColor} onChange={e => { const newRules = [...(activeEditorWidget.dataConfig?.conditionalTextRules || [])]; newRules[idx] = { ...newRules[idx], textColor: e.target.value }; updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, conditionalTextRules: newRules }); }} className="w-10 h-7 rounded border p-0.5 bg-white cursor-pointer"/>
                                    <button onClick={() => { const newRules = (activeEditorWidget.dataConfig?.conditionalTextRules || []).filter((_, i) => i !== idx); updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, conditionalTextRules: newRules }); }} className="text-slate-400 hover:text-rose-500 p-1"><Icons.X className="w-3 h-3"/></button>
                                  </div>
                                ))}
                                {(!activeEditorWidget.dataConfig?.conditionalTextRules || activeEditorWidget.dataConfig.conditionalTextRules.length < 10) && (
                                  <button onClick={() => { const newRules = [...(activeEditorWidget.dataConfig?.conditionalTextRules || []), { operator: 'gt' as const, value: 0, textColor: '#ef4444' }]; updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, conditionalTextRules: newRules }); }} className="w-full text-xs py-2 border-2 border-dashed border-slate-200 bg-slate-50 rounded-lg text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-all flex items-center justify-center gap-1"><Icons.Plus className="w-3 h-3"/> 条件を追加（最大10）</button>
                                )}
                              </div>

                              <div className="space-y-3 pt-4 border-t border-slate-100">
                                <label className="text-xs font-bold text-slate-700">🎨 条件付き背景色</label>
                                {(activeEditorWidget.dataConfig?.conditionalBgRules || []).map((rule, idx) => (
                                  <div key={idx} className="flex gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                                    <select value={rule.operator} onChange={e => { const newRules = [...(activeEditorWidget.dataConfig?.conditionalBgRules || [])]; newRules[idx] = { ...newRules[idx], operator: e.target.value as any }; updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, conditionalBgRules: newRules }); }} className="text-xs border border-slate-200 rounded px-1 py-1 bg-white outline-none">
                                      <option value="gt">＞</option><option value="lt">＜</option><option value="gte">≧</option><option value="lte">≦</option><option value="eq">＝</option>
                                    </select>
                                    <input type="number" value={rule.value} onChange={e => { const newRules = [...(activeEditorWidget.dataConfig?.conditionalBgRules || [])]; newRules[idx] = { ...newRules[idx], value: Number(e.target.value) }; updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, conditionalBgRules: newRules }); }} className="w-20 text-xs border border-slate-200 rounded px-2 py-1 bg-white outline-none" placeholder="値"/>
                                    <input type="color" value={rule.bgColor} onChange={e => { const newRules = [...(activeEditorWidget.dataConfig?.conditionalBgRules || [])]; newRules[idx] = { ...newRules[idx], bgColor: e.target.value }; updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, conditionalBgRules: newRules }); }} className="w-10 h-7 rounded border p-0.5 bg-white cursor-pointer"/>
                                    <button onClick={() => { const newRules = (activeEditorWidget.dataConfig?.conditionalBgRules || []).filter((_, i) => i !== idx); updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, conditionalBgRules: newRules }); }} className="text-slate-400 hover:text-rose-500 p-1"><Icons.X className="w-3 h-3"/></button>
                                  </div>
                                ))}
                                {(!activeEditorWidget.dataConfig?.conditionalBgRules || activeEditorWidget.dataConfig.conditionalBgRules.length < 10) && (
                                  <button onClick={() => { const newRules = [...(activeEditorWidget.dataConfig?.conditionalBgRules || []), { operator: 'gt' as const, value: 0, bgColor: '#fef2f2' }]; updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, conditionalBgRules: newRules }); }} className="w-full text-xs py-2 border-2 border-dashed border-slate-200 bg-slate-50 rounded-lg text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-all flex items-center justify-center gap-1"><Icons.Plus className="w-3 h-3"/> 背景色条件を追加（最大10）</button>
                                )}
                              </div>

                              <div className="space-y-3 pt-4 border-t border-slate-100">
                                <label className="text-xs font-bold text-slate-700">📈 トレンドアイコン</label>
                                <div className="flex items-center gap-3">
                                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input type="checkbox" checked={activeEditorWidget.dataConfig?.showTrendIcon === true} onChange={e => updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, showTrendIcon: e.target.checked })} className="w-4 h-4 rounded text-indigo-600"/>
                                    <span className="text-xs text-slate-600">アイコンを表示</span>
                                  </label>
                                </div>
                                {activeEditorWidget.dataConfig?.showTrendIcon && (
                                  <div className="flex gap-3">
                                    <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" checked={activeEditorWidget.dataConfig?.trendTarget === 'previous'} onChange={() => updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, trendTarget: 'previous' })} className="w-4 h-4 text-indigo-600"/><span className="text-xs text-slate-600">前期比</span></label>
                                    <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" checked={activeEditorWidget.dataConfig?.trendTarget === 'target'} onChange={() => updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, trendTarget: 'target' })} className="w-4 h-4 text-indigo-600"/><span className="text-xs text-slate-600">目標比</span></label>
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </details>

                      {activeEditorWidget.type === 'slideshow' && (
                        <details open className="bg-white rounded-xl border border-slate-200 shadow-sm">
                          <summary className="text-xs font-bold text-slate-500 uppercase tracking-widest p-3 cursor-pointer flex items-center justify-between">
                            <span className="flex items-center gap-2"><Icons.Play className="w-4 h-4"/> スライドショー設定</span>
                          </summary>
                          <div className="p-3 space-y-4">
                            <div>
                              <label className="text-xs font-medium text-slate-500 mb-1 block">自動再生</label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={activeEditorWidget.dataConfig?.slideshowAuto ?? true} onChange={e => updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, slideshowAuto: e.target.checked })} className="w-4 h-4 rounded text-indigo-600"/>
                                <span className="text-xs text-slate-600">自動で切り替える</span>
                              </label>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-slate-500 mb-1 block">切り替え間隔 (ミリ秒)</label>
                              <input type="number" min={1000} max={60000} step={1000} value={activeEditorWidget.dataConfig?.slideshowInterval ?? 5000} onChange={e => updateSelectedDesign('dataConfig', { ...activeEditorWidget.dataConfig, slideshowInterval: Number(e.target.value) })} className="w-full text-sm border border-slate-200 px-2 py-1.5 rounded-lg bg-white outline-none"/>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-slate-500 mb-1 block">子ウィジェット一覧</label>
                              <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                {(activeEditorWidget.children || []).map((child: Widget) => (
                                  <div key={child.id} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <span className="text-xs font-medium text-slate-600 flex-1 truncate">{child.title || child.type}</span>
                                    <button onClick={() => { const newChildren = (activeEditorWidget.children || []).filter(c => c.id !== child.id); editWidgets(layout.map(w => w.id === activeEditorWidget.id ? { ...w, children: newChildren } : w)); }} className="text-slate-400 hover:text-rose-500 p-1"><Icons.X className="w-3 h-3"/></button>
                                  </div>
                                ))}
                              </div>
                              <button onClick={() => { const newChild: Widget = { id: `child_${Date.now()}`, type: 'scorecard', title: '新規スコアカード', x: 0, y: 0, w: 400, h: 300, shape: 'rounded', bgColor: '#ffffff', textColor: '#0f172a', borderColor: '#e2e8f0', borderWidth: 1, fontSize: 48, textAlign: 'center', fontFamily: 'sans', hasShadow: true, hidden: false, locked: false, showTitle: true, bgAlpha: 1, dataConfig: defaultDataConfig('scorecard'), }; const newChildren = [...(activeEditorWidget.children || []), newChild]; editWidgets(layout.map(w => w.id === activeEditorWidget.id ? { ...w, children: newChildren } : w)); }} className="mt-2 w-full text-xs py-2 border-2 border-dashed border-slate-200 bg-slate-50 rounded-lg text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-all flex items-center justify-center gap-1"><Icons.Plus className="w-3 h-3"/> 子ウィジェットを追加</button>
                            </div>
                          </div>
                        </details>
                      )}
                    </>
                  ) : (
                    <div className="text-center text-slate-400 text-sm py-32 font-medium flex flex-col items-center gap-3">
                      <Icons.Monitor className="w-10 h-10 text-slate-200" />
                      <p>アイテムが選択されていません</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      <button onClick={() => setShowAiDrawer(prev => !prev)} className={`fixed bottom-8 right-8 z-[200] p-4 bg-indigo-600 text-white rounded-full shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center ${mode === 'edit' ? 'hidden' : ''}`} title="AIアシスタント">
        <Icons.Sparkles className="w-6 h-6" />
      </button>

      {showAiDrawer && (
        <div className="fixed inset-0 z-[250] flex justify-end">
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => setShowAiDrawer(false)} />
          <div className="relative w-full max-w-md h-full bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-sm font-bold flex items-center gap-2"><Icons.Sparkles className="w-4 h-4"/> AI アシスタント</h3>
              <button onClick={() => setShowAiDrawer(false)} className="text-slate-400 hover:text-slate-600"><Icons.X className="w-5 h-5"/></button>
            </div>
            <div className="flex-1 overflow-hidden">
              <AiChatTab onSend={handleAiSend} onWidgetGenerated={handleWidgetGenerated} onSummaryRequest={handleGenerateSummary} />
            </div>
          </div>
        </div>
      )}

      {mode === 'edit' && ctxMenu && (
  <div
    className="fixed bg-white/95 backdrop-blur-xl border border-slate-200 shadow-2xl rounded-2xl py-2 z-[300] min-w-[200px]"
    style={{ left: ctxMenu.x, top: ctxMenu.y }}
    onPointerDown={(e) => e.stopPropagation()}
  >
    {[
      {
        label: '✏️ タイトル名を変更',
        action: () => {
          const w = findWidgetById(layout, ctxMenu.id);
          if (w) {
            setTitleEditWidgetId(ctxMenu.id);
            setTitleEditValue(w.title);
          }
        },
      },
      null,
      {
        label: '📝 スタイルをコピー',
        action: () => {
          const w = findWidgetById(layout, ctxMenu.id);
          if (w) {
            // ★ スタイルのみコピー（dataConfig のデータ取得設定は除外）
            const styleData = {
              shape: w.shape,
              w: w.w,
              h: w.h,
              bgColor: w.bgColor,
              textColor: w.textColor,
              borderColor: w.borderColor,
              borderWidth: w.borderWidth,
              fontSize: w.fontSize,
              textAlign: w.textAlign,
              hasShadow: w.hasShadow,
              bgAlpha: w.bgAlpha,
              // テーブル設定（見た目のみ）
              tableConfig: w.tableConfig
                ? {
                    headerBgColor: w.tableConfig.headerBgColor,
                    headerTextColor: w.tableConfig.headerTextColor,
                    headerFontSize: w.tableConfig.headerFontSize,
                    borderColor: w.tableConfig.borderColor,
                    borderWidth: w.tableConfig.borderWidth,
                    verticalBorderColor: w.tableConfig.verticalBorderColor,
                    verticalBorderWidth: w.tableConfig.verticalBorderWidth,
                    horizontalBorderColor: w.tableConfig.horizontalBorderColor,
                    horizontalBorderWidth: w.tableConfig.horizontalBorderWidth,
                    showHeader: w.tableConfig.showHeader,
                    showFooter: w.tableConfig.showFooter,
                    rowHeight: w.tableConfig.rowHeight,
                    groupHeaderBgColor: w.tableConfig.groupHeaderBgColor,
                    groupHeaderTextColor: w.tableConfig.groupHeaderTextColor,
                    groupHeaderHeight: w.tableConfig.groupHeaderHeight,
                    groupHeaderFontSize: w.tableConfig.groupHeaderFontSize,
                    groupHeaderBadgeBgColor: w.tableConfig.groupHeaderBadgeBgColor,
                    groupHeaderBadgeTextColor: w.tableConfig.groupHeaderBadgeTextColor,
                    groupHeaderBadgeFontSize: w.tableConfig.groupHeaderBadgeFontSize,
                    groupHeaderBadgeLabelColor: w.tableConfig.groupHeaderBadgeLabelColor,
                    groupHeaderBadgeValueColor: w.tableConfig.groupHeaderBadgeValueColor,
                    groupHeaderConditionalStyles: w.tableConfig.groupHeaderConditionalStyles
                      ? w.tableConfig.groupHeaderConditionalStyles.map((rule) => ({ ...rule }))
                      : undefined,
                  }
                : undefined,
              // スコアカードの表示関連のみ
              showTodayValue: w.dataConfig?.showTodayValue,
              colorDelta: w.dataConfig?.colorDelta,
              colorDeltaMinus: w.dataConfig?.colorDeltaMinus,
              todayFontSize: w.dataConfig?.todayFontSize,
              todayX: w.dataConfig?.todayX,
              todayY: w.dataConfig?.todayY,
              addedX: w.dataConfig?.addedX,
              addedY: w.dataConfig?.addedY,
              removedX: w.dataConfig?.removedX,
              removedY: w.dataConfig?.removedY,
              todayPopupFields: w.dataConfig?.todayPopupFields,
              drilldownFields: w.dataConfig?.drilldownFields,
            };
            setStyleClipboard(styleData);
            addToastRef.current('スタイルをコピーしました（データソースは除く）', 'success');
          }
        },
      },
      {
        label: '📋 スタイルを貼り付け',
        action: () => {
          if (styleClipboard) {
            const {
              shape,
              w: width,
              h: height,
              bgColor,
              textColor,
              borderColor,
              borderWidth,
              fontSize,
              textAlign,
              hasShadow,
              bgAlpha,
              tableConfig,
              showTodayValue,
              colorDelta,
              colorDeltaMinus,
              todayFontSize,
              todayX,
              todayY,
              addedX,
              addedY,
              removedX,
              removedY,
              todayPopupFields,
              drilldownFields,
            } = styleClipboard;

            editWidgets(
              updateWidgetById(layout, ctxMenu.id, (w) => {
                // ★ スタイルのみ適用（dataConfig のデータ取得設定は保持）
                const updated: any = {
                  ...w,
                  shape: shape || w.shape,
                  w: width || w.w,
                  h: height || w.h,
                  bgColor: bgColor || w.bgColor,
                  textColor: textColor || w.textColor,
                  borderColor: borderColor || w.borderColor,
                  borderWidth: borderWidth !== undefined ? borderWidth : w.borderWidth,
                  fontSize: fontSize || w.fontSize,
                  textAlign: textAlign || w.textAlign,
                  hasShadow: hasShadow !== undefined ? hasShadow : w.hasShadow,
                  bgAlpha: bgAlpha !== undefined ? bgAlpha : w.bgAlpha,
                };

                if (tableConfig) {
                  updated.tableConfig = {
                    ...w.tableConfig,
                    headerBgColor:
                      tableConfig.headerBgColor !== undefined
                        ? tableConfig.headerBgColor
                        : w.tableConfig?.headerBgColor,
                    headerTextColor:
                      tableConfig.headerTextColor !== undefined
                        ? tableConfig.headerTextColor
                        : w.tableConfig?.headerTextColor,
                    headerFontSize:
                      tableConfig.headerFontSize !== undefined
                        ? tableConfig.headerFontSize
                        : w.tableConfig?.headerFontSize,
                    borderColor:
                      tableConfig.borderColor !== undefined
                        ? tableConfig.borderColor
                        : w.tableConfig?.borderColor,
                    borderWidth:
                      tableConfig.borderWidth !== undefined
                        ? tableConfig.borderWidth
                        : w.tableConfig?.borderWidth,
                    verticalBorderColor:
                      tableConfig.verticalBorderColor !== undefined
                        ? tableConfig.verticalBorderColor
                        : w.tableConfig?.verticalBorderColor,
                    verticalBorderWidth:
                      tableConfig.verticalBorderWidth !== undefined
                        ? tableConfig.verticalBorderWidth
                        : w.tableConfig?.verticalBorderWidth,
                    horizontalBorderColor:
                      tableConfig.horizontalBorderColor !== undefined
                        ? tableConfig.horizontalBorderColor
                        : w.tableConfig?.horizontalBorderColor,
                    horizontalBorderWidth:
                      tableConfig.horizontalBorderWidth !== undefined
                        ? tableConfig.horizontalBorderWidth
                        : w.tableConfig?.horizontalBorderWidth,
                    showHeader:
                      tableConfig.showHeader !== undefined
                        ? tableConfig.showHeader
                        : w.tableConfig?.showHeader,
                    showFooter:
                      tableConfig.showFooter !== undefined
                        ? tableConfig.showFooter
                        : w.tableConfig?.showFooter,
                    rowHeight:
                      tableConfig.rowHeight !== undefined
                        ? tableConfig.rowHeight
                        : w.tableConfig?.rowHeight,
                    groupHeaderBgColor:
                      tableConfig.groupHeaderBgColor !== undefined
                        ? tableConfig.groupHeaderBgColor
                        : w.tableConfig?.groupHeaderBgColor,
                    groupHeaderTextColor:
                      tableConfig.groupHeaderTextColor !== undefined
                        ? tableConfig.groupHeaderTextColor
                        : w.tableConfig?.groupHeaderTextColor,
                    groupHeaderHeight:
                      tableConfig.groupHeaderHeight !== undefined
                        ? tableConfig.groupHeaderHeight
                        : w.tableConfig?.groupHeaderHeight,
                    groupHeaderFontSize:
                      tableConfig.groupHeaderFontSize !== undefined
                        ? tableConfig.groupHeaderFontSize
                        : w.tableConfig?.groupHeaderFontSize,
                    groupHeaderBadgeBgColor:
                      tableConfig.groupHeaderBadgeBgColor !== undefined
                        ? tableConfig.groupHeaderBadgeBgColor
                        : w.tableConfig?.groupHeaderBadgeBgColor,
                    groupHeaderBadgeTextColor:
                      tableConfig.groupHeaderBadgeTextColor !== undefined
                        ? tableConfig.groupHeaderBadgeTextColor
                        : w.tableConfig?.groupHeaderBadgeTextColor,
                    groupHeaderBadgeFontSize:
                      tableConfig.groupHeaderBadgeFontSize !== undefined
                        ? tableConfig.groupHeaderBadgeFontSize
                        : w.tableConfig?.groupHeaderBadgeFontSize,
                    groupHeaderBadgeLabelColor:
                      tableConfig.groupHeaderBadgeLabelColor !== undefined
                        ? tableConfig.groupHeaderBadgeLabelColor
                        : w.tableConfig?.groupHeaderBadgeLabelColor,
                    groupHeaderBadgeValueColor:
                      tableConfig.groupHeaderBadgeValueColor !== undefined
                        ? tableConfig.groupHeaderBadgeValueColor
                        : w.tableConfig?.groupHeaderBadgeValueColor,
                    groupHeaderConditionalStyles:
                      tableConfig.groupHeaderConditionalStyles !== undefined
                        ? tableConfig.groupHeaderConditionalStyles
                        : w.tableConfig?.groupHeaderConditionalStyles,
                  };
                }

                // dataConfig はスタイル関連のみ更新（データ取得設定は変更しない）
                if (w.dataConfig) {
                  const ndc = { ...w.dataConfig };
                  if (showTodayValue !== undefined) ndc.showTodayValue = showTodayValue;
                  if (colorDelta !== undefined) ndc.colorDelta = colorDelta;
                  if (colorDeltaMinus !== undefined) ndc.colorDeltaMinus = colorDeltaMinus;
                  if (todayFontSize !== undefined) ndc.todayFontSize = todayFontSize;
                  if (todayX !== undefined) ndc.todayX = todayX;
                  if (todayY !== undefined) ndc.todayY = todayY;
                  if (addedX !== undefined) ndc.addedX = addedX;
                  if (addedY !== undefined) ndc.addedY = addedY;
                  if (removedX !== undefined) ndc.removedX = removedX;
                  if (removedY !== undefined) ndc.removedY = removedY;
                  if (todayPopupFields !== undefined) ndc.todayPopupFields = todayPopupFields;
                  if (drilldownFields !== undefined) ndc.drilldownFields = drilldownFields;
                  updated.dataConfig = ndc;
                }

                return updated;
              })
            );
            addToastRef.current('スタイルを貼り付けました（データソースは変更なし）', 'success');
          } else {
            addToastRef.current('コピーされたスタイルがありません', 'error');
          }
        },
        disabled: !styleClipboard,
      },
      null,
      {
        label: '複製',
        action: () => handleDuplicateWidget(ctxMenu.id),
      },
      {
        label: findWidgetById(layout, ctxMenu.id)?.locked ? 'ロック解除' : 'ロックをかける',
        action: () => handleToggleLockWidget(ctxMenu.id),
      },
      null,
      {
        label: '最前面へ移動',
        action: () => {
          const i = layout.findIndex((w) => w.id === ctxMenu.id);
          if (i < layout.length - 1) {
            const n = [...layout];
            n.push(n.splice(i, 1)[0]);
            editWidgets(n);
          }
        },
      },
      {
        label: '最背面へ移動',
        action: () => {
          const i = layout.findIndex((w) => w.id === ctxMenu.id);
          if (i > 0) {
            const n = [...layout];
            n.unshift(n.splice(i, 1)[0]);
            editWidgets(n);
          }
        },
      },
      {
        label: '一つ前面へ',
        action: () => {
          const i = layout.findIndex((w) => w.id === ctxMenu.id);
          if (i < layout.length - 1) editWidgets(arrayMove(layout, i, i + 1));
        },
      },
      {
        label: '一つ背面へ',
        action: () => {
          const i = layout.findIndex((w) => w.id === ctxMenu.id);
          if (i > 0) editWidgets(arrayMove(layout, i, i - 1));
        },
      },
      null,
      {
        label: '選択項目をスライドショーに変換',
        action: () => {
          handleConvertToSlideshow();
        },
        disabled: !(mode === 'edit' && selectedIds.length >= 2),
      },
      null,
      {
        label: 'コメントを追加',
        action: () => {
          setSelectedIds([ctxMenu.id]);
          setRightTab('properties');
        },
      },
      null,
      {
        label: '削除',
        action: () => {
          editWidgets(removeWidgetById(layout, ctxMenu.id));
          setSelectedIds([]);
          addToastRef.current('ウィジェットを削除しました（Ctrl+Zで元に戻す）', 'info');
        },
        className: 'text-rose-600 hover:bg-rose-50',
      },
    ].map((item, idx) => {
      if (item === null) {
        return <div key={`sep-${idx}`} className="border-t border-slate-100 my-2" />;
      }
      return (
        <button
          key={item.label}
          onClick={() => {
            if (!item.disabled) {
              item.action();
              setCtxMenu(null);
            }
          }}
          disabled={item.disabled}
          className={`w-full text-left px-5 py-2.5 text-sm font-medium hover:bg-slate-50 text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${item.className || ''}`}
        >
          {item.label}
        </button>
      );
    })}
  </div>
)}

      {confirmState && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[400]" onPointerDown={() => setConfirmState(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4" onPointerDown={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-800 mb-4">確認</h3>
            <p className="text-sm text-slate-600 mb-6 whitespace-pre-wrap">{confirmState.message}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmState(null)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-all">キャンセル</button>
              <button onClick={() => confirmState.onConfirm()} className="px-4 py-2 text-sm font-medium text-white bg-rose-500 rounded-lg hover:bg-rose-600 transition-all">削除</button>
            </div>
          </div>
        </div>
      )}

      {titleEditWidgetId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[400]" onPointerDown={() => setTitleEditWidgetId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4" onPointerDown={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-slate-800 mb-3">タイトルを変更</h3>
            <textarea autoFocus className="w-full border border-slate-200 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 resize-y min-h-[80px]" value={titleEditValue} onChange={e => setTitleEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRenameWidget(titleEditWidgetId, titleEditValue); setTitleEditWidgetId(null); } }}/>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setTitleEditWidgetId(null)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-all">キャンセル</button>
              <button onClick={() => { handleRenameWidget(titleEditWidgetId, titleEditValue); setTitleEditWidgetId(null); }} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-all">変更</button>
            </div>
          </div>
        </div>
      )}

      {showShortcuts&&<div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[300]" onPointerDown={()=>setShowShortcuts(false)}><div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4" onPointerDown={e=>e.stopPropagation()}><h2 className="text-xl font-bold mb-6 text-slate-800 flex items-center gap-2"><Icons.Monitor className="w-5 h-5"/> ショートカット</h2><div className="space-y-4">{[
        { key: 'Ctrl + Z', desc: '元に戻す' }, { key: 'Ctrl + Y', desc: 'やり直し' }, { key: 'Ctrl + C / V', desc: 'コピー / 貼り付け' }, { key: 'Ctrl + G', desc: 'グループ化' }, { key: 'Ctrl + Shift + G', desc: 'グループ解除' }, { key: 'Delete / BS', desc: '選択アイテムを削除' }, { key: 'Space + ドラッグ', desc: 'キャンバスをパン移動' }, { key: 'Ctrl + ホイール', desc: 'キャンバスをズーム' }, { key: 'Shift + クリック', desc: '複数選択' }, { key: '矢印キー', desc: '選択アイテムを移動（Shiftで微調整）' },
      ].map(s=><div key={s.key} className="flex justify-between items-center text-sm"><span className="font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-md font-mono">{s.key}</span><span className="text-slate-500 font-medium">{s.desc}</span></div>)}</div><button onClick={()=>setShowShortcuts(false)} className="mt-8 w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all shadow-sm">閉じる</button></div></div>}
      {showTemplateGallery&&<TemplateGallery onSelect={handleTemplateSelect} onClose={()=>setShowTemplateGallery(false)}/>}
      <AiSummaryModal open={showAiSummary} onClose={()=>setShowAiSummary(false)} summary={aiSummary} />
      {drilldown && <DrilldownModal open={!!drilldown} onClose={()=>setDrilldown(null)} title={drilldown.widgetTitle} data={drilldown.data ?? activeFilteredData} filterField={drilldown.field} filterValue={drilldown.value} columns={drilldown.columns} images={drilldown.images} />}
    </div>
  );
}

export default function Dashboard() {
  return (
    <FilterProvider>
      <ToastProvider>
        <DashboardInner />
      </ToastProvider>
    </FilterProvider>
  );
}