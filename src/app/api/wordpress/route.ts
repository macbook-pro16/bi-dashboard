import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const postType = searchParams.get('type') || 'inventory';
  const wpBase = 'https://s-truck.co.jp';

  try {
    let allPosts: any[] = [];
    let page = 1;
    let totalPages = 1;
    const perPage = 100;

    do {
      const res = await fetch(
        `${wpBase}/wp-json/wp/v2/${postType}?per_page=${perPage}&page=${page}&_embed`,
        { headers: { 'Content-Type': 'application/json' } }
      );
      if (!res.ok) break;

      const totalPagesHeader = res.headers.get('X-WP-TotalPages');
      if (totalPagesHeader) totalPages = parseInt(totalPagesHeader, 10);

      const pageData = await res.json();
      allPosts = [...allPosts, ...pageData];
      page++;
    } while (page <= totalPages);

    const items = allPosts.map((post: any) => ({
      id: String(post.id),
      title: post.title?.rendered || '',
      status: post.status || '',
      date: post.date?.slice(0, 10) || '',
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