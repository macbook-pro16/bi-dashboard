// src/app/api/share/route.ts
import { NextResponse } from 'next/server';

// ★ 共有機能は無効化。エンドポイントは410 Goneを返すのみとし、DB書き込みは一切行わない。
export async function POST() {
  return NextResponse.json(
    { error: 'この機能は無効化されています。' },
    { status: 410 }
  );
}