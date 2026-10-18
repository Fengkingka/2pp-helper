/** 「載入示範資料」按鈕使用的虛構資料（demo 和評判試用時用）。第 2 版加入問卷結果、證書和一份示範五年規劃。 */
import type { PersonalPlan, StartupProfile, UserProfile } from "../lib/types";

export const demoUser: UserProfile = {
  careerStage: "fresh_grad",
  education: [{ school: "示範大學", major: "市場學", gradYear: 2026 }],
  interests: ["品牌", "數據分析"],
  skills: ["Excel", "Canva", "Python 基礎"],
  experiences: [
    {
      title: "市場部實習生",
      org: "示範零售集團",
      bullets: ["協助整理社交媒體數據，每週製作報告", "參與一次新產品推廣活動"],
    },
  ],
  targetRoles: ["Marketing Analyst"],
  tags: ["marketing", "data"],
  certifications: [
    { name: "Google Analytics Certification", issuer: "Google Skillshop", qfLevel: null, status: "in_progress", year: 2026 },
    { name: "Microsoft Certified: Power BI Data Analyst Associate (PL-300)", issuer: "Microsoft", qfLevel: null, status: "planned", year: 2027 },
  ],
  strengths: {
    instrument: "IPIP-VIA-R 核心強項短版（18 題）",
    version: "0.1",
    takenAt: "2026-10-05",
    scores: { positivity: 3.83, dependability: 4.17, mastery: 3.5 },
    shareWithAI: true,
  },
};

export const demoPlan: PersonalPlan = {
  version: 1,
  horizon: [2026, 2030],
  vision: "2030 年在數據分析團隊負責一條產品線的報告，並帶領一位新同事。",
  pathId: "marketing_analyst",
  goals: [
    { id: "g1", text: "取得第一份市場數據分析工作", policyIds: ["youth_30k_jobs"] },
    { id: "g2", text: "掌握 SQL 和數據視覺化，並考取相關證書", policyIds: ["ai_upskilling"] },
    { id: "g3", text: "發揮「可靠」強項，成為團隊信任的報告負責人", policyIds: [] },
  ],
  milestones: [
    { id: "m1", year: 2026, goalId: "g1", text: "完成 3 次模擬面試，平均 4 分以上", metric: { type: "reports", scenarioId: "interview_general_v1", count: 3, minAvg: 4 }, done: false },
    { id: "m2", year: 2026, goalId: "g2", text: "考取 Google Analytics Certification", metric: { type: "cert", certName: "Google Analytics Certification" }, done: false },
    { id: "m3", year: 2027, goalId: "g1", text: "取得 Marketing Analyst 職位", metric: { type: "manual" }, done: false },
    { id: "m4", year: 2027, goalId: "g2", text: "考取 Microsoft Certified: Power BI Data Analyst Associate (PL-300)", metric: { type: "cert", certName: "Microsoft Certified: Power BI Data Analyst Associate (PL-300)" }, done: false },
    { id: "m5", year: 2028, goalId: "g3", text: "獨立負責一條產品線的每月報告", metric: { type: "manual" }, done: false },
    { id: "m6", year: 2029, goalId: "g2", text: "完成一個用 AI 工具改善報告流程的項目", metric: { type: "manual" }, done: false },
    { id: "m7", year: 2030, goalId: "g3", text: "帶領一位新同事完成第一份報告", metric: { type: "manual" }, done: false },
  ],
  reviews: [],
};

export const demoStartup: StartupProfile = {
  name: "LedgerLite",
  industry: "B2B SaaS",
  stage: "pre_seed",
  cash: 1_200_000,
  monthlyRevenue: 20_000,
  headcount: 5,
  avgSalary: 18_000,
  serverCost: 8_000,
  marketing: 15_000,
  otherCost: 5_000,
  price: 400,
  founderShares: 10_000_000,
};
