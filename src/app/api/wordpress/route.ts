import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const postType = searchParams.get('type') || 'inventory';
  const wpBase = 'https://s-truck.co.jp';

  try {
    // ★ 写真なし車両専用の処理（専用WordPressエンドポイントを使用）
    if (postType === 'inventory-without-photo') {
      const res = await fetch(`${wpBase}/wp-json/custom/v1/inventory-photo-status`);
      if (!res.ok) {
        throw new Error(`Failed to fetch photo status: ${res.status}`);
      }
      const allVehicles = await res.json(); // 全在庫車両とhas_photoフラグを返す

      // 写真がない車両だけを抽出
      const vehiclesWithoutPhoto = allVehicles
        .filter((vehicle: any) => vehicle.has_photo === false)
        .map((vehicle: any) => ({
          id: String(vehicle.id),
          title: vehicle.title || '',
          status: vehicle.status || '',
          date: vehicle.date || '',
          v_manage_id: vehicle.manage_id || '',
          has_photo: vehicle.has_photo, // 念のため保持
        }));

      return NextResponse.json({ success: true, data: vehiclesWithoutPhoto });
    }

    // ★ 通常の投稿タイプ（inventoryなど）の全件取得（既存の処理）
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