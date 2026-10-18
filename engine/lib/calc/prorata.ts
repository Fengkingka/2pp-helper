/**
 * 跟投權（pro-rata rights）計算器（純函數）：現有投資者可以在下一輪按自己的持股比例認購新股，維持持股。
 *
 *   可認購金額 = 新一輪前的 fully diluted 持股 × 新一輪總金額 × multiple
 *   multiple = 0（不設跟投權）、1（standard pro-rata）、2（兩倍，即 super pro-rata）；上限為整輪金額。
 *
 * 跟投部分與新投資者同價、同條款（同一個 seniority）。新一輪的總金額不變，
 * 所以創辦人和期權池的持股不受影響；改變的是現有投資者的持股，以及新投資者可以分到的額度。
 */
import { applyRound, ownership, type CapTable, type RoundResult, type RoundTerms } from "./captable";

/** 現有投資者在新一輪可以認購的金額。 */
export function proRataAmount(table: CapTable, holderId: string, roundInvestment: number, multiple = 1): number {
  if (roundInvestment <= 0) throw new Error("新一輪金額必須大於 0");
  if (multiple < 0) throw new Error("multiple 不可為負數");
  const pct = ownership(table)[holderId] ?? 0;
  return Math.min(roundInvestment, pct * roundInvestment * multiple);
}

export interface ProRataResult extends RoundResult {
  /** 現有投資者跟投的金額 */
  proRataAmount: number;
  /** 現有投資者跟投取得的股數 */
  proRataShares: number;
  /** 新投資者分到的金額（整輪金額 − 跟投金額） */
  leadInvestment: number;
  /** 新投資者取得的股數 */
  leadShares: number;
}

/**
 * 進行新一輪融資，並把其中 proRataAmount 分給 holderId 跟投。
 * 跟投的股份記在 followId（例如 "種子輪（A 輪跟投）"），方便退出分配時按新一輪的條款計算。
 */
export function applyRoundWithProRata(
  table: CapTable, round: RoundTerms, holderId: string, multiple: number, followId = `${holderId}（${round.name}跟投）`
): ProRataResult {
  const amount = proRataAmount(table, holderId, round.investment, multiple);
  const r = applyRound(table, round);
  const proRataShares = amount / r.pricePerShare;
  const leadShares = r.investorShares - proRataShares;
  if (amount <= 0) {
    return { ...r, proRataAmount: 0, proRataShares: 0, leadInvestment: round.investment, leadShares: r.investorShares };
  }
  const next: CapTable = [];
  for (const h of r.table) {
    if (h.id !== round.name) {
      next.push({ ...h });
      continue;
    }
    const pref = h.pref!;
    if (leadShares > 0) next.push({ ...h, shares: leadShares, pref: { ...pref, invested: round.investment - amount } });
    next.push({ id: followId, shares: proRataShares, pref: { ...pref, invested: amount } });
  }
  return {
    ...r,
    table: next,
    proRataAmount: amount,
    proRataShares,
    leadInvestment: round.investment - amount,
    leadShares,
  };
}
