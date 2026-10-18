import { describe, it, expect } from "vitest";
import { scenarios, rubrics, getRubric, getScenario } from "../lib/content";
import { drawEvents, newSession, recordStep, runBlackSwan } from "../lib/engine/engine";
import { demoStartup } from "../data/demo";

describe("劇本和評分準則（J2 每次改動都會自動檢查）", () => {
  it("全部 JSON 通過格式驗證，而且每個劇本都有對應的 rubric", () => {
    expect(Object.keys(scenarios).length).toBeGreaterThan(0);
    for (const s of Object.values(scenarios)) expect(rubrics[s.rubric]).toBeDefined();
  });

  it("電郵分支指向的步驟都存在", () => {
    for (const s of Object.values(scenarios)) {
      const ids = new Set(s.steps.map((x) => x.id));
      for (const step of s.steps) {
        if (step.type === "email" && step.branches) {
          expect(ids.has(step.branches.ifPass)).toBe(true);
          expect(ids.has(step.branches.ifFail)).toBe(true);
        }
      }
    }
  });

  it("面試題庫：每類題目都有後備題", () => {
    const q = getScenario("interview_general_v1").steps.filter((s) => s.type === "question");
    for (const cat of ["cv", "behavioral", "situational", "industry"]) {
      expect(q.some((s) => s.type === "question" && s.category === cat)).toBe(true);
    }
  });

  it("每個 rubric 維度的 5 個級別都有描述", () => {
    for (const r of Object.values(rubrics)) {
      for (const d of r.dimensions) {
        for (const lvl of ["1", "2", "3", "4", "5"] as const) expect(d.levels[lvl].length).toBeGreaterThan(4);
      }
    }
  });
});

describe("練習引擎", () => {
  const scenario = getScenario("black_swan_saas_v1");

  it("同一個 seed 必定抽到同一組事件，並放在第 3、6、9 個月", () => {
    const a = drawEvents(scenario, 3, [3, 6, 9], 42);
    const b = drawEvents(scenario, 3, [3, 6, 9], 42);
    expect(a.map((e) => e.id)).toEqual(b.map((e) => e.id));
    expect(a.map((e) => e.month)).toEqual([3, 6, 9]);
  });

  it("示範公司：不作任何調整 vs 在事件中削減開支，後者現金較多", () => {
    const drawn = drawEvents(scenario, 3, [3, 6, 9], 42);
    const passive = runBlackSwan(demoStartup, drawn, newSession(scenario));
    let log = newSession(scenario);
    log = recordStep(log, { stepId: drawn[0].id, inputs: { marketing: 6000 }, text: "先減市場預算保住現金" });
    const active = runBlackSwan(demoStartup, drawn, log);
    expect(active.endingCash).toBeGreaterThan(passive.endingCash);
  });

  it("recordStep 重複提交同一步時會取代舊紀錄", () => {
    let log = newSession(scenario);
    log = recordStep(log, { stepId: "x", inputs: { marketing: 1 } });
    log = recordStep(log, { stepId: "x", inputs: { marketing: 2 } });
    expect(log.steps).toHaveLength(1);
    expect(log.steps[0].inputs.marketing).toBe(2);
  });
});
