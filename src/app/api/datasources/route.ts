// src/app/api/datasources/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

// GET: ユーザーのデータソース一覧を取得
export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sources = await prisma.dataSource.findMany({
      where: { userId: session.user.email },
      orderBy: { index: 'asc' },
    });

    // データがない場合はデフォルトを返す（初回登録用）
    if (sources.length === 0) {
      const defaults = [
        { index: '001', name: '車両一覧' },
        { index: '001_prev', name: '車両一覧(昨日)' },
        { index: '002', name: '受付表' },
        { index: '003', name: 'タスク' },
        { index: '004', name: '部品発注一覧' },
        { index: '005', name: '顧客DB' },
        { index: '006', name: '目標数値' },
      ];
      // デフォルトをDBに登録
      await prisma.dataSource.createMany({
        data: defaults.map(d => ({
          userId: session.user.email!,
          index: d.index,
          name: d.name,
        })),
        skipDuplicates: true,
      });
      // 再取得
      const created = await prisma.dataSource.findMany({
        where: { userId: session.user.email },
        orderBy: { index: 'asc' },
      });
      return NextResponse.json(created);
    }

    return NextResponse.json(sources);
  } catch (error) {
    console.error('DataSources GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: データソースを追加
export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { index, name } = body;

    if (!index || !name) {
      return NextResponse.json({ error: 'Index and name are required' }, { status: 400 });
    }

    const existing = await prisma.dataSource.findUnique({
      where: { userId_index: { userId: session.user.email, index } },
    });

    if (existing) {
      return NextResponse.json({ error: 'Index already exists' }, { status: 409 });
    }

    const created = await prisma.dataSource.create({
      data: {
        userId: session.user.email,
        index,
        name,
      },
    });

    return NextResponse.json(created);
  } catch (error) {
    console.error('DataSources POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT: データソースを更新（名前変更など）
export async function PUT(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, index, name } = body;

    if (!id || !index || !name) {
      return NextResponse.json({ error: 'id, index, and name are required' }, { status: 400 });
    }

    const updated = await prisma.dataSource.update({
      where: { id, userId: session.user.email },
      data: { index, name },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('DataSources PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: データソースを削除
export async function DELETE(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    await prisma.dataSource.delete({
      where: { id, userId: session.user.email },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DataSources DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}