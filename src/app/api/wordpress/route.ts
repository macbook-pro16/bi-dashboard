import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const postType = searchParams.get('type') || 'inventory';
  const wpBase = 'https://s-truck.co.jp';

  try {
    // 在庫車両データの取得（全ページ）
    let allVehicles: any[] = [];
    let page = 1;
    let totalPages = 1;
    const perPage = 100;
    do {
      const res = await fetch(
        `${wpBase}/wp-json/wp/v2/inventory?per_page=${perPage}&page=${page}&_embed`
      );
      if (!res.ok) break;
      const totalPagesHeader = res.headers.get('X-WP-TotalPages');
      if (totalPagesHeader) totalPages = parseInt(totalPagesHeader, 10);
      const pageData = await res.json();
      allVehicles = [...allVehicles, ...pageData];
      page++;
    } while (page <= totalPages);

    // 全メディアを一括取得（ファイル名判定用）
    let allMedia: { id: number; source_url: string }[] = [];
    let mediaPage = 1;
    let mediaTotalPages = 1;
    do {
      const mediaRes = await fetch(
        `${wpBase}/wp-json/wp/v2/media?per_page=100&page=${mediaPage}`
      );
      if (!mediaRes.ok) break;
      const totalHeader = mediaRes.headers.get('X-WP-TotalPages');
      if (totalHeader) mediaTotalPages = parseInt(totalHeader, 10);
      const mediaData = await mediaRes.json();
      allMedia = [
        ...allMedia,
        ...mediaData.map((m: any) => ({
          id: m.id,
          source_url: m.source_url.toLowerCase(),
        })),
      ];
      mediaPage++;
    } while (mediaPage <= mediaTotalPages);

    // 各車両に has_photo を付与
    const vehiclesWithPhotoFlag = allVehicles.map((vehicle: any) => {
      const manageId = String(vehicle.acf?.v_manage_id || '').trim().toLowerCase();
      const hasPhoto = manageId
        ? allMedia.some((m) => m.source_url.includes(`/${manageId}_`))
        : false;
      return {
        id: String(vehicle.id),
        title: vehicle.title?.rendered || '',
        status: vehicle.status || '',
        date: vehicle.date?.slice(0, 10) || '',
        ...(vehicle.acf || {}),
        has_photo: hasPhoto,
      };
    });

    // 写真なし車両を抽出するリクエストの場合
    if (postType === 'inventory-without-photo') {
      const withoutPhoto = vehiclesWithPhotoFlag.filter((v) => !v.has_photo);
      return NextResponse.json({ success: true, data: withoutPhoto });
    }

    // 通常の全在庫車両（has_photo 付き）
    return NextResponse.json({ success: true, data: vehiclesWithPhotoFlag });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}