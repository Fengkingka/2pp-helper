/**
 * 退出分配計算器：公司以 exitValue 被收購時，每位股東實得多少。
 * 規則：
 *  1. 未轉換的優先股按 seniority 由高至低領取優先權（倍數 × 投資額）；同級按比例分。
 *  2. 餘款按股數分給普通股、已轉換的優先股，以及 participating 優先股。
 *  3. non-participating 優先股會選擇「領優先權」或「轉換成普通股」之中較多的一項。
 * 簡化：不處理 participation cap、累積股息。
 */
import type { CapTable, Holder } from "./captable";

export type Payouts = Record<string, number>;

function distribute(table: CapTable, exitValue: number, converted: Set<string>): Payouts {
  const pay: Payouts = {};
  for (const h of table) pay[h.id] = 0;
  let remaining = exitValue;

  // 1. 優先權，按 seniority 由高至低
  const claimants = table.filter((h) => h.pref && !converted.has(h.id));
  const levels = [...new Set(claimants.map((h) => h.pref!.seniority))].sort((a, b) => b - a);
  for (const lvl of levels) {
    const group = claimants.filter((h) => h.pref!.seniority === lvl);
    const claims = group.map((h) => h.pref!.invested * h.pref!.multiple);
    const totalClaim = claims.reduce((s, c) => s + c, 0);
    const paid = Math.min(remaining, totalClaim);
    group.forEach((h, i) => (pay[h.id] += totalClaim === 0 ? 0 : (paid * claims[i]) / totalClaim));
    remaining -= paid;
    if (remaining <= 0) return pay;
  }

  // 2. 餘款按股數分配
  const sharing = table.filter(
    (h) => !h.pref || converted.has(h.id) || h.pref.participating
  );
  const sharingTotal = sharing.reduce((s, h) => s + h.shares, 0);
  for (const h of sharing) pay[h.id] += (remaining * h.shares) / sharingTotal;
  return pay;
}

export function computeWaterfall(table: CapTable, exitValue: number): { payouts: Payouts; converted: string[] } {
  if (exitValue < 0) throw new Error("exitValue 不可為負數");
  const converted = new Set<string>();
  const nonParticipating = table.filter((h): h is Holder & { pref: NonNullable<Holder["pref"]> } =>
    !!h.pref && !h.pref.participating
  );

  // 逐一檢查轉換是否更有利，每次只轉換得益最大的一方，直至沒有人想改變。
  for (let guard = 0; guard < nonParticipating.length + 1; guard++) {
    const base = distribute(table, exitValue, converted);
    let best: { id: string; gain: number } | null = null;
    for (const h of nonParticipating) {
      if (converted.has(h.id)) continue;
      const trial = distribute(table, exitValue, new Set([...converted, h.id]));
      const gain = trial[h.id] - base[h.id];
      if (gain > 1e-6 && (!best || gain > best.gain)) best = { id: h.id, gain };
    }
    if (!best) return { payouts: base, converted: [...converted] };
    converted.add(best.id);
  }
  return { payouts: distribute(table, exitValue, converted), converted: [...converted] };
}

/** 給圖表用：多個退出金額下，某位股東的實得金額和佔比。 */
export function exitScenarios(table: CapTable, exits: number[], holderId = "founders") {
  return exits.map((exitValue) => {
    const { payouts } = computeWaterfall(table, exitValue);
    const amount = payouts[holderId] ?? 0;
    return { exitValue, amount, share: exitValue === 0 ? 0 : amount / exitValue };
  });
}
