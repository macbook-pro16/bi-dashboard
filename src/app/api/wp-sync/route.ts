import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

export async function POST(request: NextRequest) {
  // ★ 権限チェック
  const session = await getServerSession();
  const role = session?.user?.role || 'viewer';
  if (role !== 'admin' && role !== 'editor') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const wpApiUrl = process.env.WP_API_URL;
    const wpApiToken = process.env.WP_API_TOKEN;

    if (!wpApiUrl || !wpApiToken) {
      return NextResponse.json({ success: false, error: 'WordPress APIの設定が不足しています。' }, { status: 500 });
    }

    const body = await request.json();
    const { item } = body; // DBItem 型の車両データ

    if (!item) {
      return NextResponse.json({ success: false, error: '車両データが必要です。' }, { status: 400 });
    }

    // WordPressのカスタム投稿タイプ 'truck' にPOSTするペイロードを構築
    const payload = {
      title: item.name || 'No Name',
      status: 'publish',
      meta: {
        chassis_number: item.chassisNumber || '',
        vehicle_status: item.status || '',
        price: item.price ? Number(item.price) : 0,
        vehicle_type: item.vehicleType || '',
        date: item.date || '',
      },
    };

    const response = await fetch(`${wpApiUrl}/wp-json/wp/v2/truck`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${wpApiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('WordPress Sync Error:', errorData);
      return NextResponse.json({ success: false, error: 'WordPressへの同期に失敗しました。' }, { status: 500 });
    }

    const result = await response.json();
    return NextResponse.json({ success: true, message: 'Webへの公開が完了しました', data: result });
  } catch (error: any) {
    console.error('WP Sync Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}