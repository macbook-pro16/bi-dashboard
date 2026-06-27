import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const postType = searchParams.get('type') || 'inventory';
  const wpBase = 'https://s-truck.co.jp';

  try {
    // ★ 常に bi-data.php から全データを取得（WordPress内部ルーティング不要）
    const res = await fetch(`${wpBase}/bi-data.php`);
    if (!res.ok) throw new Error('Failed to fetch bi-data');
    const allVehicles: any[] = await res.json();

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