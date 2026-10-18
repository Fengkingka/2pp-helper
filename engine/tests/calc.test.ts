import { describe, it, expect } from "vitest";
import { applyRound, ownership, simulateRounds, type CapTable } from "../lib/calc/captable";
import { computeWaterfall, exitScenarios } from "../lib/calc/waterfall";
import { simulateRunway, quickRunway, type RunwayState } from "../lib/calc/runway";

const founders: CapTable = [{ id: "founders", shares: 10_000_000 }];

describe("captable：期權池放在投前還是投後", () => {
  it("投前 800 萬、投資 200 萬、投前期權池 10% → 創辦人 70%、投資者 20%、期權池 10%", () => {
    const r = applyRound(founders, {
      name: "seed", preMoney: 8_000_000, investment: 2_000_000,
      poolTargetPct: 0.1, poolTiming: "pre", liqMultiple: 1, participating: false,
    });
    const o = ownership(r.table);
    expect(o.founders).toBeCloseTo(0.7, 6);
    expect(o.seed).toBeCloseTo(0.2, 6);
    expect(o.pool).toBeCloseTo(0.1, 6);
    expect(r.pricePerShare).toBeCloseTo(0.7, 6);
  });

  it("同一條件改為投後期權池 → 創辦人 72%、投資者 18%、期權池 10%", () => {
    const r = applyRound(founders, {
      name: "seed", preMoney: 8_000_000, investment: 2_000_000,
      poolTargetPct: 0.1, poolTiming: "post", liqMultiple: 1, participating: false,
    });
    const o = ownership(r.table);
    expect(o.founders).toBeCloseTo(0.72, 6);
    expect(o.seed).toBeCloseTo(0.18, 6);
    expect(o.pool).toBeCloseTo(0.1, 6);
  });

  it("連續三輪後，創辦人持股逐輪下降，而且每輪合計 100%", () => {
    const { snapshots } = simulateRounds(founders, [
      { name: "seed", preMoney: 8e6, investment: 2e6, poolTargetPct: 0.1, poolTiming: "pre", liqMultiple: 1, participating: false },
      { name: "seriesA", preMoney: 30e6, investment: 8e6, poolTargetPct: 0.12, poolTiming: "pre", liqMultiple: 1, participating: false },
      { name: "seriesB", preMoney: 90e6, investment: 20e6, poolTargetPct: 0.1, poolTiming: "post", liqMultiple: 1, participating: false },
    ]);
    const f = snapshots.map((s) => s.ownership.founders);
    for (let i = 1; i < f.length; i++) expect(f[i]).toBeLessThan(f[i - 1]);
    for (const s of snapshots) {
      expect(Object.values(s.ownership).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    }
  });
});

describe("waterfall：指南中的手算例子", () => {
  // 200 萬佔 20%，1,500 萬退出
  const table = (multiple: number, participating: boolean): CapTable => [
    { id: "founders", shares: 8_000_000 },
    { id: "seed", shares: 2_000_000, pref: { invested: 2_000_000, multiple, participating, seniority: 1 } },
  ];

  it("2x participating：投資者實得 620 萬（約 41%）", () => {
    const { payouts } = computeWaterfall(table(2, true), 15_000_000);
    expect(payouts.seed).toBeCloseTo(6_200_000, 2);
    expect(payouts.seed / 15_000_000).toBeCloseTo(0.4133, 3);
    expect(payouts.founders).toBeCloseTo(8_800_000, 2);
  });

  it("1x non-participating：投資者選擇轉換，實得 300 萬（20%）", () => {
    const { payouts, converted } = computeWaterfall(table(1, false), 15_000_000);
    expect(converted).toContain("seed");
    expect(payouts.seed).toBeCloseTo(3_000_000, 2);
    expect(payouts.founders).toBeCloseTo(12_000_000, 2);
  });

  it("1x non-participating 低價退出 300 萬：投資者領回 200 萬優先權", () => {
    const { payouts, converted } = computeWaterfall(table(1, false), 3_000_000);
    expect(converted).not.toContain("seed");
    expect(payouts.seed).toBeCloseTo(2_000_000, 2);
    expect(payouts.founders).toBeCloseTo(1_000_000, 2);
  });

  it("兩輪優先股、退出金額不足：較新一輪先收回", () => {
    const t: CapTable = [
      { id: "founders", shares: 6e6 },
      { id: "seed", shares: 2e6, pref: { invested: 2e6, multiple: 1, participating: false, seniority: 1 } },
      { id: "seriesA", shares: 2e6, pref: { invested: 8e6, multiple: 1, participating: false, seniority: 2 } },
    ];
    const { payouts } = computeWaterfall(t, 9e6);
    expect(payouts.seriesA).toBeCloseTo(8e6, 2);
    expect(payouts.seed).toBeCloseTo(1e6, 2);
    expect(payouts.founders).toBeCloseTo(0, 2);
  });

  it("所有人合計等於退出金額", () => {
    for (const exit of [0, 1e6, 5e6, 15e6, 80e6]) {
      const { payouts } = computeWaterfall(table(2, true), exit);
      expect(Object.values(payouts).reduce((a, b) => a + b, 0)).toBeCloseTo(exit, 2);
    }
  });

  it("exitScenarios 給圖表用", () => {
    const rows = exitScenarios(table(2, true), [5e6, 15e6, 50e6]);
    expect(rows).toHaveLength(3);
    expect(rows[1].amount).toBeCloseTo(8_800_000, 2);
  });
});

describe("runway：現金流模擬", () => {
  const base: RunwayState = {
    cash: 600_000, monthlyRevenue: 20_000, headcount: 5, avgSalary: 20_000,
    serverCost: 8_000, marketing: 15_000, otherCost: 5_000, price: 400,
  };

  it("沒有收入：現金 100、每月支出 10 → 第 11 個月破產", () => {
    const r = simulateRunway(
      { cash: 100, monthlyRevenue: 0, headcount: 1, avgSalary: 10, serverCost: 0, marketing: 0, otherCost: 0, price: 1 },
      [], [], 24
    );
    expect(r.bankruptMonth).toBe(11);
    expect(r.outcome).toBe("bankrupt");
  });

  it("同一組輸入必定得出同一結果", () => {
    const ev = [{ month: 4, effects: { serverCostMultiplier: 1.3, devSpeedMultiplier: 0.6, headcountDelta: -1 } }];
    const dec = [{ month: 4, changes: { marketing: 8000 } }];
    expect(simulateRunway(base, ev, dec)).toEqual(simulateRunway(base, ev, dec));
  });

  it("事件令伺服器成本上升 30%，第 4 個月的支出相應增加", () => {
    const calm = simulateRunway(base);
    const hit = simulateRunway(base, [{ month: 4, effects: { serverCostMultiplier: 1.3 } }]);
    expect(hit.rows[3].cost - calm.rows[3].cost).toBeCloseTo(8_000 * 0.3, 6);
  });

  it("削減市場預算：短期現金較多", () => {
    const keep = simulateRunway(base, [], [], 6);
    const cut = simulateRunway(base, [], [{ month: 1, changes: { marketing: 5_000 } }], 6);
    expect(cut.endingCash).toBeGreaterThan(keep.endingCash);
  });

  it("補聘後經過 hiringLagMonths 個月，開發速度才恢復", () => {
    const r = simulateRunway(
      { ...base, cash: 3_000_000 },
      [{ month: 4, effects: { devSpeedMultiplier: 0.6, headcountDelta: -1 } }],
      [{ month: 5, changes: { headcount: 5 } }]
    );
    expect(r.rows[4].devSpeed).toBeCloseTo(0.6); // 第 5 個月：剛補聘
    expect(r.rows[6].devSpeed).toBe(1);           // 第 7 個月：恢復
  });

  it("運營成本計算器（quickRunway）", () => {
    const r = quickRunway(base, 24);
    expect(r.rows.length).toBeGreaterThan(0);
    expect(r.rows[0].cost).toBe(5 * 20_000 + 8_000 + 15_000 + 5_000);
  });
});
