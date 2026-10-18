/**
 * 第 2 版：創業者路線（Black Swan 15 張事件卡、Term Sheet 6 輪和政府引導基金、B2B 4 輪）。
 * 計算器的例子全部可以手算核對；劇本的檢查確保頁面可以完成練習，而且每句新文案都有英文。
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applyRound, ownership, totalShares, type CapTable, type RoundTerms } from "../lib/calc/captable";
import { computeWaterfall } from "../lib/calc/waterfall";
import { weightedAveragePrice, adjustedConversionPrice, applyRoundWithAntiDilution, ANTI_DILUTION_KINDS } from "../lib/calc/antidilution";
import { proRataAmount, applyRoundWithProRata } from "../lib/calc/prorata";
import { getScenario, getRubric } from "../lib/content";
import { drawEvents, newSession, recordStep, runBlackSwan } from "../lib/engine/engine";
import { demoStartup } from "../data/demo";
import { toHK } from "../hk";
import type { Scenario, Step } from "../lib/types";

type EventStep = Extract<Step, { type: "event" }>;
type ProposalStep = Extract<Step, { type: "proposal" }>;
type EmailStep = Extract<Step, { type: "email" }>;

// 創辦人 800 萬股；種子輪 200 萬股，以每股 HK$1 投資 200 萬
const seeded = (): CapTable => [
  { id: "founders", shares: 8_000_000 },
  { id: "seed", shares: 2_000_000, pref: { invested: 2_000_000, multiple: 1, participating: false, seniority: 1 } },
];
const round = (preMoney: number, investment: number, poolTargetPct = 0): RoundTerms => ({
  name: "seriesA", preMoney, investment, poolTargetPct, poolTiming: "pre", liqMultiple: 1, participating: false,
});

describe("反攤薄計算器（antidilution.ts）：手算例子", () => {
  // A 輪：投前 500 萬、投資 500 萬 → 每股 HK$0.5（低於種子輪的 HK$1），發行 1,000 萬股
  it("broad-based weighted average：CP2 = 1 × (1,000 萬 + 500 萬) ÷ (1,000 萬 + 1,000 萬) = 0.75", () => {
    expect(weightedAveragePrice(1, 10_000_000, 5_000_000, 0.5)).toBeCloseTo(0.75, 12);
    expect(adjustedConversionPrice("broad_based", 1, 0.5, 10_000_000, 5_000_000)).toBeCloseTo(0.75, 12);
    expect(adjustedConversionPrice("full_ratchet", 1, 0.5, 10_000_000, 5_000_000)).toBe(0.5);
    expect(adjustedConversionPrice("none", 1, 0.5, 10_000_000, 5_000_000)).toBe(1);
  });

  it("不設反攤薄：種子 200 萬股，合共 2,000 萬股 → 創辦人 40%、種子 10%、A 輪 50%", () => {
    const r = applyRoundWithAntiDilution(seeded(), round(5e6, 5e6), "seed", "none");
    expect(r.isDownRound).toBe(true);
    expect(r.pricePerShare).toBeCloseTo(0.5, 12);
    expect(r.extraShares).toBe(0);
    const o = ownership(r.table);
    expect(o.founders).toBeCloseTo(0.4, 9);
    expect(o.seed).toBeCloseTo(0.1, 9);
    expect(o.seriesA).toBeCloseTo(0.5, 9);
  });

  it("full ratchet：換股價降到 0.5 → 種子 400 萬股，合共 2,200 萬股 → 創辦人 8/22 ≈ 36.36%", () => {
    const r = applyRoundWithAntiDilution(seeded(), round(5e6, 5e6), "seed", "full_ratchet");
    expect(r.adjustedPrice).toBe(0.5);
    expect(r.extraShares).toBeCloseTo(2_000_000, 6);
    expect(totalShares(r.table)).toBeCloseTo(22_000_000, 6);
    const o = ownership(r.table);
    expect(o.founders).toBeCloseTo(8 / 22, 9);
    expect(o.seed).toBeCloseTo(4 / 22, 9);
  });

  it("broad-based：換股價 0.75 → 種子 266.67 萬股，合共 2,066.67 萬股 → 創辦人約 38.71%", () => {
    const r = applyRoundWithAntiDilution(seeded(), round(5e6, 5e6), "seed", "broad_based");
    expect(r.adjustedPrice).toBeCloseTo(0.75, 12);
    expect(r.extraShares).toBeCloseTo(2_000_000 / 0.75 - 2_000_000, 4);
    const o = ownership(r.table);
    expect(o.founders).toBeCloseTo(8 / (20 + 2 / 3), 9);
    expect(o.founders).toBeCloseTo(0.3871, 4);
  });

  it("價格上升（投前 2,000 萬 → 每股 HK$2）：三種條款都不調整", () => {
    for (const kind of ANTI_DILUTION_KINDS) {
      const r = applyRoundWithAntiDilution(seeded(), round(20e6, 5e6), "seed", kind);
      expect(r.isDownRound).toBe(false);
      expect(r.adjustedPrice).toBe(1);
      expect(r.extraShares).toBe(0);
    }
  });

  it("找不到受保障的股東時報錯", () => {
    expect(() => applyRoundWithAntiDilution(seeded(), round(5e6, 5e6), "nobody", "full_ratchet")).toThrow();
    expect(() => weightedAveragePrice(0, 1, 1, 1)).toThrow();
  });
});

describe("跟投權計算器（prorata.ts）：手算例子", () => {
  // A 輪：投前 4,000 萬、投資 1,000 萬 → 每股 HK$4，發行 250 萬股；種子投資者 A 輪前持股 20%
  it("standard pro-rata：種子認購 20% × 1,000 萬 = 200 萬（50 萬股），持股維持 20%", () => {
    expect(proRataAmount(seeded(), "seed", 10e6, 1)).toBeCloseTo(2e6, 6);
    const r = applyRoundWithProRata(seeded(), round(40e6, 10e6), "seed", 1, "seedFollow");
    expect(r.proRataAmount).toBeCloseTo(2e6, 6);
    expect(r.proRataShares).toBeCloseTo(500_000, 6);
    expect(r.leadInvestment).toBeCloseTo(8e6, 6);
    expect(r.leadShares).toBeCloseTo(2_000_000, 6);
    const o = ownership(r.table);
    expect(o.seed + o.seedFollow).toBeCloseTo(0.2, 9);
    expect(o.seriesA).toBeCloseTo(0.16, 9);
    expect(o.founders).toBeCloseTo(0.64, 9);
  });

  it("super pro-rata（兩倍）：認購 400 萬，種子持股 24%；創辦人仍然 64%", () => {
    const r = applyRoundWithProRata(seeded(), round(40e6, 10e6), "seed", 2, "seedFollow");
    const o = ownership(r.table);
    expect(r.leadInvestment).toBeCloseTo(6e6, 6);
    expect(o.seed + o.seedFollow).toBeCloseTo(0.24, 9);
    expect(o.founders).toBeCloseTo(0.64, 9);
  });

  it("不設跟投權：與普通一輪融資完全相同（種子 16%、A 輪 20%）", () => {
    const r = applyRoundWithProRata(seeded(), round(40e6, 10e6), "seed", 0);
    expect(r.table).toEqual(applyRound(seeded(), round(40e6, 10e6)).table);
    expect(ownership(r.table).seed).toBeCloseTo(0.16, 9);
  });

  it("認購金額不會超過整輪金額；跟投部分沿用新一輪的條款，退出分配合計等於退出金額", () => {
    expect(proRataAmount(seeded(), "seed", 10e6, 10)).toBe(10e6);
    const r = applyRoundWithProRata(seeded(), round(40e6, 10e6), "seed", 1, "seedFollow");
    const follow = r.table.find((h) => h.id === "seedFollow")!;
    const lead = r.table.find((h) => h.id === "seriesA")!;
    expect(follow.pref).toMatchObject({ invested: 2e6, multiple: 1, seniority: lead.pref!.seniority });
    for (const exit of [0, 5e6, 30e6, 120e6]) {
      const { payouts } = computeWaterfall(r.table, exit);
      expect(Object.values(payouts).reduce((a, b) => a + b, 0)).toBeCloseTo(exit, 2);
    }
  });
});

describe("Term Sheet 頁面的下跌輪壓力測試（與 term-sheet.js 相同的假設）", () => {
  const founders: CapTable = [{ id: "founders", shares: 10_000_000 }];
  const seedRound: RoundTerms = { name: "種子輪", preMoney: 6e6, investment: 2e6, poolTargetPct: 0.15, poolTiming: "pre", liqMultiple: 2, participating: true };
  const down: RoundTerms = { name: "A 輪", preMoney: 5e6, investment: 5e6, poolTargetPct: 0.1, poolTiming: "pre", liqMultiple: 1, participating: false };

  it("種子輪每股 HK$0.48；A 輪價格較低；創辦人持股：不設 > broad-based > full ratchet", () => {
    const s = applyRound(founders, seedRound);
    expect(s.pricePerShare).toBeCloseTo(0.48, 9);
    const pct = Object.fromEntries(ANTI_DILUTION_KINDS.map((k) => {
      const r = applyRoundWithAntiDilution(s.table, down, "種子輪", k);
      expect(r.isDownRound).toBe(true);
      return [k, ownership(r.table).founders];
    }));
    expect(pct.none).toBeGreaterThan(pct.broad_based);
    expect(pct.broad_based).toBeGreaterThan(pct.full_ratchet);
  });

  it("指南的手算例子仍然成立：200 萬佔 20%、1,500 萬退出、2x participating → 投資者 620 萬（約 41%）", () => {
    const t: CapTable = [
      { id: "founders", shares: 8_000_000 },
      { id: "seed", shares: 2_000_000, pref: { invested: 2_000_000, multiple: 2, participating: true, seniority: 1 } },
    ];
    const { payouts } = computeWaterfall(t, 15_000_000);
    expect(payouts.seed).toBeCloseTo(6_200_000, 2);
    expect(payouts.seed / 15_000_000).toBeCloseTo(0.4133, 3);
  });
});

/* ---------------------------------------------------------------- 劇本 */

