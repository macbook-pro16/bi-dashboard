import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const postType = searchParams.get('type') || 'inventory';
  const wpBase = 'https://s-truck.co.jp';

  try {
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

    const vehicles = await Promise.all(allVehicles.map(async (v: any) => {
      // ACFフィールドを展開
      const acfFields = v.acf && typeof v.acf === 'object' ? v.acf : {};

      // 写真の有無を判定 (アイキャッチ画像 or 添付メディア)
      let hasPhoto = v.featured_media > 0;
      if (!hasPhoto) {
        try {
          const mr = await fetch(`${wpBase}/wp-json/wp/v2/media?parent=${v.id}&per_page=1`);
          if (mr.ok) {
            const md = await mr.json();
            hasPhoto = Array.isArray(md) && md.length > 0;
          }
        } catch {}
      }

      return {
        id: String(v.id),
        title: v.title?.rendered || '',
        status: v.status || '',
        date: v.date?.slice(0, 10) || '',
        ...acfFields,  // ← v_manage_id などがここで展開される
        has_photo: hasPhoto,
      };
    }));

    if (postType === 'inventory-without-photo') {
      const filtered = vehicles.filter((v: any) => !v.has_photo);
      return NextResponse.json({ success: true, data: filtered });
    }
    return NextResponse.json({ success: true, data: vehicles });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}