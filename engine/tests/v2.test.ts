import { describe, it, expect } from "vitest";
import { scoreStrengths, rankStrengths, scoreItem } from "../lib/strengths";
import { milestoneProgress, yearProgress, certMilestoneDrafts, reportScore } from "../lib/plan";
import { questionnaires, scenarios } from "../lib/content";
import { UserProfile, PersonalPlan, PolicyCard } from "../lib/types";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { demoUser, demoPlan } from "../data/demo";

const q = questionnaires.ipip_core_strengths_v1;

describe("性格與強項問卷（第 2 版）", () => {
  it("18 題，三個量表各 6 題（3 正向、3 反向）", () => {
    expect(q.items).toHaveLength(18);
    for (const s of ["positivity", "dependability", "mastery"]) {
      const items = q.items.filter((i) => i.scale === s);
      expect(items).toHaveLength(6);
      expect(items.filter((i) => i.keyed === 1)).toHaveLength(3);
      expect(items.filter((i) => i.keyed === -1)).toHaveLength(3);
    }
    expect(new Set(q.items.map((i) => i.id)).size).toBe(18);
  });

  it("反向題轉換：5 → 1、1 → 5、3 → 3", () => {
    const rev = { id: "x", scale: "s", keyed: -1 as const };
    expect(scoreItem(rev, 5)).toBe(1);
    expect(scoreItem(rev, 1)).toBe(5);
    expect(scoreItem(rev, 3)).toBe(3);
    expect(() => scoreItem(rev, 6)).toThrow();
  });

  it("正向題全選 5、反向題全選 1 → 三個量表都是 5 分", () => {
    const answers = Object.fromEntries(q.items.map((i) => [i.id, i.keyed === 1 ? 5 : 1]));
    const r = scoreStrengths(q.items as never, answers);
    expect(r.complete).toBe(true);
    expect(r.scores).toEqual({ positivity: 5, dependability: 5, mastery: 5 });
  });

  it("手算例子：積極 (4,5,3) 正向＋(2,1,3) 反向 → (4+5+3+4+5+3)/6 = 4", () => {
    const pos = q.items.filter((i) => i.scale === "positivity");
    const plus = pos.filter((i) => i.keyed === 1).map((i) => i.id);
    const minus = pos.filter((i) => i.keyed === -1).map((i) => i.id);
    const answers: Record<string, number> = {};
    [4, 5, 3].forEach((v, k) => (answers[plus[k]] = v));
    [2, 1, 3].forEach((v, k) => (answers[minus[k]] = v));
    const r = scoreStrengths(q.items as never, answers);
    expect(r.scores.positivity).toBe(4);
    expect(r.complete).toBe(false);
    expect(r.missing).toHaveLength(12);
  });

  it("排序只顯示相對高低", () => {
    expect(rankStrengths({ positivity: 3.8, dependability: 4.2, mastery: 3.5 })).toEqual(["dependability", "positivity", "mastery"]);
  });
});