const ALLOWED_INPUTS = new Set(["headcount", "marketing", "price", "serverCost", "otherCost", "avgSalary", "bridgeRound", "reasoning"]);
const ALLOWED_EFFECTS = new Set(["serverCostMultiplier", "devSpeedMultiplier", "churnDelta", "revenueMultiplier", "cashDelta", "headcountDelta"]);
const POLICY_IDS = new Set(["nm_university_town", "ai_upskilling", "innotech_youth_internships", "innotech_rnd_target", "youth_30k_jobs"]);

describe("Black Swan：15 張事件卡", () => {
  const s = getScenario("black_swan_saas_v1");
  const events = s.steps.filter((x): x is EventStep => x.type === "event");

  it("15 張卡，id 不重複；只用現有的效果和輸入欄位；理由最多 200 字", () => {
    expect(events).toHaveLength(15);
    expect(new Set(events.map((e) => e.id)).size).toBe(15);
    for (const e of events) {
      expect(Object.keys(e.card.effects).length).toBeGreaterThan(0);
      for (const k of Object.keys(e.card.effects)) expect(ALLOWED_EFFECTS.has(k)).toBe(true);
      expect(e.inputs.length).toBeGreaterThan(1);
      for (const i of e.inputs) {
        expect(ALLOWED_INPUTS.has(i.key)).toBe(true);
        if (i.kind === "text") expect(i.maxChars).toBeLessThanOrEqual(200);
        if (i.kind === "choice") expect(i.options!.length).toBeGreaterThan(1);
        if (i.kind === "slider" || i.kind === "number") expect(i.min).toBeLessThan(i.max!);
      }
      expect(e.inputs.some((i) => i.key === "reasoning")).toBe(true);
    }
  });

  it("2 至 3 張政策事件卡：policyId 指向指定的政策卡，卡面註明「虛構情景」", () => {
    const policy = events.filter((e) => e.policyId);
    expect(policy.length).toBeGreaterThanOrEqual(2);
    expect(policy.length).toBeLessThanOrEqual(3);
    for (const e of policy) {
      expect(POLICY_IDS.has(e.policyId!)).toBe(true);
      expect(e.card.body.startsWith("（虛構情景）")).toBe(true);
    }
    for (const e of events.filter((x) => !x.policyId)) expect(e.card.body).not.toContain("虛構情景");
  });

  it("預設 seed（demo 用）抽到固定的三張卡：保安認證 → 大學城查詢（政策卡）→ 免費 AI 功能", () => {
    const drawn = drawEvents(s, 3, [3, 6, 9], s.seed);
    expect(drawn.map((e) => e.id)).toEqual(["privacy_rule_change", "nm_partner_enquiries", "big_tech_free_feature"]);
    expect(drawn.map((e) => e.month)).toEqual([3, 6, 9]);
  });

  it("demo 劇情：示範公司不作調整會在第 12 個月現金耗盡；第 3 個月把市場預算減到 1 萬就可以撐過 12 個月", () => {
    const drawn = drawEvents(s, 3, [3, 6, 9], s.seed);
    const passive = runBlackSwan(demoStartup, drawn, newSession(s));
    expect(passive.bankruptMonth).toBe(12);
    const log = recordStep(newSession(s), { stepId: drawn[0].id, inputs: { marketing: 10_000 } });
    expect(runBlackSwan(demoStartup, drawn, log).outcome).toBe("survived");
  });

  it("任何 seed 都抽到 3 張不同的卡", () => {
    for (let seed = 1; seed <= 500; seed++) {
      const ids = drawEvents(s, 3, [3, 6, 9], seed).map((e) => e.id);
      expect(new Set(ids).size).toBe(3);
    }
  });
});

