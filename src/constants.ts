/**
 * 今日の日付をもとに「今月1日 〜 今月末日」の範囲を YYYY-MM-DD 形式で返す
 */
export function getDefaultFilterDateRange(): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0); // 翌月0日 = 今月末日

  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    start: `${y}-${pad(m + 1)}-01`,
    end: `${y}-${pad(m + 1)}-${pad(end.getDate())}`,
  };
}

// 後方互換のため旧定数も残す（必要に応じて削除可能）
export const DEFAULT_FILTER_DATE_RANGE = getDefaultFilterDateRange();