import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const postType = searchParams.get('type') || 'inventory'; // ★ stocks → inventory に変更
  const wpBase = 'https://s-truck.co.jp';

  try {
    const res = await fetch(
      `${wpBase}/wp-json/wp/v2/${postType}?per_page=100&_embed`,
      { headers: { 'Content-Type': 'application/json' } }
    );
    if (!res.ok) throw new Error(`WordPress API error: ${res.status}`);

    const posts = await res.json();

    const items = posts.map((post: any) => ({
  id: String(post.id),
  title: post.title?.rendered || '',
  status: post.status || '',
  date: post.date?.slice(0, 10) || '',
  // ACFフィールドを展開
  ...(post.acf || {}),
}));

    return NextResponse.json({ success: true, data: items });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}