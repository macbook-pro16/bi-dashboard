// src/components/TextBlockWidget.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';

interface TextBlockWidgetProps {
  textContent: string;
  fontSize: number;
  textColor: string;
  textAlign: 'left' | 'center' | 'right';
  bgColor?: string;
  bgAlpha?: number;
  onTextChange?: (newText: string) => void;
  isEditMode: boolean;
}

const TextBlockWidget: React.FC<TextBlockWidgetProps> = ({
  textContent,
  fontSize,
  textColor,
  textAlign,
  bgColor = 'transparent',
  bgAlpha = 0,
  onTextChange,
  isEditMode,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localText, setLocalText] = useState(textContent || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLocalText(textContent || '');
  }, [textContent]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // カーソルを最後に移動
      textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    if (localText !== textContent && onTextChange) {
      onTextChange(localText);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setLocalText(textContent || '');
      setIsEditing(false);
    }
    // Dnd-kit等へのイベント伝播を防止
    e.stopPropagation();
  };

  const bgRgba = bgColor.startsWith('#')
    ? `rgba(${parseInt(bgColor.slice(1, 3), 16)}, ${parseInt(bgColor.slice(3, 5), 16)}, ${parseInt(bgColor.slice(5, 7), 16)}, ${bgAlpha})`
    : bgColor;

  if (isEditMode && isEditing) {
    return (
      <textarea
        ref={textareaRef}
        value={localText}
        onChange={(e) => setLocalText(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onPointerDown={(e) => e.stopPropagation()} // ドラッグ誤爆を防止
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          height: '100%',
          fontSize: `${fontSize}px`,
          color: textColor,
          textAlign,
          backgroundColor: bgRgba,
          outline: '2px solid #6366f1',
          outlineOffset: '-2px',
          borderRadius: 'inherit',
          padding: '16px',
          resize: 'none',
          fontFamily: '"Futura", "Trebuchet MS", sans-serif',
          lineHeight: '1.5',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
        }}
        placeholder="テキストを入力..."
      />
    );
  }

  return (
    <div
      className={`w-full h-full overflow-hidden ${isEditMode ? 'cursor-text hover:ring-2 hover:ring-indigo-400/50 hover:ring-inset transition-shadow' : ''}`}
      style={{
        fontSize: `${fontSize}px`,
        color: textColor,
        textAlign,
        backgroundColor: bgRgba,
        fontFamily: '"Futura", "Trebuchet MS", sans-serif',
        lineHeight: '1.5',
        padding: '16px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        borderRadius: 'inherit',
      }}
      onDoubleClick={(e) => {
        if (isEditMode) {
          e.stopPropagation();
          setIsEditing(true);
        }
      }}
      onPointerDown={(e) => {
        // 編集モード時にテキスト選択できるように、親のドラッグ処理への伝播を止める
        if (isEditMode) e.stopPropagation();
      }}
    >
      {textContent || (isEditMode ? <span className="opacity-30">ダブルクリックで編集</span> : '')}
    </div>
  );
};

export default TextBlockWidget;