/**
 * 共用資料格式（第 1 週五凍結）。
 * 瀏覽器（engine.js）和 PHP（site/lib/Validator.php）都按這份定義檢查資料。
 * 擁有者：UserProfile → K；StartupProfile / Scenario / SessionLog / EvaluationReport → V；
 * Rubric 內容 → J2。改動任何 schema 前先在站會提出。
 */
import { z } from "zod";
import { validateFinancial, type FinancialInput } from "./calc/financial";

/* ---------- UserProfile（K）：刻意沒有性別欄位 ---------- */
/** 第 2 版：專業資格。由用戶自行申報，不上載證書文件。qfLevel 指香港資歷架構級別（1–7，可留空）。 */
export const Certification = z.object({
  name: z.string().min(1).max(120),
  issuer: z.string().max(120).default(""),
  qfLevel: z.number().int().min(1).max(7).nullable().default(null),
  status: z.enum(["earned", "in_progress", "planned"]),
  year: z.number().int().min(1950).max(new Date().getFullYear() + 15).nullable().default(null),
});
export type Certification = z.infer<typeof Certification>;

/** 第 2 版：性格與強項問卷結果。只作反思，不用作篩選或排序；預設不送給 AI。 */
export const StrengthsResult = z.object({
  instrument: z.string(),
  version: z.string(),
  takenAt: z.string(), // YYYY-MM-DD
  scores: z.object({
    positivity: z.number().min(1).max(5),
    dependability: z.number().min(1).max(5),
    mastery: z.number().min(1).max(5),
  }),
  shareWithAI: z.boolean().default(false),
});
export type StrengthsResult = z.infer<typeof StrengthsResult>;

export const UserProfile = z.object({
  version: z.number().optional(),
  goal: z.enum(["explore", "internship", "graduate_job", "interview", "startup"]).optional(),
  preferences: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  skillDetails: z.array(z.object({name:z.string(),id:z.string(),level:z.enum(["learning","project","work"])})).optional(),
  careerStage: z.enum(["student", "graduating", "fresh_grad", "career_switch"]),
  education: z.array(
    z.object({ school: z.string(), major: z.string(), gradYear: z.number().int().nullable(), degree: z.string().optional(), degreeLevel: z.string().optional(), educationStatus: z.enum(["", "completed", "in_progress", "planned"]).optional() })
  ),
  interests: z.array(z.string()),
  skills: z.array(z.string()),
  experiences: z.array(
    z.object({ title: z.string(), org: z.string(), period: z.string().optional(), type: z.string().optional(), bullets: z.array(z.string()) })
  ),
  targetRoles: z.array(z.string()),
  tags: z.array(z.string()), // 對應 data/roles.json 和 opportunities.json 的標籤
  // 第 2 版新增；舊資料沒有這兩個欄位時當作空陣列和 null，不會報錯
  certifications: z.array(Certification).default([]),
  strengths: StrengthsResult.nullable().default(null),
});
export type UserProfile = z.infer<typeof UserProfile>;

/* ---------- PolicyCard（K，第 2 版）：政策資料卡，存在 site/data/policy.json ---------- */
export const PolicyArea = z.enum([
  "finance", "trade", "shipping", "aviation", "innotech", "talent", "youth", "northern_metropolis", "gba", "planning",
]);
export const PolicyCard = z.object({
  id: z.string().regex(/^[a-z0-9_]{1,64}$/),
  title: z.string(),
  titleEn: z.string(),
  area: PolicyArea,
  summary: z.string(), // 用自己的話寫，不可整段抄原文，不評價政策
  summaryEn: z.string(),
  source: z.object({
    doc: z.string(), // 政策文件名稱，頁面顯示「根據〔doc〕」
    docEn: z.string(),
    section: z.string().nullable(), // 核實時填上章節或段落
    report: z.string(), // 整理時引用的報道
    url: z.string().url(),
  }),
  officialUrl: z.string().url(), // 官方全文，核實時對照
  roleIds: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  compiledAt: z.string(),
  verifiedBy: z.string().nullable(), // null = 草稿，未對照官方全文核實
  verifiedAt: z.string().nullable(), // YYYY-MM-DD；超過 60 日網站會提示重新核實
});
export type PolicyCard = z.infer<typeof PolicyCard>;

