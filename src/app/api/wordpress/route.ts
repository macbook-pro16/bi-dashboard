import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const postType = searchParams.get('type') || 'inventory';
  const wpBase = 'https://s-truck.co.jp';

  try {
    // 常にカスタムエンドポイントから全データ取得（シンプルかつ最速）
    const res = await fetch(`${wpBase}/wp-json/custom/v1/inventory-detail`);
    if (!res.ok) throw new Error(`Custom endpoint error: ${res.status}`);
    const allVehicles: any[] = await res.json();
    // allVehicles には id, title, status, date, has_photo, v_manage_id, v_price などが含まれる

    if (postType === 'inventory-without-photo') {
      const withoutPhoto = allVehicles.filter((v: any) => !v.has_photo);
      return NextResponse.json({ success: true, data: withoutPhoto });
    }

    return NextResponse.json({ success: true, data: allVehicles });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}