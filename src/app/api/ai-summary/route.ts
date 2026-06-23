// src/app/api/ai-summary/route.ts
import { NextResponse, NextRequest } from 'next/server';

const GITHUB_MODELS_URL = 'https://models.github.ai/inference/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

function generateFallbackSummary(data: any[], statusCounts: Record<string, number>, todayCount: number): string {
  let summary = `【日次サマリー】\n総データ件数: **${data.length}件**\n本日のアクション: **${todayCount}件**\n\n`;
  summary += `**ステータス内訳**\n`;
  for (const [status, count] of Object.entries(statusCounts)) {
    summary += `- ${status}: ${count}件\n`;
  }
  summary += `\n※ AIサービスが一時的に利用できないため、自動生成レポートを表示しています。`;
  return summary;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, statusCounts, todayCount } = body;

    const token = process.env.GITHUB_TOKEN;
    if (token) {
      const model = process.env.GITHUB_MODEL || DEFAULT_MODEL;

      const systemMessage = `あなたは「サンオートプロジェクト」の在庫・販売管理BI専用アナリストです。

【ルール】
1. 提供されたNotionデータのみを情報源とし、正確に分析してください。
2. データにないことは「該当情報なし」と回答してください。
3. レポートはマークダウンの表や箇条書きを用いて見やすく作成してください。`;

      const userMessage = `【Notionコンテキストデータ】
総件数: ${data.length}件
本日(${new Date().toISOString().split('T')[0]})のアクション件数: ${todayCount}件
ステータス内訳: ${JSON.stringify(statusCounts)}

実際のデータ（最初の30件）:
${JSON.stringify(data.slice(0, 30), null, 2)}

上記データに基づき、現状の在庫状況サマリーと注意点をレポートしてください。`;

      const messages = [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage },
      ];

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
            temperature: 0.2,
            max_tokens: 1024,
          }),
        });

        const json = await response.json();
        if (response.ok) {
          const text = json.choices?.[0]?.message?.content;
          if (text) {
            return NextResponse.json({ summary: text });
          }
        } else {
          console.warn('GitHub Models API error:', json);
        }
      } catch (fetchError) {
        console.error('GitHub Models fetch error:', fetchError);
      }
    }

    // フォールバック
    const summary = generateFallbackSummary(data, statusCounts, todayCount);
    return NextResponse.json({ summary });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}