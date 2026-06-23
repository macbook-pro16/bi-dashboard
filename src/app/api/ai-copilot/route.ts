// src/app/api/ai-copilot/route.ts
import { NextResponse, NextRequest } from 'next/server';

const GITHUB_MODELS_URL = 'https://models.github.ai/inference/chat/completions';
const DEFAULT_MODEL = 'meta-llama-3.1-8b-instruct';

// ★ データベース情報の型
interface DatabaseInfo {
  name: string;
  index: string;
  fields?: string[];
  records: any[]; // データ本体
}

// フォールバック：複数データベース対応
function generateFallbackResponse(prompt: string, databases: DatabaseInfo[]): string {
  const lower = prompt.toLowerCase();
  const totalRecords = databases.reduce((sum, db) => sum + db.records.length, 0);

  if (totalRecords === 0) {
    return '現在、表示できるデータがありません。Notionからデータを読み込んでください。';
  }

  // 特定のDBを指定しているか簡易判定
  for (const db of databases) {
    if (lower.includes(db.name)) {
      return `📂 **${db.name}** には **${db.records.length}件** のデータがあります。`;
    }
  }

  if (lower.includes('件数') || lower.includes('いくつ') || lower.includes('何件')) {
    let text = `全データベースの合計件数は **${totalRecords}件** です。\n`;
    databases.forEach(db => {
      text += `- ${db.name}: ${db.records.length}件\n`;
    });
    return text;
  }

  if (lower.includes('ステータス') || lower.includes('状況')) {
    const statusCounts: Record<string, number> = {};
    databases.forEach(db => {
      db.records.forEach(item => {
        const st = item.status || item.ステータス || '不明';
        statusCounts[st] = (statusCounts[st] || 0) + 1;
      });
    });
    let text = '📋 **全データベースのステータス内訳**\n';
    for (const [status, cnt] of Object.entries(statusCounts)) {
      text += `- ${status}: ${cnt}件\n`;
    }
    return text;
  }

  if (lower.includes('日付') || lower.includes('最新')) {
    const allDates = databases.flatMap(db => db.records.map(item => item.date || item.日付).filter(Boolean)).sort();
    if (allDates.length > 0) {
      return `🗓️ 最新の日付は **${allDates[allDates.length - 1]}** です。`;
    }
    return '日付情報が見つかりませんでした。';
  }

  if (lower.includes('リスト') || lower.includes('一覧')) {
    const names = databases.flatMap(db => db.records.map(item => item.name || item.車両名 || item.chassisNumber || '').filter(Boolean)).slice(0, 10);
    if (names.length > 0) {
      return `📝 **データ一覧（上位${names.length}件）**\n${names.map(n => `- ${n}`).join('\n')}`;
    }
  }

  // デフォルト
  let text = `こんにちは！現在の全データベース合計は **${totalRecords}件** です。\n`;
  databases.forEach(db => {
    text += `📁 ${db.name}: ${db.records.length}件\n`;
  });
  return text;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, fields, databases } = body;
    if (!prompt) {
      return NextResponse.json({ message: '質問を入力してください' }, { status: 400 });
    }

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      console.warn('GITHUB_TOKEN is not set');
      const fallback = generateFallbackResponse(prompt, databases || []);
      return NextResponse.json({ message: fallback });
    }

    const model = process.env.GITHUB_MODEL || DEFAULT_MODEL;

    // システムプロンプト（データベース一覧を含む）
    const dbList = (databases || []).map((db: DatabaseInfo) => {
      return `- **${db.name}** (${db.index}): フィールド [${db.fields?.join(', ') || 'なし'}], ${db.records.length}件`;
    }).join('\n');

    const systemPrompt =
      `あなたは「BIダッシュボードプロジェクト」の` +
      `中古車販売・在庫管理BIシステムの専属AIアシスタントです。` +
      `ユーザーは複数のNotionデータベースを使っており、それぞれ異なる種類のデータが格納されています。` +
      `各データベースの概要：\n${dbList}\n\n` +
      `【業務知識】\n` +
      `- ステータス：「未入庫」「整備中」「在庫中」「販売済み」「Web掲載中」など。\n` +
      `- 金額はすべて「万円」単位。税込表示。\n` +
      `- ユーザーは経営者または営業担当で、在庫状況や成約状況を素早く知りたい。\n\n` +
      `【回答ルール】\n` +
      `- 質問に応じて、適切なデータベースを参照して回答してください。\n` +
      `- データに基づく回答は、与えられたNotionデータのみを使用し、存在しない情報は「該当データがありません」と答えてください。\n` +
      `- 自然な日本語で、簡潔に。必要に応じて箇条書きやマークダウンの表を使ってください。`;

    // 各データベースのデータをテキスト化（最大30件ずつ）
    let contextText = '';
    if (databases && databases.length > 0) {
      (databases as DatabaseInfo[]).forEach(db => {
        const trimmed = db.records.slice(0, 30);
        contextText += `\n### ${db.name}\n`;
        contextText += JSON.stringify(trimmed, null, 2);
      });
    } else {
      contextText = '（現在、Notionデータが読み込まれていません）';
    }

    const userMessage = `【現在のNotionデータ】\n${contextText}\n\nユーザーの質問：${prompt}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    let answer: string | null = null;
    try {
      const response = await fetch(GITHUB_MODELS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.4,
          max_tokens: 1024,
        }),
      });

      const json = await response.json();
      if (response.ok) {
        answer = json.choices?.[0]?.message?.content || null;
      } else {
        console.warn('GitHub Models API error:', json);
      }
    } catch (fetchError) {
      console.error('Fetch to GitHub Models failed:', fetchError);
    }

    if (!answer) {
      answer = generateFallbackResponse(prompt, databases || []);
    }

    // ウィジェット生成判定
    let widget = undefined;
    const lower = prompt.toLowerCase();
    if (lower.includes('グラフを追加') || lower.includes('ウィジェットを追加') || lower.includes('カードを追加')) {
      widget = {
        id: `ai_${Date.now()}`,
        x: 200, y: 200, w: 300, h: 250,
        shape: 'rounded', bgColor: '#ffffff', textColor: '#334155', borderColor: '#e2e8f0', borderWidth: 1,
        fontSize: 48, textAlign: 'center' as const, fontFamily: 'sans', hasShadow: true, hidden: false, locked: false,
      };
      if (lower.includes('棒グラフ') || lower.includes('bar')) {
        widget.type = 'chart-status'; widget.title = 'ステータス別'; widget.w = 400; widget.h = 300;
      } else if (lower.includes('折れ線') || lower.includes('line')) {
        widget.type = 'chart-line'; widget.title = '日別推移'; widget.w = 400; widget.h = 300;
      } else if (lower.includes('kpi') || lower.includes('カード')) {
        widget.type = 'kpi-total'; widget.title = 'KPI'; widget.w = 260; widget.h = 160;
      } else if (lower.includes('テーブル') || lower.includes('明細')) {
        widget.type = 'table-details'; widget.title = '明細'; widget.w = 600; widget.h = 400;
      } else {
        widget.type = 'text-only'; widget.title = prompt.slice(0, 30);
      }
    }

    return NextResponse.json({ message: answer, widget });
  } catch (e: any) {
    console.error('AI Copilot error:', e);
    return NextResponse.json({ message: 'システムエラーが発生しました。' }, { status: 500 });
  }
}