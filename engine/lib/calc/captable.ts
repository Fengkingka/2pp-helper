/**
 * 股權表計算器（純函數，無副作用）。
 * 期權池以普通股計算（fully diluted）。所有數字由這裡計，AI 只引用結果。
 */

export interface Preference {
  invested: number;      // 投資額
  multiple: number;      // 清算優先權倍數，例如 1 或 2
  participating: boolean;
  seniority: number;     // 數字越大越優先；相同數字 = pari passu
}

export interface Holder {
  id: string;            // "founders" | "pool" | 輪次名稱
  shares: number;
  pref?: Preference;     // 只有優先股有
}

export type CapTable = Holder[];

export interface RoundTerms {
  name: string;                 // 例如 "seed"
  preMoney: number;
  investment: number;
  poolTargetPct: number;        // 交易後期權池佔 fully diluted 的比例，例如 0.1
  poolTiming: "pre" | "post";   // 投前擴大期權池（創辦人承擔）或投後
  liqMultiple: number;
  participating: boolean;
  seniority?: "standard" | "pari_passu"; // standard：新一輪優先於舊輪
}

export interface RoundResult {
  table: CapTable;
  pricePerShare: number;
  newPoolShares: number;
  investorShares: number;
  postMoney: number;
}

export const totalShares = (t: CapTable) => t.reduce((s, h) => s + h.shares, 0);

export function ownership(t: CapTable): Record<string, number> {
  const total = totalShares(t);
  const out: Record<string, number> = {};
  for (const h of t) out[h.id] = (out[h.id] ?? 0) + h.shares / total;
  return out;
}

function poolShares(t: CapTable) {
  return t.filter((h) => h.id === "pool").reduce((s, h) => s + h.shares, 0);
}

export function applyRound(table: CapTable, r: RoundTerms): RoundResult {
  if (r.preMoney <= 0 || r.investment <= 0) throw new Error("preMoney 和 investment 必須大於 0");
  if (r.poolTargetPct < 0 || r.poolTargetPct >= 1) throw new Error("poolTargetPct 必須介乎 0 至 1");

  const sPre = totalShares(table);
  const existingPool = poolShares(table);
  const t = r.poolTargetPct;
  let newPool: number;
  let price: number;
  let inv: number;

  if (r.poolTiming === "pre") {
    // 期權池在投前建立，價格按包括新期權池的股數計算，稀釋全部由現有股東承擔。
    const k = r.investment / r.preMoney;
    newPool = Math.max(0, (t * (1 + k) * sPre - existingPool) / (1 - t * (1 + k)));
    price = r.preMoney / (sPre + newPool);
    inv = r.investment / price;
  } else {
    // 期權池在投後建立，投資者也一同被稀釋。
    price = r.preMoney / sPre;
    inv = r.investment / price;
    newPool = Math.max(0, (t * (sPre + inv) - existingPool) / (1 - t));
  }

  const maxSeniority = Math.max(0, ...table.map((h) => h.pref?.seniority ?? 0));
  const seniority = r.seniority === "pari_passu" ? Math.max(1, maxSeniority) : maxSeniority + 1;

  const next: CapTable = table.map((h) => ({ ...h }));
  if (newPool > 0) {
    const pool = next.find((h) => h.id === "pool");
    if (pool) pool.shares += newPool;
    else next.push({ id: "pool", shares: newPool });
  }
  next.push({
    id: r.name,
    shares: inv,
    pref: { invested: r.investment, multiple: r.liqMultiple, participating: r.participating, seniority },
  });

  return { table: next, pricePerShare: price, newPoolShares: newPool, investorShares: inv, postMoney: r.preMoney + r.investment };
}

/** 連續模擬多輪融資，回傳每一輪之後的持股比例（給圖表用）。 */
export function simulateRounds(initial: CapTable, rounds: RoundTerms[]) {
  let table = initial;
  const snapshots: { round: string; ownership: Record<string, number>; postMoney: number }[] = [
    { round: "start", ownership: ownership(initial), postMoney: 0 },
  ];
  for (const r of rounds) {
    const res = applyRound(table, r);
    table = res.table;
    snapshots.push({ round: r.name, ownership: ownership(table), postMoney: res.postMoney });
  }
  return { table, snapshots };
}
