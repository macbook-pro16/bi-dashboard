// src/app/api/share/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { Widget, Annotation } from '@/types';

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { layout, annotations } = body;

    if (!layout || !Array.isArray(layout)) {
      return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
    }

    // ユーザーの現在のダッシュボードIDを取得（存在する場合）
    const dashboard = await prisma.dashboard.findUnique({
      where: { userId: session.user.email },
      select: { id: true },
    });

    // スナップショットを作成
    const snapshot = await prisma.sharedSnapshot.create({
      data: {
        dashboardId: dashboard?.id || 'unknown',
        layout: layout as Widget[],
        annotations: annotations || [],
        expiresAt: null, // 無期限
      },
    });

    return NextResponse.json({
      success: true,
      sharedId: snapshot.id,
    });
  } catch (error) {
    console.error('Share POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}