import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const postType = searchParams.get('type') || 'inventory';
  const wpBase = 'https://s-truck.co.jp';

  try {
    // ★ 写真なし車両専用の処理（専用WordPressエンドポイントを使用）
    if (postType === 'inventory-without-photo') {
  // 全在庫車両を取得（ページネーション）
  let allVehicles: any[] = [];
  let page = 1;
  let totalPages = 1;
  const perPage = 100;
  do {
    const res = await fetch(`${wpBase}/wp-json/wp/v2/inventory?per_page=${perPage}&page=${page}`);
    if (!res.ok) break;
    const totalPagesHeader = res.headers.get('X-WP-TotalPages');
    if (totalPagesHeader) totalPages = parseInt(totalPagesHeader, 10);
    const pageData = await res.json();
    allVehicles = [...allVehicles, ...pageData];
    page++;
  } while (page <= totalPages);

  // 全メディアを取得（一度だけ）
  let allMedia: { id: number; source_url: string }[] = [];
  let mediaPage = 1;
  let mediaTotalPages = 1;
  do {
    const mediaRes = await fetch(`${wpBase}/wp-json/wp/v2/media?per_page=100&page=${mediaPage}`);
    if (!mediaRes.ok) break;
    const totalHeader = mediaRes.headers.get('X-WP-TotalPages');
    if (totalHeader) mediaTotalPages = parseInt(totalHeader, 10);
    const mediaData = await mediaRes.json();
    allMedia = [...allMedia, ...mediaData.map((m: any) => ({ id: m.id, source_url: m.source_url.toLowerCase() }))];
    mediaPage++;
  } while (mediaPage <= mediaTotalPages);

  // 各車両の管理番号がメディアのファイル名に含まれるかチェック
  const vehiclesWithoutPhoto = allVehicles
    .filter(vehicle => {
      const manageId = vehicle.acf?.v_manage_id?.toString().toLowerCase();
      if (!manageId) return false; // 管理番号なしはスキップ
      // メディアのURLに管理番号が含まれていれば「写真あり」
      const hasPhoto = allMedia.some(m => m.source_url.includes(`/${manageId}_`));
      return !hasPhoto;
    })
    .map(vehicle => ({
      id: String(vehicle.id),
      title: vehicle.title?.rendered || '',
      status: vehicle.status || '',
      date: vehicle.date?.slice(0, 10) || '',
      v_manage_id: vehicle.acf?.v_manage_id || '',
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