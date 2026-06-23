'use client';
// src/contexts/ThemeContext.tsx

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

interface ThemeColors {
  bg: string;
  surface: string;
  surfaceHover: string;
  text: string;
  textSecondary: string;
  border: string;
  accent: string;
  accentHover: string;
  canvas: string;
  grid: string;
}

interface ThemeContextValue {
  mode: 'light' | 'dark' | 'brand';
  setMode: (mode: 'light' | 'dark' | 'brand') => void;
  colors: ThemeColors;
}

const THEME_COLORS: Record<'light' | 'dark' | 'brand', ThemeColors> = {
  light: {
    bg: '#ffffff',
    surface: '#f8fafc',
    surfaceHover: '#f1f5f9',
    text: '#0f172a',
    textSecondary: '#64748b',
    border: '#e2e8f0',
    accent: '#6366f1',
    accentHover: '#4f46e5',
    canvas: '#f1f5f9',
    grid: '#cbd5e1',
  },
  dark: {
    bg: '#0f172a',
    surface: '#1e293b',
    surfaceHover: '#334155',
    text: '#f1f5f9',
    textSecondary: '#94a3b8',
    border: '#334155',
    accent: '#818cf8',
    accentHover: '#6366f1',
    canvas: '#1e293b',
    grid: '#334155',
  },
  brand: {
    bg: '#fff5f7',
    surface: '#fff0f3',
    surfaceHover: '#ffe4eb',
    text: '#500724',
    textSecondary: '#9f1239',
    border: '#fecdd3',
    accent: '#e16b8c',
    accentHover: '#be185d',
    canvas: '#fff5f7',
    grid: '#fecdd3',
  },
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'light',
  setMode: () => {},
  colors: THEME_COLORS.light,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<'light' | 'dark' | 'brand'>(() => {
    if (typeof window === 'undefined') return 'light';
    return (localStorage.getItem('bi-theme') as any) || 'light';
  });

  const handleSetMode = useCallback((m: 'light' | 'dark' | 'brand') => {
    setMode(m);
    localStorage.setItem('bi-theme', m);
  }, []);

  useEffect(() => {
    const c = THEME_COLORS[mode];
    const root = document.documentElement;
    root.style.setProperty('--color-bg', c.bg);
    root.style.setProperty('--color-surface', c.surface);
    root.style.setProperty('--color-surface-hover', c.surfaceHover);
    root.style.setProperty('--color-text', c.text);
    root.style.setProperty('--color-text-secondary', c.textSecondary);
    root.style.setProperty('--color-border', c.border);
    root.style.setProperty('--color-accent', c.accent);
    root.style.setProperty('--color-accent-hover', c.accentHover);
    root.style.setProperty('--color-canvas', c.canvas);
    root.style.setProperty('--color-grid', c.grid);
  }, [mode]);

  const value = useMemo(() => ({ mode, setMode: handleSetMode, colors: THEME_COLORS[mode] }), [mode, handleSetMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}