/**
 * 我的五年規劃（第 2 版）：里程碑進度由程式計算，AI 不會替用戶計算或填寫指標。
 *  - reports：從「我的報告」計算該年內某個練習的次數和平均分
 *  - cert：專業資格的狀態變成「已取得」即完成
 *  - manual：用戶自行勾選
 */
import type { Certification, PersonalPlan, PlanMetric } from "./types";

export interface ReportLike {
  scenarioId: string;
  createdAt: string; // ISO 日期時間
  report: { dimensions: { score: number }[]; metrics?: Record<string, number> };
}

export interface MilestoneProgress {
  type: PlanMetric["type"];
  done: boolean;
  current: number; // reports：已完成次數；cert/manual：0 或 1
  target: number; // reports：目標次數；cert/manual：1
  avg: number | null; // reports：平均分（一位小數），沒有報告時為 null
}

/** 一份報告的分數 = 各維度分數的平均（一位小數），與報告頁顯示的分數一致。 */
export function reportScore(r: ReportLike): number | null {
  const metrics = r.report.metrics;
  if (r.scenarioId === "hostile_vc_v1" && metrics?.vcScoringVersion === 1) {
    return metrics.coreRated > 0 && Number.isFinite(metrics.coreAverage) ? metrics.coreAverage : null;
  }
  if (r.scenarioId === "interview_general_v1" && metrics?.rubricVersion === 2) {
    return metrics.coreRated > 0 && Number.isFinite(metrics.coreAverage) ? metrics.coreAverage : null;
  }
  const dims = r.report.dimensions;
  if (!dims.length) return 0;
  return Math.round((dims.reduce((s, d) => s + d.score, 0) / dims.length) * 10) / 10;
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function milestoneProgress(
  m: PersonalPlan["milestones"][number],
  ctx: { reports: ReportLike[]; certifications: Certification[] }
): MilestoneProgress {
  const metric = m.metric;
  if (metric.type === "reports") {
    const hits = ctx.reports.filter((r) => r.scenarioId === metric.scenarioId && new Date(r.createdAt).getFullYear() === m.year && reportScore(r) !== null);
    const avg = hits.length ? Math.round((hits.reduce((s, r) => s + (reportScore(r) ?? 0), 0) / hits.length) * 10) / 10 : null;
    const enough = hits.length >= metric.count;
    const goodEnough = metric.minAvg === undefined || (avg !== null && avg >= metric.minAvg);
    return { type: "reports", done: enough && goodEnough, current: hits.length, target: metric.count, avg };
  }
  if (metric.type === "cert") {
    const earned = ctx.certifications.some((c) => sameName(c.name, metric.certName) && c.status === "earned");
    return { type: "cert", done: earned, current: earned ? 1 : 0, target: 1, avg: null };
  }
  return { type: "manual", done: m.done, current: m.done ? 1 : 0, target: 1, avg: null };
}

/** 某一年的完成度：已完成的里程碑數目／該年的里程碑總數。 */
export function yearProgress(plan: PersonalPlan, year: number, ctx: { reports: ReportLike[]; certifications: Certification[] }) {
  const ms = plan.milestones.filter((m) => m.year === year);
  const done = ms.filter((m) => milestoneProgress(m, ctx).done).length;
  return { done, total: ms.length };
}

/**
 * 「計劃考取」的專業資格自動變成里程碑草稿（已存在的不會重複加入）。
 * 年份：證書有填年份就用該年，否則用規劃的第二年。
 */
export function certMilestoneDrafts(plan: PersonalPlan, certs: Certification[]): PersonalPlan["milestones"] {
  const existing = new Set(plan.milestones.filter((m) => m.metric.type === "cert").map((m) => (m.metric as { certName: string }).certName.trim().toLowerCase()));
  const [from, to] = plan.horizon;
  return certs
    .filter((c) => c.status === "planned" && !existing.has(c.name.trim().toLowerCase()))
    .map((c, i) => ({
      id: "cert" + (plan.milestones.length + i + 1),
      year: Math.min(to, Math.max(from, c.year ?? from + 1)),
      goalId: null,
      text: "考取 " + c.name,
      metric: { type: "cert" as const, certName: c.name },
      done: false,
    }));
}
