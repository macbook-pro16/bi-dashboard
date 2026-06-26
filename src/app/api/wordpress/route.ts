import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const postType = searchParams.get('type') || 'inventory';
  const wpBase = 'https://s-truck.co.jp';

  try {
    // 在庫車両データの全件取得
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

    // 各車両の添付メディア数をチェックして has_photo を付与
    const vehiclesWithPhotoFlag = await Promise.all(
      allVehicles.map(async (vehicle: any) => {
        let hasPhoto = false;
        try {
          // この車両に紐づくメディア一覧を取得（1件でもあればOK）
          const mediaRes = await fetch(
            `${wpBase}/wp-json/wp/v2/media?parent=${vehicle.id}&per_page=1`
          );
          if (mediaRes.ok) {
            const mediaData = await mediaRes.json();
            hasPhoto = Array.isArray(mediaData) && mediaData.length > 0;
          }
        } catch (e) {
          // エラー時は写真なしとみなす
        }

        return {
          id: String(vehicle.id),
          title: vehicle.title?.rendered || '',
          status: vehicle.status || '',
          date: vehicle.date?.slice(0, 10) || '',
          ...(vehicle.acf && typeof vehicle.acf === 'object' ? vehicle.acf : {}),
          has_photo: hasPhoto,
        };
      })
    );

    // 写真なし車両のみ抽出するリクエストの場合
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