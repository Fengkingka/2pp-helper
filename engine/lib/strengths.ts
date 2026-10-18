/**
 * 性格與強項問卷計分（第 2 版）。程式計分，不經 AI。
 * 每個量表取平均：正向題直接用 1–5 分，反向題轉換成 6 − 分數。
 * 結果只作自我反思：不用作篩選、排序或推薦職位的分數。
 */
export interface QuestionnaireItem {
  id: string;
  scale: string;
  keyed: 1 | -1;
}

export interface StrengthScores {
  scores: Record<string, number>; // 1–5，兩位小數
  complete: boolean;
  missing: string[]; // 未作答的題目 id
}

export function scoreItem(item: QuestionnaireItem, answer: number): number {
  if (!Number.isInteger(answer) || answer < 1 || answer > 5) throw new Error(`答案必須是 1 至 5 的整數：${item.id}`);
  return item.keyed === -1 ? 6 - answer : answer;
}

export function scoreStrengths(items: QuestionnaireItem[], answers: Record<string, number>): StrengthScores {
  const sums: Record<string, { total: number; n: number }> = {};
  const missing: string[] = [];
  for (const item of items) {
    sums[item.scale] ??= { total: 0, n: 0 };
    const a = answers[item.id];
    if (a === undefined || a === null) {
      missing.push(item.id);
      continue;
    }
    sums[item.scale].total += scoreItem(item, a);
    sums[item.scale].n += 1;
  }
  const scores: Record<string, number> = {};
  for (const [scale, { total, n }] of Object.entries(sums)) {
    if (n > 0) scores[scale] = Math.round((total / n) * 100) / 100;
  }
  return { scores, complete: missing.length === 0, missing };
}

/** 由高至低排列量表（只顯示相對高低，不講「好」或「差」）。分數相同時按原本次序。 */
export function rankStrengths(scores: Record<string, number>): string[] {
  return Object.keys(scores)
    .map((k, i) => ({ k, i, v: scores[k] }))
    .sort((a, b) => b.v - a.v || a.i - b.i)
    .map((x) => x.k);
}
