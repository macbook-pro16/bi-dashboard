// src/hooks/useAnnotationHistory.ts
'use client';
import { useState, useCallback } from 'react';

export function useAnnotationHistory<T>(initial: T[] = []) {
  const [present, setPresent] = useState<T[]>(initial);
  const [past, setPast] = useState<T[][]>([]);
  const [future, setFuture] = useState<T[][]>([]);

  const commit = useCallback((newValue: T[]) => {
    setPast(prev => [...prev.slice(-20), present]);
    setPresent(newValue);
    setFuture([]);
  }, [present]);

  const update = useCallback((newValue: T[]) => {
    setPresent(newValue);
  }, []);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    setFuture(f => [present, ...f]);
    setPresent(prev);
    setPast(p => p.slice(0, -1));
  }, [past, present]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setPast(p => [...p, present]);
    setPresent(next);
    setFuture(f => f.slice(1));
  }, [future, present]);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  return { present, commit, update, undo, redo, canUndo, canRedo };
}