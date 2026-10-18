/**
 * 反攤薄（anti-dilution）計算器（純函數）：下一輪的每股價格低於優先股原本的換股價時，按條款調整換股價，
 * 優先股持有人換股時可以得到更多股份。所有數字由這裡計，AI 只引用結果。
 *
 *  - none：不調整。
 *  - full ratchet：換股價直接降到新一輪的價格。
 *  - broad-based weighted average：CP2 = CP1 × (A + B) ÷ (A + C)
 *      CP1 = 原本的換股價（投資額 ÷ 股數）
 *      A   = 新一輪發行前的全部股數（fully diluted，包括期權池和今輪擴大的期權池）
 *      B   = 新一輪的投資額按 CP1 可以買到的股數（投資額 ÷ CP1）
 *      C   = 新一輪實際發行的股數（投資額 ÷ 新價格）
 *
 * 簡化（教育用途）：新一輪投資者的股數按調整前的股權表定價，調整後新增的股份由其他所有股東（包括新投資者）一同攤薄；
 * 不處理 pay-to-play、豁免發行（carve-outs）和多次調整。
 */
import { applyRound, totalShares, type CapTable, type RoundResult, type RoundTerms } from "./captable";

export type AntiDilutionKind = "none" | "full_ratchet" | "broad_based";
export const ANTI_DILUTION_KINDS: AntiDilutionKind[] = ["none", "broad_based", "full_ratchet"];

/** broad-based weighted average：CP2 = CP1 × (A + B) ÷ (A + C) */
export function weightedAveragePrice(cp1: number, sharesBefore: number, newMoney: number, newPrice: number): number {
  if (cp1 <= 0 || sharesBefore <= 0 || newMoney <= 0 || newPrice <= 0) {
    throw new Error("換股價、股數、投資額和新價格都必須大於 0");
  }
  const b = newMoney / cp1;
  const c = newMoney / newPrice;
  return (cp1 * (sharesBefore + b)) / (sharesBefore + c);
}

/** 按條款計算調整後的換股價；新價格不低於原價時一律不調整。 */
export function adjustedConversionPrice(
  kind: AntiDilutionKind, cp1: number, newPrice: number, sharesBefore: number, newMoney: number
): number {
  if (kind === "none" || newPrice >= cp1) return cp1;
  if (kind === "full_ratchet") return newPrice;
  return weightedAveragePrice(cp1, sharesBefore, newMoney, newPrice);
}

export interface AntiDilutionResult extends RoundResult {
  /** 受保障股東原本的換股價（投資額 ÷ 股數） */
  originalPrice: number;
  /** 調整後的換股價 */
  adjustedPrice: number;
  /** 因調整而增加的股份 */
  extraShares: number;
  /** 新一輪價格是否低於原本的換股價 */
  isDownRound: boolean;
}

/**
 * 進行新一輪融資，然後按反攤薄條款調整 protectedId（例如 "種子輪"）的股數。
 * 調整後的股數 = 投資額 ÷ 調整後的換股價。
 */
export function applyRoundWithAntiDilution(
  table: CapTable, round: RoundTerms, protectedId: string, kind: AntiDilutionKind
): AntiDilutionResult {
  const r = applyRound(table, round);
  const holder = r.table.find((h) => h.id === protectedId);
  if (!holder || !holder.pref || holder.shares <= 0) throw new Error(`找不到有優先權的股東：${protectedId}`);
  const cp1 = holder.pref.invested / holder.shares;
  const sharesBefore = totalShares(r.table) - r.investorShares;
  const cp2 = adjustedConversionPrice(kind, cp1, r.pricePerShare, sharesBefore, round.investment);
  const newShares = holder.pref.invested / cp2;
  const next: CapTable = r.table.map((h) => (h.id === protectedId ? { ...h, shares: newShares } : { ...h }));
  return {
    ...r,
    table: next,
    originalPrice: cp1,
    adjustedPrice: cp2,
    extraShares: newShares - holder.shares,
    isDownRound: r.pricePerShare < cp1,
  };
}
