// src/utils/annotationUtils.ts
import React from 'react';
import { Annotation } from '../types';

/**
 * 直交パス（直角カーブ）を生成する
 */
export function getOrthogonalPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);

  if (ady < 20 || adx < 20) return `M ${x1} ${y1} L ${x2} ${y2}`;

  if (ady > adx * 1.5) {
    const midY = (y1 + y2) / 2;
    return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
  } else {
    const midX = (x1 + x2) / 2;
    return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
  }
}

/**
 * アノテーションの経路（ルートタイプに応じたパス）を生成する
 */
export function getRoutePath(ann: Annotation): string {
  const { x1, y1, x2, y2, routeType } = ann;
  const dx = x2 - x1;
  const dy = y2 - y1;

  if (routeType === 'direct') {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }
  if (routeType === 'orthogonal' || routeType === 'bezier') {
    return getOrthogonalPath(x1, y1, x2, y2);
  }
  if (routeType === 'stairHV') {
    return `M ${x1} ${y1} L ${x2} ${y1} L ${x2} ${y2}`;
  }
  if (routeType === 'stairVH') {
    return `M ${x1} ${y1} L ${x1} ${y2} L ${x2} ${y2}`;
  }
  if (routeType === 'stairHVH') {
    const midX = (x1 + x2) / 2;
    return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
  }
  if (routeType === 'stairVHV') {
    const midY = (y1 + y2) / 2;
    return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
  }
  return getOrthogonalPath(x1, y1, x2, y2);
}

/**
 * マーカー定義（SVG defs）を生成する
 */
export function getMarkerDefs(annotations: Annotation[]): React.ReactNode {
  return (
    <>
      {annotations.map((ann) => {
        const sizes = { small: 6, medium: 9, large: 14 };
        const size = sizes[ann.arrowSize] || 9;
        const shapePoints: Record<string, string> = {
          triangle: `0 0, ${size} ${size / 2}, 0 ${size}`,
          sharp: `0 0, ${size} ${size / 2}, 0 ${size}`,
          blunt: `0 0, ${size * 0.8} ${size / 2}, 0 ${size}`,
        };
        const points = shapePoints[ann.arrowShape] || shapePoints.triangle;
        const refXMap: Record<string, number> = {
          triangle: size,
          sharp: size * 0.8,
          blunt: size * 0.6,
        };
        const refX = refXMap[ann.arrowShape] || size;

        return (
          <React.Fragment key={ann.id}>
            {ann.arrowEnd && (
              <marker
                id={`arrowhead-${ann.id}`}
                markerWidth={size}
                markerHeight={size}
                refX={refX}
                refY={size / 2}
                orient="auto"
              >
                <polygon points={points} fill={ann.color} />
              </marker>
            )}
            {ann.arrowStart && (
              <marker
                id={`arrowhead-reverse-${ann.id}`}
                markerWidth={size}
                markerHeight={size}
                refX={size - refX}
                refY={size / 2}
                orient="auto"
              >
                <polygon points={points} fill={ann.color} />
              </marker>
            )}
          </React.Fragment>
        );
      })}
      <marker
        id="arrowhead-draft"
        markerWidth="9"
        markerHeight="7"
        refX="8"
        refY="3.5"
        orient="auto"
      >
        <polygon points="0 0, 9 3.5, 0 7" fill="#6366f1" />
      </marker>
    </>
  );
}