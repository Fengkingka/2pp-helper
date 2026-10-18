/**
 * 練習引擎的核心邏輯（沒有 UI，方便測試）。頁面組件只負責顯示和收集輸入。
 */
import type { Scenario, SessionLog, Step, StartupProfile } from "../types";
import { simulateRunway, type MonthDecision, type MonthEvent, type RunwayState } from "../calc/runway";

/** 可重現的亂數（mulberry32）。同一個 seed 必定抽到同一組卡。 */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type EventStep = Extract<Step, { type: "event" }>;

/** Black Swan：從事件卡中抽 count 張，依次放在 months 指定的月份。 */
export function drawEvents(scenario: Scenario, count = 3, months = [3, 6, 9], seed = scenario.seed ?? Date.now()): EventStep[] {
  const deck = scenario.steps.filter((s): s is EventStep => s.type === "event");
  const rand = seededRandom(seed);
  const shuffled = deck.map((s) => ({ s, k: rand() })).sort((a, b) => a.k - b.k).map((x) => x.s);
  return shuffled.slice(0, Math.min(count, deck.length)).map((s, i) => ({ ...s, month: months[i] ?? s.month }));
}

export function newSession(scenario: Scenario): SessionLog {
  return { scenarioId: scenario.id, kind: scenario.mode, steps: [], turns: [] };
}

/** 記錄一步（不修改原本的 log，方便放入 Zustand）。 */
export function recordStep(log: SessionLog, entry: SessionLog["steps"][number]): SessionLog {
  return { ...log, steps: [...log.steps.filter((s) => s.stepId !== entry.stepId), entry] };
}

export function profileToRunway(p: StartupProfile): RunwayState {
  return {
    finance: p.finance,
    cash: p.cash, monthlyRevenue: p.monthlyRevenue, headcount: p.headcount, avgSalary: p.avgSalary,
    serverCost: p.serverCost, marketing: p.marketing, otherCost: p.otherCost, price: p.price,
  };
}

/**
 * Black Swan：把已抽的事件和用戶的決定交給計算器。
 * 決定來自 log.steps：stepId 對應事件卡，inputs 的 key 對應 RunwayState 欄位。
 */
export function runBlackSwan(profile: StartupProfile, drawn: EventStep[], log: SessionLog, months = 12) {
  const events: MonthEvent[] = drawn.map((e) => ({ month: e.month, effects: e.card.effects }));
  const decisions: MonthDecision[] = log.steps.flatMap((s) => {
    const ev = drawn.find((e) => e.id === s.stepId);
    if (!ev) return [];
    const num = (k: string) => (typeof s.inputs[k] === "number" ? (s.inputs[k] as number) : undefined);
    return [{
      month: ev.month,
      changes: {
        headcount: num("headcount"), avgSalary: num("avgSalary"), serverCost: num("serverCost"),
        marketing: num("marketing"), otherCost: num("otherCost"), price: num("price"),
      },
      bridgeRound: num("bridgeRound"),
    }];
  });
  // 移除 undefined，避免覆蓋原有設定
  for (const d of decisions) {
    for (const k of Object.keys(d.changes) as (keyof typeof d.changes)[]) if (d.changes[k] === undefined) delete d.changes[k];
  }
  return simulateRunway(profileToRunway(profile), events, decisions, months);
}
