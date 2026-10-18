import { financialRunway, type FinancialInput, type projectFinancial } from "./financial";
/**
 * 現金流模擬器：Black Swan 和運營成本計算器共用。
 * 完全確定性：同一組輸入必定得出同一結果（隨機抽卡在 engine 用 seed 處理，不在這裡）。
 *
 * 簡化模型（參數由 V 和 J2 試玩後調整）：
 *   增長率 = baseGrowth × √(市場預算 ÷ 基準市場預算) × 開發速度 × √(人手 ÷ 起始人手)
 *   每月收入 = 上月收入 × (1 + 增長率 − 流失率)
 *   加價 r 倍：收入即時 × r，流失率 + priceElasticity × (r − 1)
 *   事件令開發速度下降，直至補聘後 hiringLagMonths 個月才恢復
 */
import type { EventEffects } from "../types";

export interface RunwayState {
  finance?: FinancialInput;
  cash: number;
  monthlyRevenue: number;
  headcount: number;
  avgSalary: number;
  serverCost: number;
  marketing: number;
  otherCost: number;
  price: number;
}

export interface RunwayParams {
  baseGrowth: number;          // 例如 0.06（每月 6%）
  baselineMarketing: number;   // 對應 baseGrowth 的市場預算
  churn: number;               // 每月流失率，例如 0.02
  priceElasticity: number;     // 加價 100% 時流失率增加多少，例如 0.05
  hiringLagMonths: number;     // 補聘到恢復產能所需月數，例如 2
}

export const DEFAULT_PARAMS: RunwayParams = {
  baseGrowth: 0.06,
  baselineMarketing: 15000,
  churn: 0.02,
  priceElasticity: 0.05,
  hiringLagMonths: 2,
};

export interface MonthDecision {
  month: number; // 由該月開始生效
  changes: Partial<Pick<RunwayState, "headcount" | "avgSalary" | "serverCost" | "marketing" | "otherCost" | "price">>;
  bridgeRound?: number; // 過橋融資金額（股權稀釋由 captable 另計）
}

export interface MonthEvent {
  month: number;
  effects: EventEffects;
}

export interface MonthRow {
  month: number;
  revenue: number;
  cost: number;
  net: number;
  cashEnd: number;
  headcount: number;
  growthRate: number;
  churn: number;
  devSpeed: number;
}

export interface RunwayResult {
  financial?: ReturnType<typeof projectFinancial>;
  rows: MonthRow[];
  bankruptMonth: number | null;
  endingCash: number;
  /** 模擬結束時，按最後一個月的淨支出推算還可以撐多少個月（有盈利時為 Infinity） */
  runwayMonths: number;
  outcome: "survived" | "bankrupt";
}

export function simulateRunway(
  initial: RunwayState,
  events: MonthEvent[] = [],
  decisions: MonthDecision[] = [],
  months = 12,
  params: RunwayParams = DEFAULT_PARAMS
): RunwayResult {
  if (initial.finance) return financialRunway(initial, events, decisions, months);
  const s = { ...initial };
  const startHeadcount = Math.max(1, initial.headcount);
  let churn = params.churn;
  let eventDevSpeed = 1;
  let devRecoveryMonth: number | null = null;
  let hiredAfterEvent = false;
  const rows: MonthRow[] = [];

  for (let m = 1; m <= months; m++) {
    // 事件
    for (const e of events.filter((e) => e.month === m)) {
      const f = e.effects;
      if (f.serverCostMultiplier) s.serverCost *= f.serverCostMultiplier;
      if (f.revenueMultiplier) s.monthlyRevenue *= f.revenueMultiplier;
      if (f.churnDelta) churn += f.churnDelta;
      if (f.cashDelta) s.cash += f.cashDelta;
      if (f.headcountDelta) s.headcount = Math.max(0, s.headcount + f.headcountDelta);
      if (f.devSpeedMultiplier) {
        eventDevSpeed *= f.devSpeedMultiplier;
        hiredAfterEvent = false;
        devRecoveryMonth = null;
      }
    }

    // 用戶決定
    for (const d of decisions.filter((d) => d.month === m)) {
      const c = d.changes;
      if (c.price !== undefined && c.price !== s.price) {
        const r = c.price / s.price;
        s.monthlyRevenue *= r;
        if (r > 1) churn += params.priceElasticity * (r - 1);
        s.price = c.price;
      }
      if (c.headcount !== undefined) {
        if (c.headcount > s.headcount && eventDevSpeed < 1 && !hiredAfterEvent) {
          hiredAfterEvent = true;
          devRecoveryMonth = m + params.hiringLagMonths;
        }
        s.headcount = c.headcount;
      }
      if (c.avgSalary !== undefined) s.avgSalary = c.avgSalary;
      if (c.serverCost !== undefined) s.serverCost = c.serverCost;
      if (c.marketing !== undefined) s.marketing = c.marketing;
      if (c.otherCost !== undefined) s.otherCost = c.otherCost;
      if (d.bridgeRound) s.cash += d.bridgeRound;
    }

    if (devRecoveryMonth !== null && m >= devRecoveryMonth) {
      eventDevSpeed = 1;
      devRecoveryMonth = null;
    }

    const marketingFactor = Math.sqrt(Math.max(0, s.marketing) / params.baselineMarketing);
    const teamFactor = Math.sqrt(s.headcount / startHeadcount);
    const growthRate = params.baseGrowth * marketingFactor * eventDevSpeed * teamFactor;

    const revenue = s.monthlyRevenue;
    const cost = s.headcount * s.avgSalary + s.serverCost + s.marketing + s.otherCost;
    const net = revenue - cost;
    s.cash += net;

    rows.push({ month: m, revenue, cost, net, cashEnd: s.cash, headcount: s.headcount, growthRate, churn, devSpeed: eventDevSpeed });

    if (s.cash < 0) {
      return { rows, bankruptMonth: m, endingCash: s.cash, runwayMonths: 0, outcome: "bankrupt" };
    }
    s.monthlyRevenue = revenue * (1 + growthRate - churn);
  }

  const last = rows[rows.length - 1];
  const runwayMonths = last.net >= 0 ? Infinity : s.cash / -last.net;
  return { rows, bankruptMonth: null, endingCash: s.cash, runwayMonths, outcome: "survived" };
}

/** 運營成本計算器：不帶事件、不帶決定，只看目前設定。 */
export function quickRunway(state: RunwayState, months = 24, params: RunwayParams = DEFAULT_PARAMS) {
  return simulateRunway(state, [], [], months, params);
}
