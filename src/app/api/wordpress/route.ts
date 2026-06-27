import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const postType = searchParams.get('type') || 'inventory';
  const wpBase = 'https://s-truck.co.jp';

  try {
    // 必ず動作する専用エンドポイントから全データを取得
    const res = await fetch(`${wpBase}/wp-json/bi/v1/inventory`);
    if (!res.ok) throw new Error('BI API error');
    const allVehicles: any[] = await res.json();

    // allVehicles には v_manage_id, v_price, has_photo などすべてが含まれる
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