describe("Term Sheet：天使／種子投資者和政府引導基金（虛構示範）各 6 輪", () => {
  const angel = getScenario("term_sheet_seed_v1");
  const fund = getScenario("term_sheet_guidance_fund_v1");
  const rounds = (s: Scenario) => s.steps.filter((x): x is ProposalStep => x.type === "proposal");
  const terms = (s: Scenario) => rounds(s).flatMap((r) => r.terms);
  const ECONOMIC = new Set(["preMoney", "pool", "liqPref", "antiDilution", "proRata"]);

  it("兩個劇本都有 6 輪、共用 term_sheet_v1 評分準則，並有投資者類型", () => {
    for (const s of [angel, fund]) {
      expect(rounds(s)).toHaveLength(6);
      expect(s.rubric).toBe("term_sheet_v1");
      expect(getRubric(s.rubric).dimensions.length).toBeGreaterThan(0);
      expect(s.investor?.label).toBeTruthy();
      expect(s.investor?.investment).toBe(2_000_000);
      expect(new Set(rounds(s).map((r) => r.id)).size).toBe(6);
    }
    expect(angel.investor!.label).toBe("天使／種子投資者");
    expect(fund.investor!.label).toBe("政府引導基金（虛構示範）");
    expect(fund.investor!.disclaimer).toBe("條款為示範用的虛構內容，並非任何真實基金的條款。");
  });

  it("保留原本兩輪（term-sheet.js 的 parse() 依賴這些 key），並加入反攤薄和跟投權", () => {
    expect(rounds(angel).slice(0, 2).map((r) => r.id)).toEqual(["valuation_and_pool", "preference_and_board"]);
    for (const s of [angel, fund]) {
      const keys = terms(s).map((t) => t.key);
      for (const k of ["preMoney", "pool", "liqPref", "boardSeats", "antiDilution", "proRata"]) expect(keys).toContain(k);
      expect(new Set(keys).size).toBe(keys.length);
    }
    expect(terms(angel).map((t) => t.key)).toEqual(expect.arrayContaining(["founderVesting", "protectiveProvisions"]));
    expect(terms(fund).map((t) => t.key)).toEqual(expect.arrayContaining(["coInvestment", "reporting", "hkPresence"]));
  });

  it("經濟條款的值可以交給計算器；每個條款最少有一個不會令投資者退出的選項", () => {
    for (const t of terms(angel).concat(terms(fund))) {
      expect(t.options.some((o) => o.outcome !== "investor_walks")).toBe(true);
      for (const o of t.options) {
        const v = String(o.value);
        if (t.key === "preMoney") expect(typeof o.value).toBe("number");
        if (t.key === "pool") expect(v).toMatch(/^((pre|post)_[\d.]+|none)$/);
        if (t.key === "liqPref") expect(v).toMatch(/^(\d+(\.\d+)?x_(participating|non_participating)|none)$/);
        if (t.key === "antiDilution") expect(["none", "broad_based", "full_ratchet"]).toContain(v);
        if (t.key === "proRata") expect(v).toMatch(/^(none|standard|super_\d+x)$/);
        if (t.key === "boardSeats") expect(typeof o.value).toBe("number");
      }
    }
  });

  it("非經濟條款的每個選項都有一句「影響：」說明（不用數字估算）", () => {
    for (const t of terms(angel).concat(terms(fund))) {
      if (ECONOMIC.has(t.key)) continue;
      for (const o of t.options) {
        expect(o.explain, `${t.key} → ${o.label}`).toMatch(/^影響：/);
      }
    }
  });

  it("政府引導基金的內容註明是虛構示範", () => {
    expect(fund.title).toContain("虛構示範");
    expect(rounds(fund)[0].investorLine).toContain("虛構示範");
  });
});

