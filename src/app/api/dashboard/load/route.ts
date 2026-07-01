// src/app/api/dashboard/load/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma, withConnection } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ★ 追加：ロールを確認し、編集権限がなければ非公開ページを配信しない
  const role = (session.user as any).role || 'viewer';
  const canEdit = role === 'admin' || role === 'editor';

  try {
    const dashboard = await withConnection(() =>
      prisma.dashboard.findUnique({ where: { id: 'global' } })
    );

    // ★ 型アサーションで layout プロパティを明示
    const dashboardData = dashboard as { layout: any } | null;

    if (!dashboardData) {
      return NextResponse.json({ dashboards: [] });
    }

    const layoutData = dashboardData.layout;
    const allPages = layoutData?.pages || [];
    const canvasBgColor = layoutData?.canvasBgColor || '#ffffff';

    // ★ 追加：編集権限がないユーザーには published !== false のページのみ返す
    //         非公開ページのレイアウト・ウィジェット設定はサーバーから一切送信しない
    const pages = canEdit
      ? allPages
      : allPages.filter((p: any) => p.published !== false);

    return NextResponse.json({ dashboards: pages, canvasBgColor });
  } catch (error) {
    console.error('ダッシュボード読み込みエラー:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}