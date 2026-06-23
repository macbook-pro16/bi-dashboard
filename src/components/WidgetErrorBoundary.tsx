'use client';
import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';

function WidgetFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2 bg-red-50 border border-red-200 rounded-lg text-center">
      <span className="text-xl">⚠️</span>
      <span className="text-xs font-bold text-red-600">表示エラー</span>
      <span className="text-[10px] text-red-400 truncate max-w-full">{error.message}</span>
      <button onClick={resetErrorBoundary} className="text-[10px] text-indigo-600 underline">再試行</button>
    </div>
  );
}

export default function WidgetErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary FallbackComponent={WidgetFallback} onReset={() => {}}>
      {children}
    </ErrorBoundary>
  );
}