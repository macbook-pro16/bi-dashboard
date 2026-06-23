'use client';
// [UX-6] 独立したテキストウィジェット (メモ化)
import React from 'react';

interface TextWidgetProps {
  title: string;
  fontSize: number;
}

const TextWidget = React.memo(function TextWidget({ title, fontSize }: TextWidgetProps) {
  return (
    <div className="flex items-center justify-center h-full" style={{ fontSize: `${fontSize}px`, fontWeight: 'bold' }}>
      {title}
    </div>
  );
});

export default TextWidget;