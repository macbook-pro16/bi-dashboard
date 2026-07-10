import { NextResponse, NextRequest } from 'next/server';

// ★ 簡易インメモリキャッシュ (データ用とユーザー用)
const CACHE_TTL_MS = 60_000; // 1分
const USER_CACHE_TTL_MS = 300_000; // ユーザー情報は更新頻度が低いため5分キャッシュ
const cache = new Map<string, { data: any; timestamp: number }>();

let userCache: Record<string, string> | null = null;
let userCacheTimestamp = 0;

// ==========================================
// ★追加：Notionのユーザー一覧を取得し、UUID -> 名前のマッピングを作成する関数
// ==========================================
async function getUserMap(apiKey: string): Promise<Record<string, string>> {
  // キャッシュが有効なら返す
  if (userCache && Date.now() - userCacheTimestamp < USER_CACHE_TTL_MS) {
    return userCache;
  }

  try {
    const response = await fetch('https://api.notion.com/v1/users', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Notion-Version': '2022-06-28',
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch Notion users');
      return userCache || {}; // 失敗時は古いキャッシュか空オブジェクトを返す
    }

    const data = await response.json();
    const map: Record<string, string> = {};

    if (data.results) {
      data.results.forEach((u: any) => {
        // 名前 -> メールアドレス -> UUID の順で優先して設定
        map[u.id] = u.name || u.person?.email || u.id;
      });
    }

    // Notionの内部Bot用デフォルトID
    map['00000000-0000-0000-0000-000000000003'] = 'Notion';

    userCache = map;
    userCacheTimestamp = Date.now();
    return map;
  } catch (error) {
    console.error('User map generation error:', error);
    return userCache || {};
  }
}

