import { NextResponse, NextRequest } from 'next/server';

// ==========================================
// ★大幅改善：Notionの複雑なプロパティから「人間が読める値」だけを的確に抽出する再帰関数
// ==========================================
function extractNotionValue(prop: any): any {
  if (!prop) return '';

  // 配列の場合は各要素を展開してカンマ区切りで結合
  if (Array.isArray(prop)) {
    return prop.map(extractNotionValue).filter(v => v !== '' && v !== null && v !== undefined).join(', ');
  }

  // オブジェクト以外（既に文字列や数値）ならそのまま返す
  if (typeof prop !== 'object') {
    return prop;
  }

  // ユーザーオブジェクトの検出 (id と name を持ち、type が people でない場合)
  if (prop.object === 'user' && prop.name) {
    return prop.name;
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
    // ★追加：作成者と最終更新者のプロパティタイプ専用の抽出処理
    case 'created_by':
      return prop.created_by?.name || prop.created_by?.person?.email || prop.created_by?.id || '';
    case 'last_edited_by':
      return prop.last_edited_by?.name || prop.last_edited_by?.person?.email || prop.last_edited_by?.id || '';
    case 'people':
      return prop.people?.map((p: any) => extractNotionValue(p)).filter(Boolean).join(', ') || '';
    case 'files': {
      // ★★★ 修正A: 構造化されたオブジェクト配列をJSON文字列で返す ★★★
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
        return prop.relation.map((r: any) => extractNotionValue(r)).filter(Boolean).join(', ') || '';
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
          const val = extractNotionValue(item);
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

// ★ 簡易インメモリキャッシュ
const CACHE_TTL_MS = 60_000; // 1分
const cache = new Map<string, { data: any; timestamp: number }>();

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

    // キャッシュチェック
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

      // タイトルの抽出
      let titleText = '---';
      for (const key of Object.keys(props)) {
        if (props[key]?.type === 'title') {
          titleText = props[key].title?.[0]?.plain_text || '---';
          break;
        }
      }

      // 車体番号の抽出
      const chassisCandidates = ['車体番号', '車台番号', '管理番号', '車体NO', '品番', 'Chassis', 'chassisNumber'];
      let chassisNumber = '---';
      for (const key of chassisCandidates) {
        const prop = props[key];
        if (prop) {
          const val = extractNotionValue(prop);
          if (val) { 
            chassisNumber = String(val); 
            break; 
          }
        }
      }

      // 日付の抽出
      const dateCandidates = ['成約日', '期日', '仕入日', '日付', 'Date', 'date'];
      let dateVal: string | null = null;
      for (const key of dateCandidates) {
        const prop = props[key];
        if (prop?.type === 'date' && prop.date?.start) {
          dateVal = prop.date.start;
          break;
        }
      }

      // ステータスの抽出
      const statusCandidates = ['ステータス', '状況', '状態', 'Status', 'status'];
      let statusText = '---';
      for (const key of statusCandidates) {
        const prop = props[key];
        if (prop) {
          const val = extractNotionValue(prop);
          if (val) { 
            statusText = String(val); 
            break; 
          }
        }
      }

      let lastEditedBy = '';
      if (page.last_edited_by) {
        lastEditedBy = page.last_edited_by.name 
          || page.last_edited_by.person?.email 
          || page.last_edited_by.id 
          || '';
      }
      // UUID形式（例: 00000000-0000-0000-0000-000000000003）なら「Notion」に置換
      if (/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(lastEditedBy)) {
        lastEditedBy = 'Notion';
      }
      
      let createdBy = '';
      if (page.created_by) {
        createdBy = page.created_by.name || page.created_by.id || '';
      }
      if (/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(createdBy)) {
        createdBy = 'Notion';
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
        baseItem[key] = extractNotionValue(props[key]);
      }

      return baseItem;
    });

    // キャッシュに保存
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