/* ---------- PersonalPlan（J1，第 2 版）：我的五年規劃，存在瀏覽器（tp:plan） ---------- */
export const PlanMetric = z.discriminatedUnion("type", [
  // 由程式從「我的報告」計算：該年內某個練習的次數和平均分
  z.object({ type: z.literal("reports"), scenarioId: z.string(), count: z.number().int().min(1).max(50), minAvg: z.number().min(1).max(5).optional() }),
  // 由程式從「專業資格」計算：狀態變成「已取得」即完成
  z.object({ type: z.literal("cert"), certName: z.string() }),
  // 用戶自行勾選
  z.object({ type: z.literal("manual") }),
]);
export type PlanMetric = z.infer<typeof PlanMetric>;
export const PersonalPlan = z.object({
  version: z.literal(1),
  horizon: z.tuple([z.number().int(), z.number().int()]),
  vision: z.string().max(300),
  pathId: z.string().nullable(),
  goals: z.array(z.object({ id: z.string(), text: z.string().max(120), policyIds: z.array(z.string()).default([]) })).max(5),
  milestones: z.array(z.object({
    id: z.string(),
    year: z.number().int(),
    goalId: z.string().nullable(),
    text: z.string().max(160),
    metric: PlanMetric,
    done: z.boolean().default(false), // 只用於 manual
  })).max(15),
  reviews: z.array(z.object({ year: z.number().int(), date: z.string(), note: z.string().max(1000) })).default([]),
});
export type PersonalPlan = z.infer<typeof PersonalPlan>;

/* ---------- StartupProfile（V） ---------- */
export const StartupProfile = z.object({
  finance: z.custom<FinancialInput>((value) => { try { if (!value || typeof value !== "object") return false; validateFinancial(value as FinancialInput); return true; } catch { return false; } }).optional(),
  name: z.string(),
  industry: z.string(),
  stage: z.enum(["pre_seed", "seed", "series_a"]),
  cash: z.number(),
  monthlyRevenue: z.number(),
  headcount: z.number().int().nonnegative(),
  avgSalary: z.number(),
  serverCost: z.number(),
  marketing: z.number(),
  otherCost: z.number().default(0),
  price: z.number().positive(), // 每位客戶每月收費
  founderShares: z.number().positive(),
});
export type StartupProfile = z.infer<typeof StartupProfile>;

/* ---------- Scenario（V 定格式，J2 寫內容） ---------- */
export const InputSpec = z.object({
  key: z.string(),
  label: z.string(),
  kind: z.enum(["slider", "number", "choice", "text"]),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  options: z.array(z.object({ label: z.string(), value: z.union([z.string(), z.number(), z.boolean()]) })).optional(),
  maxChars: z.number().optional(),
});

export const EventEffects = z.object({
  serverCostMultiplier: z.number().optional(),
  devSpeedMultiplier: z.number().optional(), // 直至補聘後恢復
  churnDelta: z.number().optional(),
  revenueMultiplier: z.number().optional(),
  cashDelta: z.number().optional(),
  headcountDelta: z.number().int().optional(),
});
export type EventEffects = z.infer<typeof EventEffects>;

const EventStep = z.object({
  type: z.literal("event"),
  id: z.string(),
  month: z.number().int().min(1),
  card: z.object({ title: z.string(), body: z.string(), effects: EventEffects }),
  policyId: z.string().optional(), // 第 2 版：政策事件卡，連到 policy.json 的出處
  inputs: z.array(InputSpec),
});

const ProposalStep = z.object({
  type: z.literal("proposal"),
  id: z.string(),
  investorLine: z.string(), // 投資者對白（劇本提供，不由 AI 生成）
  terms: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      options: z.array(
        z.object({
          label: z.string(),
          action: z.enum(["accept", "counter", "reject"]),
          value: z.union([z.string(), z.number(), z.boolean()]),
          outcome: z.enum(["continue", "investor_walks"]).default("continue"),
          // 第 2 版：一句說明這個選項對創辦人有甚麼改變（非經濟條款不給數字；經濟條款的數字由計算器計）
          explain: z.string().optional(),
        })
      ),
    })
  ),
});

