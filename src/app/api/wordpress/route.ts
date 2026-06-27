import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const postType = searchParams.get('type') || 'inventory';
  const wpBase = 'https://s-truck.co.jp';

  try {
    // 在庫車両データの全件取得
    let allVehicles: any[] = [];
    let page = 1, totalPages = 1, perPage = 100;
    do {
      const res = await fetch(
        `${wpBase}/wp-json/wp/v2/inventory?per_page=${perPage}&page=${page}&_embed`
      );
      if (!res.ok) break;
      const h = res.headers.get('X-WP-TotalPages');
      if (h) totalPages = parseInt(h, 10);
      const data = await res.json();
      allVehicles = [...allVehicles, ...data];
      page++;
    } while (page <= totalPages);

    // 各車両のカスタムフィールド展開 & has_photo 判定
    const vehicles = await Promise.all(
      allVehicles.map(async (v: any) => {
        // 写真の有無を添付メディアで判定
        let hasPhoto = false;
        try {
          const mr = await fetch(`${wpBase}/wp-json/wp/v2/media?parent=${v.id}&per_page=1`);
          if (mr.ok) {
            const md = await mr.json();
            hasPhoto = Array.isArray(md) && md.length > 0;
          }
        } catch {}

        // custom_fields があれば展開（なければ空オブジェクト）
        const custom = v.custom_fields && typeof v.custom_fields === 'object' ? v.custom_fields : {};

        return {
          id: String(v.id),
          title: v.title?.rendered || '',
          status: v.status || '',
          date: v.date?.slice(0, 10) || '',
          ...custom,          // ← これで v_manage_id などが直接フィールドに
          has_photo: hasPhoto,
        };
      })
    );

    // 写真なし車両のみ返す場合
    if (postType === 'inventory-without-photo') {
      const filtered = vehicles.filter((v: any) => !v.has_photo);
      return NextResponse.json({ success: true, data: filtered });
    }

    return NextResponse.json({ success: true, data: vehicles });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 }
    );
  }
}