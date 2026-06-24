// src/app/api/notion-file/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const pageId = searchParams.get('pageId');
  const fieldName = searchParams.get('field');

  if (!pageId || !fieldName) {
    return NextResponse.json({ error: 'pageId and field are required' }, { status: 400 });
  }

  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'NOTION_API_KEY not set' }, { status: 500 });
  }

  try {
    const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Notion-Version': '2022-06-28',
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Notion API error' }, { status: res.status });
    }

    const data = await res.json();
    const prop = data.properties?.[fieldName];
    if (!prop || prop.type !== 'files') {
      return NextResponse.json({ files: [] });
    }

    const files = prop.files?.map((f: any) => ({
      name: f.name || '',
      url: f.type === 'external' ? f.external?.url : f.file?.url,
      type: f.type,
    })).filter((f: any) => f.url) || [];

    return NextResponse.json({ files });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}