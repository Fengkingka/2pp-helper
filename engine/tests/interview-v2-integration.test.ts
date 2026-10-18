import { describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";

const site = (path: string) => fileURLToPath(new URL(`../../site/${path}`, import.meta.url));
function questions() {
  const root: any = { InterviewDemo: { Voice: class {} } };
  const path = site("assets/js/interview-conversation.js");
  if (existsSync(path)) runInNewContext(readFileSync(path, "utf8"), { window: root });
  expect(root.InterviewConversation?.buildQuestions, "Personalized five-question composer is missing").toBeTypeOf("function");
  return root.InterviewConversation.buildQuestions;
}
const bank = JSON.parse(readFileSync(site("data/scenarios/interview_general_v1.json"), "utf8")).steps;
const localize = (text: string) => `EN:${text}`;

describe("V2 personalized interview integration", () => {
  it("requests two CV questions in the pinned language and keeps five categories", async () => {
    const request = vi.fn(async () => ({ questions: ["CV one", "CV two", "Ignored third"] }));
    const profile = { experiences: [{ title: "Analyst", org: "Sample", bullets: ["Built 20 reports"] }] };
    const result = await questions()(bank, { profile, role: "Analyst", language: "en", industry: false, seed: 42, localize, request });
    expect(request).toHaveBeenCalledWith("llm.php", { task: "interview_questions", profile, role: "Analyst" }, "en");
    expect(result.map((q: any) => q.category)).toEqual(["cv", "cv", "behavioral", "behavioral", "situational"]);
    expect(result.slice(0, 2).map((q: any) => q.text)).toEqual(["CV one", "CV two"]);
  });
  it("replaces only the fifth question with optional industry awareness and preserves its source", async () => {
    const result = await questions()(bank, { profile: null, role: "Analyst", language: "zh-HK", industry: true, seed: 42, localize: (s: string) => s, request: vi.fn() });
    expect(result).toHaveLength(5);
    expect(result.map((q: any) => q.category)).toEqual(["cv", "cv", "behavioral", "behavioral", "industry"]);
    expect(result[4].policyId).toBeTruthy();
  });
  it("uses a deterministic localized bank when CV generation is unavailable or invalid", async () => {
    const build = questions();
    const options = { profile: {}, role: "Analyst", language: "en", industry: false, seed: 42, localize };
    const untranslatedBank = bank.map(({ textEn, followUpEn, ...q }: any) => q);
    const fallback = await build(untranslatedBank, { ...options, request: async () => { throw Error("offline"); } });
    const invalid = await build(untranslatedBank, { ...options, request: async () => ({ questions: [null, ""] }) });
    expect(invalid).toEqual(fallback);
    expect(fallback.every((q: any) => q.text.startsWith("EN:") && q.followUp.startsWith("EN:"))).toBe(true);
  });
  it("pins API language while filtering unconsented strengths without mutating the local profile", async () => {
    const fetch = vi.fn(async (_url: string, _options: any) => ({ ok: true, json: async () => ({ source: "fallback" }) }));
    const document = { body: { dataset: { base: "../" } }, addEventListener() {} };
    const root: any = { TPI18n: { language: () => "zh-HK" } };
    runInNewContext(readFileSync(site("assets/js/app.js"), "utf8"), { window: root, document, fetch });
    const profile = { strengths: { shareWithAI: false, scores: { mastery: 5 } } };
    await root.TP.api("llm.php", { task: "interview_questions", profile }, "en");
    const options = fetch.mock.calls[0][1] as any;
    expect(options.headers["Accept-Language"]).toBe("en");
    expect(JSON.parse(options.body)).toMatchObject({ _lang: "en", profile: { strengths: null } });
    expect(profile.strengths.scores.mastery).toBe(5);
    await root.TP.api("llm.php", { profile: { strengths: { shareWithAI: true, scores: { mastery: 5 } } } }, "en");
    expect(JSON.parse((fetch.mock.calls[1][1] as any).body).profile.strengths.scores.mastery).toBe(5);
  });
});
