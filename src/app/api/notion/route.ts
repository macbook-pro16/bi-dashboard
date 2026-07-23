import { NextResponse, NextRequest } from 'next/server';

// ユーザー情報は更新頻度が低くデータサイズも小さいためキャッシュする（5分）
const USER_CACHE_TTL_MS = 300_000;
let userCache: Record<string, string> | null = null;
let userCacheTimestamp = 0;

// ※サーバー側のデータキャッシュ (cache Map) は、メモリ不足 (OOM) を引き起こすため撤廃しました

// ==========================================
// Notionのユーザー一覧を取得し、UUID -> 名前のマッピングを作成する関数
// ==========================================
async function getUserMap(apiKey: string): Promise<Record<string, string>> {
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
      return userCache || {};
    }

    const data = await response.json();
    const map: Record<string, string> = {};

    if (data.results) {
      data.results.forEach((u: any) => {
        map[u.id] = u.name || u.person?.email || u.id;
      });
    }

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
// UUIDを名前に変換できるようにする値抽出関数
// ==========================================
function extractNotionValue(prop: any, userMap: Record<string, string> = {}): any {
  if (!prop) return '';

  if (Array.isArray(prop)) {
    return prop.map((p) => extractNotionValue(p, userMap)).filter(v => v !== '' && v !== null && v !== undefined).join(', ');
  }

  if (typeof prop !== 'object') {
    return prop;
  }

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
    const cursor = searchParams.get('cursor') || undefined;
    const pageSize = Math.min(Number(searchParams.get('pageSize') || '100'), 100);

    const envKey = `NOTION_DB_ID_${index}`;
    const databaseId = process.env[envKey];

    if (!databaseId) {
      return NextResponse.json({ success: false, error: `環境変数 [${envKey}] が定義されていません。` }, { status: 400 });
    }

    // ユーザーマッピングの取得
    const userMap = await getUserMap(apiKey);

    // ★ 修正：whileループを撤廃し、Notion APIは1回だけ呼ぶ
    const body: any = { page_size: pageSize };
    if (cursor) body.start_cursor = cursor;

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

    const notionData = await response.json();
    const results = notionData.results || [];

    const formattedData = results.map((page: any) => {
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
          const val = extractNotionValue(prop, userMap);
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
          const val = extractNotionValue(prop, userMap);
          if (val) {
            statusText = String(val);
            break;
          }
        }
      }

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

      for (const key of Object.keys(props)) {
        if (['id', 'name', 'chassisNumber', 'date', 'status', 'last_edited_by', 'created_by'].includes(key)) continue;
        baseItem[key] = extractNotionValue(props[key], userMap);
      }

      return baseItem;
    });

    // ★ 追加：次に読む場所の情報をペイロードに含める
    const payload = {
      totalCount: formattedData.length,
      data: formattedData,
      hasMore: !!notionData.has_more,
      nextCursor: notionData.next_cursor || null,
    };

    // ※データはフロントエンド（IndexedDB）でキャッシュするため、
    // Renderサーバーのメモリを圧迫しないよう即座にクライアントへ返します
    return NextResponse.json({
      success: true,
      index,
      ...payload,
    });
  } catch (error: any) {
    console.error('Notion Multi-DB Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}