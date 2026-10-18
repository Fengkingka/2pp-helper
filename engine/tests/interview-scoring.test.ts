import { describe, expect, it } from "vitest";
import { getRubric } from "../lib/content";
import { milestoneProgress, reportScore, type ReportLike } from "../lib/plan";

const entry = (metrics?: Record<string, number>): ReportLike => ({ scenarioId: "interview_general_v1", createdAt: "2026-10-08", report: { dimensions: [{ score: 4 }, { score: 1 }, { score: 5 }], metrics } } as ReportLike);
describe("Dual-track interview scoring", () => {
  for (const track of ["graduate", "experienced"]) {
    it(`${track} has five equal core dimensions and all five anchors`, () => {
      const rubric = getRubric(`interview_${track}_v2`);
      expect(rubric.dimensions.filter(d => !d.requiresMetric).map(d => d.key)).toEqual(["relevance", "ownership", "judgement", "outcomes", "clarity"]);
      for (const d of rubric.dimensions) expect(Object.keys(d.levels)).toEqual(["1", "2", "3", "4", "5"]);
      expect(rubric.dimensions.find(d => d.key === "industry")?.requiresMetric).toBe("industryQuestions");
    });
  }
  it("uses server-calculated v2 core mean rather than industry or placeholders", () => {
    expect(reportScore(entry({ rubricVersion: 2, coreRated: 1, coreAverage: 4 }))).toBe(4);
  });
  it("has no numerical average for zero assessed core dimensions", () => {
    expect(reportScore(entry({ rubricVersion: 2, coreRated: 0 }))).toBeNull();
  });
  it("keeps legacy dimension averaging", () => { expect(reportScore(entry())).toBe(3.3); });
  it("excludes unscored v2 from scored milestones", () => {
    const m: any = { year: 2026, metric: { type: "reports", scenarioId: "interview_general_v1", count: 1 } };
    expect(milestoneProgress(m, { reports: [entry({ rubricVersion: 2, coreRated: 0 })], certifications: [] })).toMatchObject({ current: 0, avg: null, done: false });
  });
});