describe("我的五年規劃（第 2 版）", () => {
  const rep = (scenarioId: string, createdAt: string, scores: number[]) => ({ scenarioId, createdAt, report: { dimensions: scores.map((score) => ({ score })) } });
  const ctx = (reports: ReturnType<typeof rep>[], certifications = demoUser.certifications) => ({ reports, certifications });

  it("報告分數 = 各維度平均（一位小數）", () => {
    expect(reportScore(rep("x", "2026-06-01T08:00:00Z", [4, 3, 4, 4]))).toBe(3.8);
  });

  it("面試指標：只計同一年、同一個練習；次數和平均分都要達標", () => {
    const m1 = demoPlan.milestones[0];
    const reports = [
      rep("interview_general_v1", "2026-06-01T08:00:00Z", [4, 4, 4, 4]),
      rep("interview_general_v1", "2026-07-01T08:00:00Z", [3, 3, 4, 4]),
      rep("b2b_procurement_v1", "2026-07-01T08:00:00Z", [5, 5, 5, 5]),
      rep("interview_general_v1", "2025-07-01T08:00:00Z", [5, 5, 5, 5]),
    ];
    let p = milestoneProgress(m1, ctx(reports));
    expect(p).toMatchObject({ current: 2, target: 3, avg: 3.8, done: false });
    reports.push(rep("interview_general_v1", "2026-08-01T08:00:00Z", [5, 5, 5, 5]));
    p = milestoneProgress(m1, ctx(reports));
    expect(p).toMatchObject({ current: 3, avg: 4.2, done: true });
  });

  it("證書指標：狀態變成「已取得」才完成；名稱不分大小寫", () => {
    const m2 = demoPlan.milestones[1];
    expect(milestoneProgress(m2, ctx([])).done).toBe(false);
    const earned = demoUser.certifications.map((c) => ({ ...c, status: "earned" as const, name: c.name.toUpperCase() }));
    expect(milestoneProgress(m2, ctx([], earned)).done).toBe(true);
  });

  it("年度完成度與「計劃考取」證書自動成為里程碑草稿", () => {
    expect(yearProgress(demoPlan, 2026, ctx([]))).toEqual({ done: 0, total: 2 });
    const empty = { ...demoPlan, milestones: [] };
    const drafts = certMilestoneDrafts(empty, demoUser.certifications);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({ year: 2027, metric: { type: "cert" } });
    expect(certMilestoneDrafts(demoPlan, demoUser.certifications)).toHaveLength(0); // 已存在，不重複
  });

  it("示範資料符合第 2 版格式；舊資料沒有新欄位也能讀取", () => {
    expect(() => UserProfile.parse(demoUser)).not.toThrow();
    expect(() => PersonalPlan.parse(demoPlan)).not.toThrow();
    const { certifications, strengths, ...old } = demoUser;
    const parsed = UserProfile.parse(old);
    expect(parsed.certifications).toEqual([]);
    expect(parsed.strengths).toBeNull();
    expect(() => UserProfile.parse({ ...demoUser, strengths: { ...demoUser.strengths!, scores: { positivity: 6, dependability: 4, mastery: 3 } } })).toThrow();
    expect(() => UserProfile.parse({ ...demoUser, certifications: [{ name: "X", status: "maybe" }] })).toThrow();
  });
});

describe("政策資料卡和職位卡（site/data，第 2 版）", () => {
  const site = join(__dirname, "..", "..", "site", "data");
  const policy = JSON.parse(readFileSync(join(site, "policy.json"), "utf8"));
  const roles = JSON.parse(readFileSync(join(site, "roles.json"), "utf8")).roles;
  const ids = new Set(policy.cards.map((c: { id: string }) => c.id));

  it("每張政策卡都符合格式，有出處連結和官方全文連結", () => {
    expect(policy.cards.length).toBeGreaterThanOrEqual(10);
    for (const c of policy.cards) expect(() => PolicyCard.parse(c)).not.toThrow();
    expect(ids.size).toBe(policy.cards.length);
    for (const c of policy.cards) expect(policy.areas[c.area]).toBeDefined();
  });

  it("職位卡引用的政策卡都存在；卡片的 roleIds 與職位卡一致", () => {
    const roleIds = new Set(roles.map((r: { id: string }) => r.id));
    for (const r of roles) for (const pid of r.policyIds ?? []) expect(ids.has(pid)).toBe(true);
    for (const c of policy.cards) for (const rid of c.roleIds) expect(roleIds.has(rid)).toBe(true);
  });

  it("示範規劃和劇本引用的政策卡都存在", () => {
    for (const g of demoPlan.goals) for (const pid of g.policyIds) expect(ids.has(pid)).toBe(true);
    for (const s of Object.values(scenarios)) {
      for (const step of s.steps) {
        const pid = (step as { policyId?: string }).policyId;
        if (pid) expect(ids.has(pid)).toBe(true);
      }
    }
  });
});
