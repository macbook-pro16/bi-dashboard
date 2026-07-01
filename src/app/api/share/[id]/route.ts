// src/app/api/share/[id]/route.ts
import { NextResponse } from 'next/server';

// ★ 共有機能は無効化。過去に発行された共有URLも含めて一切閲覧不可にする。
export async function GET() {
  return NextResponse.json(
    { error: 'この機能は無効化されています。' },
    { status: 410 }
  );
}