const EmailStep = z.object({
  type: z.literal("email"),
  id: z.string(),
  timeSkip: z.string().optional(), // 例如「兩星期後……」
  from: z.string(),
  subject: z.string(),
  body: z.string(),
  branches: z.object({ ifPass: z.string(), ifFail: z.string(), check: z.string() }).optional(),
  inputs: z.array(InputSpec),
});

const QuestionStep = z.object({
  type: z.literal("question"),
  id: z.string(),
  // cv 題由 AI 按 UserProfile 生成，這裡是後備題；industry 是第 2 版的「行業認知」情境題
  category: z.enum(["cv", "behavioral", "situational", "industry"]),
  text: z.string(),
  followUp: z.string().optional(), // 後備追問（AI 未連接時使用）
  textYue: z.string().optional(),
  followUpYue: z.string().optional(),
  textEn: z.string().optional(),
  followUpEn: z.string().optional(),
  policyId: z.string().optional(), // industry 題引用的政策資料卡
});

export const Step = z.discriminatedUnion("type", [EventStep, ProposalStep, EmailStep, QuestionStep]);
export type Step = z.infer<typeof Step>;

export const Scenario = z.object({
  id: z.string(),
  title: z.string(),
  mode: z.enum(["exercise", "voice"]),
  calculator: z.enum(["runway", "captable", "none"]),
  seed: z.number().int().optional(), // 固定抽卡，方便 demo 重現
  // 第 2 版：Term Sheet 的投資者類型（頁面用 label 做選擇器；disclaimer 顯示在頁面上；investment 是今輪金額）
  investor: z
    .object({ label: z.string(), disclaimer: z.string().optional(), investment: z.number().positive().optional() })
    .optional(),
  steps: z.array(Step).min(1),
  rubric: z.string(),
});
export type Scenario = z.infer<typeof Scenario>;

/* ---------- Rubric（J2） ---------- */
export const Rubric = z.object({
  id: z.string(),
  title: z.string(),
  dimensions: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        // 1–5 分，每個分數都要有一句具體描述
        levels: z.object({ "1": z.string(), "2": z.string(), "3": z.string(), "4": z.string(), "5": z.string() }),
        // 選用維度：只有 SessionLog.finalCalc[requiresMetric] > 0 時才評分（例如有答「行業認知」題）
        requiresMetric: z.string().optional(),
      })
    )
    .min(1),
  wantsRewrite: z.boolean().default(false),
});
export type Rubric = z.infer<typeof Rubric>;

/* ---------- SessionLog（V：練習引擎；S：語音引擎） ---------- */
export const SessionLog = z.object({
  scenarioId: z.string(),
  kind: z.enum(["exercise", "voice"]),
  steps: z
    .array(
      z.object({
        stepId: z.string(),
        inputs: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
        text: z.string().optional(), // 用戶寫的理由或電郵回覆
        calc: z.record(z.string(), z.number()).optional(),
      })
    )
    .default([]),
  turns: z
    .array(
      z.object({
        speaker: z.string(), // "user" | "coach" | VC 角色 id
        text: z.string(),
        start: z.number(),
        end: z.number(),
      })
    )
    .default([]),
  outcome: z.string().optional(),
  finalCalc: z.record(z.string(), z.number()).optional(),
});
export type SessionLog = z.infer<typeof SessionLog>;

/* ---------- EvaluationReport（V；J1 的報告頁只處理這一種） ---------- */
export const EvaluationReport = z.object({
  scenarioId: z.string(),
  summary: z.string(),
  dimensions: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      score: z.number().int().min(1).max(5),
      evidence: z.string(),
      suggestion: z.string(),
    })
  ),
  rewriteExample: z.string().optional(),
  metrics: z.record(z.string(), z.number()).optional(),
});
export type EvaluationReport = z.infer<typeof EvaluationReport>;
