import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function POST(request: NextRequest) {
  // ★ 権限チェック
  const session = await getServerSession(authOptions);
  const role = session?.user?.role || 'viewer';
  if (role !== 'admin' && role !== 'editor') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const apiKey = process.env.NOTION_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'NOTION_API_KEY が設定されていません' }, { status: 500 });
    }

    const body = await request.json();
    const { pageId, status, properties } = body;

    if (!pageId) {
      return NextResponse.json({ success: false, error: 'pageId は必須です' }, { status: 400 });
    }

    // まずページを取得してプロパティ構造を確認
    const pageRes = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Notion-Version': '2022-06-28',
      },
    });

    if (!pageRes.ok) {
      const err = await pageRes.json();
      return NextResponse.json({ success: false, error: err.message }, { status: pageRes.status });
    }

    const pageData = await pageRes.json();
    const props = pageData.properties || {};

    // ステータス系のプロパティを自動検出
    const statusCandidates = ['ステータス', '状況', '状態', 'Status', 'status'];
    let statusPropName: string | null = null;
    let statusPropType: string | null = null;

    for (const key of statusCandidates) {
      if (props[key]) {
        statusPropName = key;
        statusPropType = props[key].type;
        break;
      }
    }

    if (!statusPropName || !statusPropType) {
      return NextResponse.json({ success: false, error: 'ステータスプロパティが見つかりません' }, { status: 400 });
    }

    // type に応じたペイロードを構築
    let updateProps: any = {};
    if (status !== undefined) {
      if (statusPropType === 'select') {
        updateProps[statusPropName] = { select: { name: status } };
      } else if (statusPropType === 'status') {
        updateProps[statusPropName] = { status: { name: status } };
      } else if (statusPropType === 'rich_text') {
        updateProps[statusPropName] = { rich_text: [{ text: { content: status } }] };
      }
    }

    // 追加のプロパティ更新（任意）
    if (properties) {
      Object.assign(updateProps, properties);
    }

    const updateRes = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ properties: updateProps }),
    });

    if (!updateRes.ok) {
      const err = await updateRes.json();
      console.error('Notion Update Error:', err);
      return NextResponse.json({ success: false, error: err.message }, { status: updateRes.status });
    }

    return NextResponse.json({ success: true, message: 'ステータスを更新しました' });
  } catch (error: any) {
    console.error('notion-update error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}