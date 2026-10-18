/**
 * 劇本和評分準則的登記處（給測試用）。J2 新增 JSON 後，在這裡加一行 import。
 * 網站由 PHP 直接讀取 site/data 裡的同一批 JSON（`npm run build:site` 會複製過去）。
 */
import { Rubric, Scenario } from "./types";
import strengthsQuestionnaire from "../questionnaires/ipip_core_strengths_v1.json";
import blackSwan from "../scenarios/black_swan_saas_v1.json";
import termSheet from "../scenarios/term_sheet_seed_v1.json";
import termSheetGuidanceFund from "../scenarios/term_sheet_guidance_fund_v1.json";
import b2b from "../scenarios/b2b_procurement_v1.json";
import interview from "../scenarios/interview_general_v1.json";
import hostileVc from "../scenarios/hostile_vc_v1.json";
import rubricVc from "../rubrics/hostile_vc_v1.json";
import rubricBlackSwan from "../rubrics/black_swan_v1.json";
import rubricTermSheet from "../rubrics/term_sheet_v1.json";
import rubricB2B from "../rubrics/b2b_procurement_v1.json";
import rubricInterview from "../rubrics/interview_v1.json";
import rubricGraduate from "../rubrics/interview_graduate_v2.json";
import rubricExperienced from "../rubrics/interview_experienced_v2.json";

export const scenarios: Record<string, Scenario> = Object.fromEntries(
  [blackSwan, termSheet, termSheetGuidanceFund, b2b, interview, hostileVc].map((s) => {
    const parsed = Scenario.parse(s);
    return [parsed.id, parsed];
  })
);

export const rubrics: Record<string, Rubric> = Object.fromEntries(
  [rubricBlackSwan, rubricTermSheet, rubricB2B, rubricInterview, rubricGraduate, rubricExperienced, rubricVc].map((r) => {
    const parsed = Rubric.parse(r);
    return [parsed.id, parsed];
  })
);

export function getScenario(id: string): Scenario {
  const s = scenarios[id];
  if (!s) throw new Error(`找不到劇本：${id}`);
  return s;
}

export function getRubric(id: string): Rubric {
  const r = rubrics[id];
  if (!r) throw new Error(`找不到評分準則：${id}`);
  return r;
}

/** 第 2 版：性格與強項問卷（IPIP 公有領域題目）。網站讀取 site/data/questionnaires 的副本。 */
export const questionnaires = { ipip_core_strengths_v1: strengthsQuestionnaire };
