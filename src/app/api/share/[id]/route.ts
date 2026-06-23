// src/app/api/share/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
  }

  try {
    const snapshot = await prisma.sharedSnapshot.findUnique({
      where: { id },
    });

    if (!snapshot) {
      return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });
    }

    // 有効期限チェック（任意）
    if (snapshot.expiresAt && snapshot.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Snapshot expired' }, { status: 410 });
    }

    return NextResponse.json({
      layout: snapshot.layout,
      annotations: snapshot.annotations,
    });
  } catch (error) {
    console.error('Share GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}