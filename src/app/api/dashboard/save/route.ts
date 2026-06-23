// app/api/dashboard/save/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma, withConnection } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = (session.user as any).role || 'viewer';
  if (role !== 'admin' && role !== 'editor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { dashboards, canvasBgColor } = await request.json();

  try {
    await withConnection(() =>
      prisma.dashboard.upsert({
        where: { id: 'global' },
        update: {
          layout: { pages: dashboards, canvasBgColor },
          updatedAt: new Date(),
        },
        create: {
          id: 'global',
          layout: { pages: dashboards, canvasBgColor },
          name: '共有ダッシュボード',
        },
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('ダッシュボード保存エラー:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}