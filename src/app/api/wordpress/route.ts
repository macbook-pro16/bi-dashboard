import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const postType = searchParams.get('type') || 'stocks';
  const wpBase = 'https://s-truck.co.jp'; // WordPress サイトのベースURL

  try {
    // 全件取得（最大100件、ページネーションは必要に応じて追加）
    const res = await fetch(
      `${wpBase}/wp-json/wp/v2/${postType}?per_page=100&_embed`,
      { headers: { 'Content-Type': 'application/json' } }
    );
    if (!res.ok) throw new Error(`WordPress API error: ${res.status}`);

    const posts = await res.json();

    // DBItem 形式に変換（Notion と同じ形式）
    const items = posts.map((post: any) => ({
      id: String(post.id),
      title: post.title?.rendered || '',
      status: post.status || '',
      date: post.date?.slice(0, 10) || '',
      // カスタムフィールドがあればここで展開（例：車両名、価格など）
      // 実際のデータ構造に合わせて調整してください
      ...post.meta, // ただしWP REST APIではデフォルトでmetaが返らない場合あり
    }));

    return NextResponse.json({ success: true, data: items });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}