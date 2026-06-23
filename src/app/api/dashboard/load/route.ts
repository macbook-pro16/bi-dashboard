// app/api/dashboard/load/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma, withConnection } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const dashboard = await withConnection(() =>
      prisma.dashboard.findUnique({ where: { id: 'global' } })
    );

    if (!dashboard) {
      return NextResponse.json({ dashboards: [] });
    }

    const layoutData = dashboard.layout as any;
    const pages = layoutData?.pages || [];
    const canvasBgColor = layoutData?.canvasBgColor || '#ffffff';

    return NextResponse.json({ dashboards: pages, canvasBgColor });
  } catch (error) {
    console.error('ダッシュボード読み込みエラー:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}