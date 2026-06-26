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

    // 各車両の添付メディアチェックとカスタムフィールド展開
    const vehiclesWithFields = await Promise.all(
      allVehicles.map(async (vehicle: any) => {
        let hasPhoto = false;
        try {
          const mediaRes = await fetch(
            `${wpBase}/wp-json/wp/v2/media?parent=${vehicle.id}&per_page=1`
          );
          if (mediaRes.ok) {
            const mediaData = await mediaRes.json();
            hasPhoto = Array.isArray(mediaData) && mediaData.length > 0;
          }
        } catch (e) {}

        // meta オブジェクトを展開（v_manage_id, v_price などが直接利用可能に）
        const metaFields = vehicle.meta && typeof vehicle.meta === 'object' ? vehicle.meta : {};

        return {
          id: String(vehicle.id),
          title: vehicle.title?.rendered || '',
          status: vehicle.status || '',
          date: vehicle.date?.slice(0, 10) || '',
          ...metaFields,              // ★ これで v_manage_id などがフィールドとして現れる
          has_photo: hasPhoto,
        };
      })
    );

    // 写真なし車両のみ抽出
    if (postType === 'inventory-without-photo') {
      const withoutPhoto = vehiclesWithFields.filter((v) => !v.has_photo);
      return NextResponse.json({ success: true, data: withoutPhoto });
    }

    return NextResponse.json({ success: true, data: vehiclesWithFields });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}