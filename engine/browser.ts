import { projectFinancial, financialPresets, presetInput, migrateFinancial, validateFinancial } from "./lib/calc/financial";
/**
 * 瀏覽器入口：`npm run build:site` 把它打包成 site/assets/js/engine.js（全域變數 Engine）。
 * PHP 網站的頁面直接用 Engine.calc、Engine.engine 等，計算邏輯只有這一份。
 * 簡轉繁在 hk.ts，另外打包成 opencc-hk.js，避免每頁都載入大型字典。
 * 資料格式的驗證在伺服器端（site/lib/Validator.php），所以這裡不打包 zod，檔案保持細小。
 */
import { applyRound, ownership, simulateRounds, totalShares } from "./lib/calc/captable";
import { computeWaterfall, exitScenarios } from "./lib/calc/waterfall";
import { simulateRunway, quickRunway, DEFAULT_PARAMS } from "./lib/calc/runway";
import { weightedAveragePrice, adjustedConversionPrice, applyRoundWithAntiDilution } from "./lib/calc/antidilution";
import { proRataAmount, applyRoundWithProRata } from "./lib/calc/prorata";
import { drawEvents, newSession, recordStep, runBlackSwan, profileToRunway, seededRandom } from "./lib/engine/engine";
import { scoreStrengths, rankStrengths } from "./lib/strengths";
import { milestoneProgress, yearProgress, certMilestoneDrafts, reportScore } from "./lib/plan";
import { demoUser, demoStartup, demoPlan } from "./data/demo";

export const calc = {
  projectFinancial, financialPresets, presetInput, migrateFinancial, validateFinancial,
  applyRound, ownership, simulateRounds, totalShares, computeWaterfall, exitScenarios, simulateRunway, quickRunway, DEFAULT_PARAMS,
  weightedAveragePrice, adjustedConversionPrice, applyRoundWithAntiDilution, proRataAmount, applyRoundWithProRata,
};
export const engine = { drawEvents, newSession, recordStep, runBlackSwan, profileToRunway, seededRandom };
export const strengths = { score: scoreStrengths, rank: rankStrengths };
export const plan = { milestoneProgress, yearProgress, certMilestoneDrafts, reportScore };
export const demo = { user: demoUser, startup: demoStartup, plan: demoPlan };
export const version = "0.4.0";