// ==========================================
// ★修正：第2引数に userMap を受け取り、UUIDを名前に変換できるようにする
// ==========================================
function extractNotionValue(prop: any, userMap: Record<string, string> = {}): any {
  if (!prop) return '';

  // 配列の場合は各要素を展開してカンマ区切りで結合（再帰呼び出しにもuserMapを渡す）
  if (Array.isArray(prop)) {
    return prop.map((p) => extractNotionValue(p, userMap)).filter(v => v !== '' && v !== null && v !== undefined).join(', ');
  }

  // オブジェクト以外（既に文字列や数値）ならそのまま返す
  if (typeof prop !== 'object') {
    return prop;
  }

  // ユーザーオブジェクトの検出（Partial User対策）
  if (prop.object === 'user') {
    return userMap[prop.id] || prop.name || prop.id;
  }
  if (prop.id && prop.name && !prop.type) {
    return prop.name;
  }
  if (prop.name && typeof prop.name === 'string') {
    return prop.name;
  }

  switch (prop.type) {
    case 'number':
      return prop.number ?? 0;
    case 'select':
      return prop.select?.name || '';
    case 'multi_select':
      return prop.multi_select?.map((s: any) => s.name).join(', ') || '';
    case 'rich_text':
      return prop.rich_text?.map((r: any) => r.plain_text).join('') || '';
    case 'title':
      return prop.title?.map((t: any) => t.plain_text).join('') || '';
    case 'date':
      return prop.date?.start || '';
    case 'status':
      return prop.status?.name || '';
    case 'checkbox':
      return prop.checkbox;
    case 'url':
      return prop.url || '';
    case 'email':
      return prop.email || '';
    case 'phone_number':
      return prop.phone_number || '';
    case 'created_time':
      return prop.created_time || '';
    case 'last_edited_time':
      return prop.last_edited_time || '';

    // ★修正：UUIDを使って userMap から名前を取得
    case 'created_by': {
      const cbId = prop.created_by?.id;
      return userMap[cbId] || prop.created_by?.name || prop.created_by?.person?.email || cbId || '';
    }
    case 'last_edited_by': {
      const lebId = prop.last_edited_by?.id;
      return userMap[lebId] || prop.last_edited_by?.name || prop.last_edited_by?.person?.email || lebId || '';
    }
    case 'people':
      return prop.people?.map((p: any) => extractNotionValue(p, userMap)).filter(Boolean).join(', ') || '';
    
    case 'files': {
      const fileItems = prop.files?.map((f: any) => ({
        type: f.type,
        name: f.name || '',
        url: f.type === 'external' ? f.external?.url : f.file?.url,
        expiryTime: f.file?.expiry_time || null,
      })).filter((f: any) => f.url) || [];

      if (fileItems.length === 0) return '';
      return JSON.stringify(fileItems);
    }
    case 'relation': {
      if (Array.isArray(prop.relation)) {
        return prop.relation.map((r: any) => extractNotionValue(r, userMap)).filter(Boolean).join(', ') || '';
      }
      return '';
    }
    case 'formula': {
      const f = prop.formula;
      if (!f) return '';
      if (f.type === 'number') return f.number ?? 0;
      if (f.type === 'string') return f.string || '';
      if (f.type === 'boolean') return f.boolean;
      if (f.type === 'date') return f.date?.start || '';
      return '';
    }
    case 'rollup': {
      const r = prop.rollup;
      if (!r) return '';
      if (r.type === 'number') return r.number ?? 0;
      if (r.type === 'date') return r.date?.start || '';
      if (r.type === 'array') {
        return r.array.map((item: any) => {
          const val = extractNotionValue(item, userMap);
          return typeof val === 'object' ? JSON.stringify(val) : String(val);
        }).filter(Boolean).join(', ');
      }
      return '';
    }
    case 'unique_id': {
      const uid = prop.unique_id;
      return uid?.prefix ? `${uid.prefix}-${uid.number || ''}` : (uid?.number?.toString() || '');
    }
    case 'button':
      return '';
    default:
      if (prop.name) return prop.name;
      if (prop.plain_text) return prop.plain_text;
      if (prop.id) return prop.id;
      try { 
        return JSON.stringify(prop); 
      } catch { 
        return String(prop); 
      }
  }
}

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.NOTION_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'NOTION_API_KEY が設定されていません。' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const index = searchParams.get('index') || '001';
    const envKey = `NOTION_DB_ID_${index}`;
    const databaseId = process.env[envKey];

    if (!databaseId) {
      return NextResponse.json({ success: false, error: `環境変数 [${envKey}] が定義されていません。` }, { status: 400 });
    }

    // データキャッシュチェック
    const cacheKey = `notion_${index}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json({
        success: true,
        index,
        totalCount: cached.data.length,
        data: cached.data,
        cached: true,
      });
    }

    // ★追加：ユーザーマッピングの取得
    const userMap = await getUserMap(apiKey);

    let allResults: any[] = [];
    let hasMore = true;
    let startCursor: string | undefined = undefined;

    while (hasMore) {
      const body: any = {};
      if (startCursor) body.start_cursor = startCursor;

      const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.json();
        console.error('Notion API Error:', err);
        return NextResponse.json({ success: false, error: `Notion API error: ${err.message || response.statusText}` }, { status: response.status });
      }

      const data = await response.json();
      if (data.results) allResults = [...allResults, ...data.results];
      hasMore = data.has_more;
      startCursor = data.next_cursor;
    }

    const formattedData = allResults.map((page: any) => {
      const props = page.properties || {};

      let titleText = '---';
      for (const key of Object.keys(props)) {
        if (props[key]?.type === 'title') {
          titleText = props[key].title?.[0]?.plain_text || '---';
          break;
        }
      }

      const chassisCandidates = ['車体番号', '車台番号', '管理番号', '車体NO', '品番', 'Chassis', 'chassisNumber'];
      let chassisNumber = '---';
      for (const key of chassisCandidates) {
        const prop = props[key];
        if (prop) {
          const val = extractNotionValue(prop, userMap); // ★ userMap を渡す
          if (val) { 
            chassisNumber = String(val); 
            break; 
          }
        }
      }

      const dateCandidates = ['成約日', '期日', '仕入日', '日付', 'Date', 'date'];
      let dateVal: string | null = null;
      for (const key of dateCandidates) {
        const prop = props[key];
        if (prop?.type === 'date' && prop.date?.start) {
          dateVal = prop.date.start;
          break;
        }
      }

      const statusCandidates = ['ステータス', '状況', '状態', 'Status', 'status'];
      let statusText = '---';
      for (const key of statusCandidates) {
        const prop = props[key];
        if (prop) {
          const val = extractNotionValue(prop, userMap); // ★ userMap を渡す
          if (val) { 
            statusText = String(val); 
            break; 
          }
        }
      }

      // ★修正：トップレベルのユーザー情報も userMap を使って名前を解決
      let lastEditedBy = '';
      if (page.last_edited_by) {
        lastEditedBy = userMap[page.last_edited_by.id] 
          || page.last_edited_by.name 
          || page.last_edited_by.person?.email 
          || page.last_edited_by.id 
          || '';
      }
      
      let createdBy = '';
      if (page.created_by) {
        createdBy = userMap[page.created_by.id] 
          || page.created_by.name 
          || page.created_by.person?.email 
          || page.created_by.id 
          || '';
      }

      const baseItem: any = {
        id: page.id,
        name: titleText,
        chassisNumber,
        date: dateVal,
        status: statusText,
        last_edited_by: lastEditedBy,
        created_by: createdBy,
      };

      // その他すべてのプロパティを動的に抽出
      for (const key of Object.keys(props)) {
        if (['id', 'name', 'chassisNumber', 'date', 'status', 'last_edited_by', 'created_by'].includes(key)) continue;
        baseItem[key] = extractNotionValue(props[key], userMap); // ★ userMap を渡す
      }

      return baseItem;
    });

    cache.set(cacheKey, { data: formattedData, timestamp: Date.now() });

    return NextResponse.json({
      success: true,
      index,
      totalCount: formattedData.length,
      data: formattedData,
    });
  } catch (error: any) {
    console.error('Notion Multi-DB Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}