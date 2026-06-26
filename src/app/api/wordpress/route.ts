import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const postType = searchParams.get('type') || 'inventory';
  const wpBase = 'https://s-truck.co.jp';

  try {
    // ★ 写真なし車両専用の処理
    if (postType === 'inventory-without-photo') {
      let allVehicles: any[] = [];
      let page = 1;
      let totalPages = 1;
      const perPage = 100;

      // 全在庫車両を取得
      do {
        const res = await fetch(
          `${wpBase}/wp-json/wp/v2/inventory?per_page=${perPage}&page=${page}`,
          { headers: { 'Content-Type': 'application/json' } }
        );
        if (!res.ok) break;

        const totalPagesHeader = res.headers.get('X-WP-TotalPages');
        if (totalPagesHeader) totalPages = parseInt(totalPagesHeader, 10);

        const pageData = await res.json();
        allVehicles = [...allVehicles, ...pageData];
        page++;
      } while (page <= totalPages);

      const vehiclesWithoutPhoto = [];
      for (const vehicle of allVehicles) {
        // ★ ACFの管理番号（v_manage_id）を取得
        const managementNumber = vehicle.acf?.v_manage_id;
        if (!managementNumber) continue;

        // 管理番号でメディアを検索
        const mediaRes = await fetch(
          `${wpBase}/wp-json/wp/v2/media?search=${encodeURIComponent(managementNumber)}&per_page=1`
        );
        if (!mediaRes.ok) continue;

        const mediaData = await mediaRes.json();
        
        // メディアが見つからなければ「写真なし」として追加
        if (!mediaData || mediaData.length === 0) {
          vehiclesWithoutPhoto.push({
            id: String(vehicle.id),
            title: vehicle.title?.rendered || '',
            status: vehicle.status || '',
            date: vehicle.date?.slice(0, 10) || '',
            v_manage_id: managementNumber,
          });
        }
      }

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