describe("B2B 電郵：4 輪", () => {
  const s = getScenario("b2b_procurement_v1");
  const emails = s.steps.filter((x): x is EmailStep => x.type === "email");
  const byId = Object.fromEntries(emails.map((e) => [e.id, e]));
  // 與 b2b.js 相同：只作為分支版本出現的電郵不放在主線
  const alternatives = new Set(emails.flatMap((e) => (e.branches ? [e.branches.ifPass, e.branches.ifFail].filter((id) => id !== e.id) : [])));
  const main = emails.filter((e) => !alternatives.has(e.id));

  it("主線 4 輪：預算凍結 → 資料合規 → 免費試用 → 減價要求", () => {
    expect(main.map((e) => e.id)).toEqual(["budget_freeze", "data_compliance", "free_trial", "price_pressure"]);
  });

  it("每個分支都指向存在的電郵；分支版本與主線同一主題，並保留「……後」的時間跳躍", () => {
    for (const e of main.slice(1)) {
      expect(e.branches).toBeDefined();
      expect(e.timeSkip).toMatch(/後……$/);
      for (const id of [e.branches!.ifPass, e.branches!.ifFail]) {
        expect(byId[id]).toBeDefined();
        expect(byId[id].subject).toBe(e.subject);
        expect(byId[id].timeSkip).toBe(e.timeSkip);
      }
    }
    expect(alternatives).toEqual(new Set(["data_compliance_skeptical", "free_trial_cautious", "price_pressure_competitor"]));
  });
});

/* ---------------------------------------------------------------- 文案 */

const SITE = join(__dirname, "..", "..", "site", "assets", "js");
function i18nKeys(file: string): Set<string> {
  const src = readFileSync(join(SITE, file), "utf8");
  const keys = new Set<string>();
  for (const m of src.matchAll(/"((?:[^"\\\n]|\\.)*)"\s*:\s*"/g)) keys.add(JSON.parse(`"${m[1]}"`));
  return keys;
}

function visibleStrings(s: Scenario): string[] {
  const out: string[] = [];
  if (s.investor) out.push(s.investor.label, ...(s.investor.disclaimer ? [s.investor.disclaimer] : []));
  for (const step of s.steps) {
    if (step.type === "event") {
      out.push(step.card.title, step.card.body);
      for (const i of step.inputs) out.push(i.label, ...(i.options ?? []).map((o) => o.label));
    } else if (step.type === "proposal") {
      out.push(step.investorLine);
      for (const t of step.terms) out.push(t.label, ...t.options.flatMap((o) => [o.label, ...(o.explain ? [o.explain] : [])]));
    } else if (step.type === "email") {
      out.push(step.from, step.subject, step.body, ...(step.timeSkip ? [step.timeSkip] : []));
      for (const i of step.inputs) out.push(i.label);
    }
  }
  return out;
}

describe("文案：繁體中文，而且每句都有英文翻譯", () => {
  const ids = ["black_swan_saas_v1", "term_sheet_seed_v1", "term_sheet_guidance_fund_v1", "b2b_procurement_v1"];
  const keys = new Set([...i18nKeys("i18n.js"), ...i18nKeys("i18n-v2-startup.js")]);

  it("沒有簡體字", () => {
    for (const id of ids) for (const t of [getScenario(id).title, ...visibleStrings(getScenario(id))]) expect(toHK(t)).toBe(t);
  });

  it("劇本中所有用戶看得到的文字，在 i18n.js 或 i18n-v2-startup.js 都有英文", () => {
    const missing = ids.flatMap((id) => visibleStrings(getScenario(id))).filter((t) => /\p{Script=Han}/u.test(t) && !keys.has(t));
    expect([...new Set(missing)]).toEqual([]);
  });

  it("i18n-v2-startup.js 沒有重複 i18n.js 已有的翻譯", () => {
    const base = i18nKeys("i18n.js");
    expect([...i18nKeys("i18n-v2-startup.js")].filter((k) => base.has(k))).toEqual([]);
  });
});
