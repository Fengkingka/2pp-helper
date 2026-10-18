import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { join } from "node:path";
import { EvaluationReport, SessionLog } from "../lib/types";

// Opt-in because real Chrome and PHP are not required for ordinary engine builds.
describe.runIf(process.env.TP_BROWSER_TESTS === "1")("English demo in real Chrome", () => {
  let browser: Browser;
  let server: ChildProcess;
  let context: BrowserContext;
  let page: Page;
  let base: string;
  let modelRequests: string[];
  let pageErrors: string[];
  const longAnswer = "I worked with a team on a reporting project. My responsibility was to organize the data, check its accuracy, and explain the findings. We delivered 20 reports on time and improved the next planning cycle.";

  beforeAll(async () => {
    const port = await new Promise<number>((resolve) => {
      const socket = createServer();
      socket.listen(0, "127.0.0.1", () => {
        const address = socket.address() as { port: number };
        socket.close(() => resolve(address.port));
      });
    });
    base = `http://127.0.0.1:${port}`;
    const php = process.env.PHP_PATH || (process.platform === "win32"
      ? fileURLToPath(new URL("../../../tools/php/php.exe", import.meta.url)) : "php");
    server = spawn(php, ["-S", `127.0.0.1:${port}`, "router.php"], {
      cwd: fileURLToPath(new URL("../../site", import.meta.url)),
      env: { ...process.env, LLM_MODE: "mock", LLM_BASE_URL: "http://127.0.0.1:1", LLM_API_KEY: "test-only" },
      windowsHide: true, stdio: "ignore"
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      const poll = async () => {
        try { if ((await fetch(base + "/grad/interview.php")).ok) return resolve(); } catch { /* Starting. */ }
        if (server.exitCode !== null) return reject(new Error("Test PHP server exited"));
        setTimeout(poll, 100);
      };
      void poll();
    });
    const candidates = [
      process.env.CHROME_PATH,
      join(homedir(), "AppData/Local/Google/Chrome/Application/chrome.exe"),
      "C:/Program Files/Google/Chrome/Application/chrome.exe"
    ].filter((p): p is string => !!p);
    const executablePath = candidates.find(existsSync);
    browser = await chromium.launch({ executablePath, channel: executablePath ? undefined : "chrome", headless: true,
      args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
  }, 30000);

  beforeEach(async () => {
    context = await browser.newContext({ permissions: ["microphone"], viewport: { width: 1360, height: 1000 } });
    await context.addInitScript(() => {
      const w = window as any;
      const harness: any = w.voiceHarness = { recognizers: [], utterances: [], streams: [], recorders: [] };
      const Recorder = w.MediaRecorder;
      w.MediaRecorder = class extends Recorder {
        constructor(stream: MediaStream, options?: MediaRecorderOptions) { super(stream, options); harness.recorders.push(this); }
      };
      w.SpeechSynthesisUtterance = class { constructor(public text: string) {} };
      w.SpeechRecognition = class {
        lang = ""; onresult: any; onend: any; onerror: any; starts = 0;
        constructor() { harness.recognizers.push(this); }
        start() { this.starts++; }
        stop() { this.onend?.(); }
        abort() { this.onend?.(); }
      };
      Object.defineProperty(w, "speechSynthesis", { configurable: true, value: {
        getVoices: () => [{ lang: "zh-HK" }, { lang: "en-US" }],
        cancel: () => {},
        speak: (u: any) => { harness.utterances.push(u); u.onstart?.(); }
      } });
      // The mic stream and recorder are real Chrome APIs; only cloud recognition/TTS events are simulated.
      const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        const stream = await getUserMedia(constraints);
        harness.streams.push(stream);
        return stream;
      };
    });
    page = await context.newPage();
    modelRequests = [];
    pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));
    page.on("request", (r) => { if (r.url().includes("/api/llm.php") && r.postDataJSON()?.task !== "interview_assess_profile") modelRequests.push(r.url()); });
    await page.route("https://fonts.googleapis.com/**", (r) => r.abort());
    await page.route("**/api/speech.php", (route) => route.request().method() === "GET"
      ? route.fulfill({ json: { provider: "browser", ready: false } }) : route.abort());
    await page.goto(base + "/grad/interview.php?mode=demo");
    await page.evaluate(() => (window as any).TPI18n.setLanguage("zh-HK"));
  });
  afterEach(async () => {
    try {
      expect(modelRequests).toEqual([]);
      expect(pageErrors).toEqual([]);
    } finally { await context?.close(); }
  });
  afterAll(async () => {
    try { await browser?.close(); }
    finally { server?.kill(); }
  }, 30000);

  async function textStart() {
    if (await page.locator("#track-controls").count()) await confirmTrack();
    await page.locator("#start-text").click();
    await page.waitForFunction(() => document.querySelector("#session")?.getAttribute("data-phase") === "waiting");
  }
  async function confirmTrack() {
    if (!await page.locator("#track-confirm").isChecked()) {
      await page.locator("#interview-track").selectOption("graduate");
      await page.locator("#track-confirm").check();
    }
  }
  async function answer(text = longAnswer) {
    await page.locator("#answer").fill(text);
    await page.locator("#submit-answer").click();
  }
  async function speechEnd() {
    await page.evaluate(() => { const h = (window as any).voiceHarness; h.utterances[h.utterances.length - 1].onend?.(); });
    await page.waitForFunction(() => document.querySelector("#session")?.getAttribute("data-phase") === "waiting");
  }
  async function recognize(text: string) {
    await page.evaluate((text) => {
      const h = (window as any).voiceHarness;
      h.recognizers[h.recognizers.length - 1].onresult?.({ resultIndex: 0,
        results: [Object.assign([{ transcript: text }], { isFinal: false })] });
    }, text);
  }
  async function savedReport() {
    // Conversational practice now asks the user to review the transcript first.
    await page.waitForFunction(() => document.querySelector('#done-status textarea') || JSON.parse(localStorage.getItem('tp:reports') || '[]').length > 0);
    const review = page.getByRole('button', { name: /^(Confirm answers and score|確認回答並評分)$/ });
    if (await review.isVisible()) await review.click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("tp:reports") || "[]").length > 0);
    return page.evaluate(() => JSON.parse(localStorage.getItem("tp:reports") || "[]")[0]);
  }

  it("completes five fixed text questions with a Chinese report in configured mock mode", async () => {
    expect(await page.locator("#idle").innerText()).toContain("示範題庫");
    await textStart();
    const questions: string[] = [];
    for (let i = 0; i < 5; i++) {
      questions.push(await page.locator("#q-text").innerText());
      await answer();
    }
    const entry = await savedReport();
    expect(new Set(questions).size).toBe(5);
    expect(entry.scenarioId).toBe("interview_english_demo_v1");
    expect(EvaluationReport.safeParse(entry.report).success).toBe(true);
    expect(entry.report.metrics).toMatchObject({ mock: 1, answeredQuestions: 5 });
    expect(entry.report.metrics.answerWords).toBeGreaterThan(150);
    expect(entry.report.metrics).not.toHaveProperty("wordsPerMin");
    expect(entry.report.metrics).not.toHaveProperty("fillerWordsEn");
    expect(await page.locator("#done-actions a").last().getAttribute("href")).toContain("mode=demo");
    await page.getByRole("link", { name: "查看報告" }).click();
    await page.locator("#detail .badge").waitFor({ state: "visible" });
    await page.locator("#detail .badge").waitFor({ state: "visible" });
    expect(await page.locator("#detail").innerText()).toContain("示範評分（未連接 AI）");
    expect(await page.locator("#detail").innerText()).toContain("英文回答詞數");
  });

  async function conversationStart(lang: string, voice = false) {
    await page.goto(base + "/grad/interview.php");
    await page.evaluate((lang) => (window as any).TPI18n.setLanguage(lang), lang);
    await page.locator("#interview-track").selectOption("graduate");
    await page.locator("#track-confirm").check();
    modelRequests = [];
    await page.locator(voice ? "#start-voice" : "#start-text").click();
    await page.waitForFunction(() => ["waiting", "speaking"].includes(document.querySelector("#session")?.getAttribute("data-phase") || ""));
  }

  it("requires explicit track confirmation when CV is missing and pins retry context", async () => {
    const evaluations: any[] = [];
    await page.route("**/api/llm.php", (route) => route.fulfill({ json: { source: "fallback", track: "unknown", reason: "No CV evidence", evidence: [], confirmationRequired: true, followUp: null } }));
    await page.route("**/api/evaluate.php", async (route) => {
      evaluations.push(route.request().postDataJSON());
      if (evaluations.length === 1) return route.fulfill({ status: 502, json: { error: "Try again" } });
      const keys = ["relevance", "ownership", "judgement", "outcomes", "clarity"];
      return route.fulfill({ json: { scenarioId: "interview_general_v1", summary: "Practice", dimensions: keys.map((key) => ({ key, label: key, score: 1, evidence: "", suggestion: "Insufficient evidence.\nExplain a personal action." })), metrics: { rubricVersion: 2, interviewTrack: 2, coreRated: 0, ...Object.fromEntries(keys.map((key) => ["assessed_" + key, 0])) } } });
    });
    await page.goto(base + "/grad/interview.php?mode=general");
    expect(await page.locator("#start-text").isDisabled()).toBe(true);
    await page.locator("#role").fill("Marketing Analyst");
    await page.locator("#interview-track").selectOption("experienced");
    expect(await page.locator("#start-text").isDisabled()).toBe(true);
    await page.locator("#track-confirm").check();
    await textStart();
    expect(await page.locator("#interview-track").isDisabled()).toBe(true);
    expect(await page.locator("#role").isDisabled()).toBe(true);
    await page.locator("#answer").fill("I would test the proposal with users and check their feedback.");
    await page.locator("#finish").click();
    await page.getByRole("button", { name: "確認回答並評分" }).click();
    await page.getByRole("button", { name: "重新評分" }).click();
    const entry = await savedReport();
    expect(evaluations).toHaveLength(2);
    expect(evaluations[0].interviewContext).toEqual(evaluations[1].interviewContext);
    expect(entry.interviewContext).toMatchObject({ version: 2, track: "experienced", role: "Marketing Analyst" });
    expect(JSON.stringify(entry)).not.toContain("experiences");
    modelRequests = [];
    await page.getByRole("link", { name: "查看報告" }).click();
    await page.locator("#detail .badge").waitFor({ state: "visible" });
    expect(await page.locator("#detail").innerText()).toContain("0 / 5");
    expect(await page.locator("#detail").innerText()).toContain("未有核心平均分");
    expect(await page.locator(".score-num").count()).toBe(0);
  });

  it("a late profile recommendation cannot replace a manual choice", async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    await page.route("**/api/llm.php", async (route) => {
      if (route.request().postDataJSON().task === "interview_assess_profile") {
        await pending;
        return route.fulfill({ json: { source: "ai", track: "experienced", reason: "Professional ownership", evidence: [], confirmationRequired: true } });
      }
      return route.fulfill({ json: { source: "fallback", followUp: null } });
    });
    await page.goto(base + "/grad/interview.php");
    await page.locator("#interview-track").selectOption("graduate");
    await page.locator("#track-confirm").check();
    release();
    await expect.poll(() => page.locator("#track-recommendation").textContent()).toContain("Professional ownership");
    expect(await page.locator("#interview-track").inputValue()).toBe("graduate");
    expect(await page.locator("#track-confirm").isChecked()).toBe(true);
    modelRequests = [];
  });

  it("changing role drops a pending recommendation for the old role", async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let calls = 0;
    await page.route("**/api/llm.php", async (route) => {
      if (route.request().postDataJSON().task !== "interview_assess_profile") return route.fulfill({ json: { source: "fallback", followUp: null } });
      if (++calls === 1) { await held; return route.fulfill({ json: { track: "experienced", source: "ai", reason: "Stale recommendation", evidence: [] } }); }
      return route.fulfill({ json: { track: "unknown", source: "fallback", reason: "Current role needs confirmation", evidence: [] } });
    });
    await page.goto(base + "/grad/interview.php");
    await page.locator("#role").fill("Marketing Analyst");
    await page.locator("#role").blur();
    await expect.poll(() => calls).toBe(2);
    release();
    await expect.poll(() => page.locator("#track-recommendation").textContent()).toContain("Current role needs confirmation");
    expect(await page.locator("#track-recommendation").innerText()).not.toContain("Stale recommendation");
  });

  it("starting during a pending recommendation preserves the selected track and classification snapshot", async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    await page.route("**/api/llm.php", async (route) => {
      if (route.request().postDataJSON().task === "interview_assess_profile") { await held; return route.fulfill({ json: { track: "experienced", source: "ai", reason: "Late classification", evidence: [] } }); }
      return route.fulfill({ json: { source: "fallback", followUp: null } });
    });
    await page.goto(base + "/grad/interview.php");
    await textStart();
    release();
    await page.locator("#answer").fill(longAnswer);
    await page.locator("#finish").click();
    const entry = await savedReport();
    expect(entry.interviewContext.track).toBe("graduate");
    expect(entry.classification).toBeNull();
    expect(JSON.stringify(entry)).not.toContain("Late classification");
  });

  it("a recommendation pending across pagehide cannot apply after restoring the page", async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let calls = 0;
    await page.route("**/api/llm.php", async (route) => {
      if (++calls === 1) { await held; return route.fulfill({ json: { track: "experienced", source: "ai", reason: "Stale hidden recommendation", evidence: [] } }); }
      return route.fulfill({ json: { track: "unknown", source: "fallback", reason: "Restored page confirmation", evidence: [] } });
    });
    await page.goto(base + "/grad/interview.php");
    await page.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    });
    release();
    await expect.poll(() => page.locator("#track-recommendation").textContent()).not.toContain("Stale hidden recommendation");
    expect(await page.locator("#interview-track").inputValue()).not.toBe("experienced");
  });

  async function v2QuoteReport(roleContextMatched: number) {
    await page.evaluate((matched) => {
      const w = window as any;
      w.TP.store.set("reports", [{ id: "v2-original-quotes", scenarioId: "interview_general_v1", route: "grad", title: "Interview practice", createdAt: "2026-10-08T08:00:00Z",
        interviewContext: { version: 2, confirmed: true, track: "graduate", role: matched ? "Existing card role" : "Unlisted Polar Robotics Specialist", categories: ["cv"], answeredCategories: ["cv"] },
        report: { scenarioId: "interview_general_v1", summary: "Practice feedback", dimensions: [
          { key: "ownership", label: "Personal responsibility", score: 3, evidence: "我负责数据分析", suggestion: "A personal action is described.\nExplain how you checked the effect." },
          { key: "clarity", label: "Clarity", score: 3, evidence: "可靠", suggestion: "The meaning can be followed.\nConnect the statement to an example." }
        ], metrics: { rubricVersion: 2, interviewTrack: 1, coreRated: 2, coreAverage: 3, assessed_ownership: 1, assessed_clarity: 1, roleContextMatched: matched } } }]);
      w.TPI18n.setLanguage("zh-HK");
    }, roleContextMatched);
    await page.goto(base + "/reports.php?id=v2-original-quotes");
    await page.locator("#detail .badge").waitFor({ state: "visible" });
  }

  it("keeps v2 Simplified Chinese evidence and translatable words verbatim across interface switches", async () => {
    await v2QuoteReport(0);
    const evidence = ["「我负责数据分析」", "「可靠」"];
    expect(await page.locator("#detail blockquote").allTextContents()).toEqual(evidence);
    await page.evaluate(() => (window as any).TPI18n.setLanguage("en"));
    await expect.poll(() => page.locator("#detail blockquote").allTextContents()).toEqual(evidence);
    await page.evaluate(() => (window as any).TPI18n.setLanguage("zh-HK"));
    await expect.poll(() => page.locator("#detail blockquote").allTextContents()).toEqual(evidence);
    const saved = await page.evaluate(() => (window as any).TP.reports.get("v2-original-quotes"));
    expect(saved.report.dimensions.map((d: any) => d.evidence)).toEqual(["我负责数据分析", "可靠"]);
  });

  it("reports unmatched role limits and transcript inference exclusions in both languages", async () => {
    await v2QuoteReport(0);
    expect(await page.locator("#detail").innerText()).toContain("此目標職位未配對到現有職位卡");
    expect(await page.locator("#detail").innerText()).toContain("信心或人口特徵");
    expect(await page.locator("#detail").innerText()).not.toContain("roleContextMatched");
    await page.evaluate(() => (window as any).TPI18n.setLanguage("en"));
    expect(await page.locator("#detail").innerText()).toContain("No existing role card matched this target role");
    expect(await page.locator("#detail").innerText()).toContain("confidence or demographic characteristics");
  });

  it("identifies a matched role card in v2 report context", async () => {
    await v2QuoteReport(1);
    expect(await page.locator("#detail").innerText()).toContain("此目標職位已配對到現有職位卡");
    await page.evaluate(() => (window as any).TPI18n.setLanguage("en"));
    expect(await page.locator("#detail").innerText()).toContain("An existing role card matched this target role");
  });

  it("automatically submits a spoken answer once and asks a contextual follow-up", async () => {
    await page.route("**/api/llm.php", (route) => route.fulfill({ json: { source: "ai", followUp: "How did those 20 reports help your team?" } }));
    await conversationStart("en", true);
    await speechEnd();
    await recognize(longAnswer);
    await expect.poll(() => page.locator("#q-text").textContent(), { timeout: 7000, message: "First automatic submission should ask a follow-up" }).toBe("How did those 20 reports help your team?");
    await speechEnd();
    await recognize(longAnswer);
    await expect.poll(() => page.locator("#q-text").textContent(), { timeout: 7000, message: "Follow-up answer should advance to the second question" }).toContain("skill");
    expect(modelRequests).toHaveLength(1);
    expect(await page.locator(".bubble.me:not(.partial)").count()).toBe(2);
    modelRequests = [];
    await page.locator("#finish").click();
    const entry = await savedReport();
    expect(entry.scenarioId).toBe("interview_general_v1");
    expect(entry.report.metrics.answeredQuestions).toBe(1);
  }, 20000);

  it("uses Cantonese speech and character metrics without English word estimates", async () => {
    await page.route("**/api/llm.php", (route) => route.fulfill({ json: { source: "ai", followUp: null } }));
    await conversationStart("zh-HK", true);
    expect(await page.locator("#q-text").innerText()).toContain("可唔可以");
    expect(await page.evaluate(() => (window as any).voiceHarness.utterances[0].lang)).toBe("zh-HK");
    await speechEnd();
    expect(await page.evaluate(() => (window as any).voiceHarness.recognizers[0].lang)).toBe("zh-HK");
    await recognize("我幫團隊整咗一個報表，令大家每個星期慳返兩個鐘。");
    await page.locator("#finish").click();
    const entry = await savedReport();
    expect(entry.report.metrics.answerChars).toBeGreaterThan(0);
    expect(entry.report.metrics).not.toHaveProperty("answerWords");
    expect(entry.report.metrics).not.toHaveProperty("wordsPerMin");
  });

  async function cloudRoutes(failTranscription = false) {
    const wav = Buffer.alloc(44 + 3200);
    wav.write("RIFF", 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28); wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(3200, 40);
    await page.route("**/api/speech.php", async (route) => {
      const request = route.request();
      if (request.method() === "GET") return route.fulfill({ json: { provider: "minimax", ready: true } });
      if (request.headers()["content-type"]?.includes("application/json")) {
        return route.fulfill({ contentType: "audio/wav", body: wav });
      }
      expect(request.postDataBuffer()?.includes(Buffer.from("RIFF"))).toBe(true);
      return failTranscription
        ? route.fulfill({ status: 502, json: { error: "Speech service unavailable" } })
        : route.fulfill({ json: { text: longAnswer } });
    });
    await page.route("**/api/llm.php", (route) => route.fulfill({ json: { source: "ai", followUp: null } }));
  }

  it("captures cloud answer WAV in Chrome and retains a playable local recording", async () => {
    await cloudRoutes();
    await conversationStart("en", true);
    await page.waitForFunction(() => document.querySelector("#session")?.getAttribute("data-phase") === "waiting");
    await page.waitForTimeout(1000); // Capture actual fake-device audio through AudioWorklet.
    await page.locator("#submit-answer").click();
    await expect.poll(() => page.locator("#q-text").innerText()).toContain("skill");
    expect(await page.locator(".bubble.me:not(.partial)").innerText()).toBe(longAnswer);
    modelRequests = [];
    await page.locator("#finish").click();
    expect((await savedReport()).report.metrics.answeredQuestions).toBe(1);
    await page.waitForFunction(() => (document.querySelector("#audio") as HTMLAudioElement).readyState >= 1);
    expect(await page.evaluate(() => (window as any).voiceHarness.streams.every((stream: MediaStream) => !stream.active))).toBe(true);
  });

  it("allows text continuation after a cloud transcription failure", async () => {
    await cloudRoutes(true);
    await conversationStart("en", true);
    await page.waitForFunction(() => document.querySelector("#session")?.getAttribute("data-phase") === "waiting");
    await page.waitForTimeout(1000); // Include a real captured answer before simulating service failure.
    await page.locator("#submit-answer").click();
    await expect.poll(() => page.locator("#text-ui").isVisible()).toBe(true);
    expect(await page.locator("#mode-note").innerText()).toContain("transcription");
    await page.locator("#answer").fill(longAnswer);
    await page.locator("#finish").click();
    expect((await savedReport()).report.metrics.answeredQuestions).toBe(1);
    expect(await page.evaluate(() => (window as any).voiceHarness.streams.every((stream: MediaStream) => !stream.active))).toBe(true);
  });

  it("completes five conversational questions without a follow-up when answers are sufficient", async () => {
    await page.route("**/api/llm.php", (route) => route.fulfill({ json: { source: "ai", followUp: null } }));
    await conversationStart("en");
    for (let i = 0; i < 5; i++) {
      await answer();
      if (i < 4) await page.waitForFunction(() => document.querySelector("#session")?.getAttribute("data-phase") === "waiting");
    }
    const entry = await savedReport();
    expect(entry.report.metrics.answeredQuestions).toBe(5);
    expect(modelRequests).toHaveLength(5);
    modelRequests = [];
  });

  it("keeps the interview and report language fixed when the interface is switched", async () => {
    let reportLanguage = "";
    await page.route("**/api/evaluate.php", async (route) => {
      reportLanguage = route.request().postDataJSON()._lang;
      await route.continue();
    });
    await conversationStart("en");
    await page.locator("#answer").fill(longAnswer);
    await page.evaluate(() => (window as any).TPI18n.setLanguage("zh-HK"));
    await page.locator("#finish").click();
    const entry = await savedReport();
    expect(reportLanguage).toBe("en");
    expect(entry.report.summary).toContain("no ability scoring");
    expect(await page.locator("#q-text").innerText()).toContain("Tell me");
  });

  it("ignores a follow-up arriving after the interview has ended", async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    await page.route("**/api/llm.php", async (route) => { await held; await route.fulfill({ json: { source: "ai", followUp: "Late question" } }); });
    await conversationStart("en");
    await answer();
    await page.locator("#finish").click();
    release();
    const entry = await savedReport();
    expect(entry.report.metrics.answeredQuestions).toBe(1);
    expect(await page.locator("#transcript").innerText()).not.toContain("Late question");
    modelRequests = [];
  });

  it("continues with a labelled preset follow-up when the dialogue API fails", async () => {
    await page.route("**/api/llm.php", (route) => route.fulfill({ status: 502, json: { error: "Test failure" } }));
    await conversationStart("en");
    await answer("I helped.");
    await expect.poll(() => page.locator("#q-kind").innerText()).toContain("Fallback follow-up");
    expect(await page.locator("#q-text").innerText()).toContain("result");
    modelRequests = [];
    await page.locator("#finish").click();
    await savedReport();
  });

  it("resumes a committed text answer after returning during a dialogue request", async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let calls = 0;
    await page.route("**/api/llm.php", async (route) => {
      if (route.request().postDataJSON().task === "interview_assess_profile") return route.fulfill({ json: { source: "fallback", track: "unknown", reason: "Choose and confirm", evidence: [] } });
      if (++calls === 1) await held;
      await route.fulfill({ json: { source: "ai", followUp: null } });
    });
    await conversationStart("en");
    await answer();
    await expect.poll(() => calls).toBe(1);
    await page.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    });
    release();
    await expect.poll(() => page.locator("#q-text").innerText()).toContain("skill");
    expect(await page.locator("#submit-answer").isEnabled()).toBe(true);
    await expect.poll(() => page.locator("#timer").innerText(), { timeout: 4000 }).not.toBe("00:00");
    expect(await page.locator(".bubble.me:not(.partial)").count()).toBe(1);
    modelRequests = [];
    await page.locator("#finish").click();
    expect((await savedReport()).report.metrics.answeredQuestions).toBe(1);
  });

  it("preserves a committed voice answer when recording fails during a dialogue request", async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let calls = 0;
    await page.route("**/api/llm.php", async (route) => {
      if (route.request().postDataJSON().task === "interview_assess_profile") return route.fulfill({ json: { source: "fallback", track: "unknown", reason: "Choose and confirm", evidence: [] } });
      if (++calls === 1) await held;
      await route.fulfill({ json: { source: "ai", followUp: null } });
    });
    await conversationStart("en", true);
    await speechEnd();
    await recognize(longAnswer);
    await page.locator("#submit-answer").click();
    await expect.poll(() => calls).toBe(1);
    await page.evaluate(() => (window as any).voiceHarness.recorders[0].onerror?.());
    release();
    await expect.poll(() => page.locator("#q-text").innerText()).toContain("skill");
    expect(await page.locator("#text-ui").isVisible()).toBe(true);
    expect(await page.locator(".bubble.me:not(.partial)").count()).toBe(1);
    expect(await page.locator("#answer").inputValue()).toBe("");
    modelRequests = [];
    await page.locator("#finish").click();
    expect((await savedReport()).report.metrics.answeredQuestions).toBe(1);
  });

  it("labels a live evaluation response as AI scoring without a demo disclaimer", async () => {
    // Isolate the external provider; retain the PHP report shape and actual page controller.
    await page.route("**/api/evaluate.php", async (route) => {
      const response = await route.fetch();
      const report = await response.json();
      delete report.metrics.mock;
      report.summary = "Clear examples; explain your personal contribution and results more precisely.";
      await route.fulfill({ response, json: report });
    });
    await page.evaluate(() => (window as any).TPI18n.setLanguage("en"));
    await textStart();
    for (let i = 0; i < 5; i++) await answer();
    const entry = await savedReport();
    expect(EvaluationReport.safeParse(entry.report).success).toBe(true);
    expect(entry.report.metrics).not.toHaveProperty("mock");
    expect(entry.title).not.toContain("示範");
    expect(await page.locator("#done-status").innerText()).toContain("AI evaluation report");
    await page.getByRole("link", { name: "View report" }).click();
    await page.locator("#detail .badge").waitFor({ state: "visible" });
    expect(await page.locator("#detail .badge").innerText()).toBe("AI evaluation");
    expect(await page.locator("#detail").innerText()).not.toContain("AI is not connected");
    expect(await page.locator("#detail").innerText()).toContain("Clear examples");
  });

  it("asks one fixed follow-up for short answers and rejects empty submissions", async () => {
    await textStart();
    await page.locator("#submit-answer").click();
    expect(await page.locator("#q-text").innerText()).toContain("Tell me about a project");
    await answer("I helped.");
    expect(await page.locator("#q-kind").innerText()).toContain("追問");
    await answer("I organized reports.");
    expect(await page.locator("#q-text").innerText()).toContain("specific contribution");
    await page.locator("#finish").click();
    const entry = await savedReport();
    expect(entry.report.metrics.answeredQuestions).toBe(1);
  });

  it("finishing early preserves an unsubmitted answer and counts the current main question", async () => {
    await textStart();
    await page.locator("#answer").fill("I delivered 20 reports.");
    await page.locator("#finish").click();
    const entry = await savedReport();
    expect(entry.report.metrics).toMatchObject({ answeredQuestions: 1, answerWords: 4 });
  });

  it("retains answers and a reusable retry button after multiple report failures", async () => {
    let attempts = 0;
    await page.route("**/api/evaluate.php", async (r) => {
      if (++attempts < 3) return r.fulfill({ status: 502, contentType: "application/json", body: '{"error":"Test report unavailable"}' });
      await r.continue();
    });
    await textStart();
    await page.locator("#answer").fill(longAnswer);
    await page.locator("#finish").click();
    for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "重新評分" }).click();
    const entry = await savedReport();
    expect(attempts).toBe(3);
    expect(entry.report.metrics.answeredQuestions).toBe(1);
  });

  it("does not open a mic if loading the question bank fails", async () => {
    await page.route("**/api/scenario.php*", (r) => r.fulfill({ status: 503, contentType: "application/json", body: '{"error":"Test bank unavailable"}' }));
    await page.locator("#start-voice").click();
    await page.waitForFunction(() => !(document.querySelector("#start-voice") as HTMLButtonElement).disabled);
    expect(await page.evaluate(() => (window as any).voiceHarness.streams.length)).toBe(0);
  });

  it("falls back to text when microphone permission is denied", async () => {
    await page.evaluate(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("Denied", "NotAllowedError"); }; });
    await page.locator("#start-voice").click();
    await page.waitForFunction(() => document.querySelector("#session")?.getAttribute("data-phase") === "waiting");
    expect(await page.locator("#text-ui").isVisible()).toBe(true);
    expect(await page.locator("#mode-note").innerText()).toContain("文字");
  });

  it("holds the submit button while speaking and ignores repeated answer clicks", async () => {
    await page.locator("#start-voice").click();
    await page.waitForFunction(() => document.querySelector("#session")?.getAttribute("data-phase") === "speaking");
    expect(await page.locator("#submit-answer").isDisabled()).toBe(true);
    expect(await page.locator("#avatar").getAttribute("data-state")).toBe("speaking");
    expect(await page.evaluate(() => (window as any).voiceHarness.recognizers.length)).toBe(0);
    await speechEnd();
    await recognize(longAnswer);
    await page.evaluate(() => { const b = document.querySelector("#submit-answer") as HTMLButtonElement; b.click(); b.click(); });
    await page.waitForFunction(() => (window as any).voiceHarness.utterances.length === 2);
    expect(await page.locator(".bubble.me:not(.partial)").count()).toBe(1);
    expect(await page.locator("#q-text").innerText()).toContain("specific contribution");
    await page.locator("#finish").click();
    const entry = await savedReport();
    expect(entry.report.metrics.answeredQuestions).toBe(1);
  });

  it("preserves interim speech on network failure and releases real microphone tracks", async () => {
    await page.locator("#start-voice").click();
    await page.waitForFunction(() => (window as any).voiceHarness.utterances.length === 1);
    await speechEnd();
    await recognize("I led a reporting project");
    await page.waitForTimeout(500); // Allow the real recorder to capture audio before fallback.
    await page.evaluate(() => {
      const h = (window as any).voiceHarness;
      h.recognizers[h.recognizers.length - 1].onerror?.({ error: "network" });
    });
    await page.waitForFunction(() => !(document.querySelector("#text-ui") as HTMLElement).hidden);
    expect(await page.locator("#answer").inputValue()).toBe("I led a reporting project");
    await page.waitForFunction(() => (window as any).voiceHarness.streams.every((s: MediaStream) => s.getTracks().every((t) => t.readyState === "ended")));
    await page.locator("#finish").click();
    const entry = await savedReport();
    expect(entry.report.metrics).not.toHaveProperty("wordsPerMin");
    expect(await page.locator("#recording").isVisible()).toBe(true);
  });

  it("switching to text while speaking prevents late speech from starting recognition", async () => {
    await page.locator("#start-voice").click();
    await page.waitForFunction(() => (window as any).voiceHarness.utterances.length === 1);
    await page.locator("#to-text").click();
    await speechEnd();
    expect(await page.evaluate(() => (window as any).voiceHarness.recognizers.length)).toBe(0);
    expect(await page.locator("#text-ui").isVisible()).toBe(true);
  });

  it("speech errors fall back to text rather than leaving the session stuck", async () => {
    await page.locator("#start-voice").click();
    await page.waitForFunction(() => (window as any).voiceHarness.utterances.length === 1);
    await page.evaluate(() => (window as any).voiceHarness.utterances[0].onerror?.({ error: "synthesis-failed" }));
    await page.waitForFunction(() => document.querySelector("#session")?.getAttribute("data-phase") === "waiting");
    expect(await page.locator("#text-ui").isVisible()).toBe(true);
  });

  it("ending during speech closes the mic and cannot resume after late events", async () => {
    await page.locator("#start-voice").click();
    await page.waitForFunction(() => (window as any).voiceHarness.utterances.length === 1);
    await page.locator("#finish").click();
    await page.evaluate(() => (window as any).voiceHarness.utterances[0].onend?.());
    await page.waitForFunction(() => !(document.querySelector("#done") as HTMLElement).hidden);
    await expect.poll(() => page.locator("#done-status").innerText()).toContain("沒有作答");
    expect(await page.evaluate(() => (window as any).voiceHarness.recognizers.length)).toBe(0);
    expect(await page.evaluate(() => (window as any).voiceHarness.streams[0].getTracks().every((t: MediaStreamTrack) => t.readyState === "ended"))).toBe(true);
  });

  it("produces a playable mic-only recording, matching download extension and English metrics", async () => {
    let log: any;
    page.on("request", (r) => { if (r.url().endsWith("/api/evaluate.php")) log = r.postDataJSON().log; });
    await page.locator("#start-voice").click();
    await page.waitForFunction(() => (window as any).voiceHarness.utterances.length === 1);
    await speechEnd();
    await recognize("Um, I mean I delivered 20 reports");
    await page.waitForTimeout(700); // Capture a non-empty real audio chunk.
    await page.locator("#finish").click();
    const entry = await savedReport();
    expect(SessionLog.safeParse(log).success).toBe(true);
    expect(entry.report.metrics).toMatchObject({ mock: 1, answeredQuestions: 1, fillerWordsEn: 2 });
    expect(entry.report.metrics.wordsPerMin).toBeGreaterThan(0);
    await page.waitForFunction(() => (document.querySelector("#audio") as HTMLAudioElement).readyState >= 1);
    expect(await page.locator("#recording").innerText()).toContain("咪高峰");
    const downloadPending = page.waitForEvent("download");
    await page.locator("#download-audio").click();
    const download = await downloadPending;
    expect(download.suggestedFilename()).toMatch(/\.webm$/);
    expect(await download.failure()).toBeNull();
    await page.getByRole("link", { name: "查看報告" }).click();
    await page.locator("#detail .badge").waitFor({ state: "visible" });
    expect(await page.locator("#detail").innerText()).toContain("含停頓");
    expect(await page.locator("#detail").innerText()).toContain("字幕估算");
  });

  it("uses the unified robust controller for the legacy Chinese interview entrance", async () => {
    await page.goto(base + "/grad/interview.php?language=zh-HK");
    expect(await page.locator("#idle").innerText()).toContain("根據你的 CV");
    expect(await page.locator('script[src*="interview-english.js"]').count()).toBe(1);
    expect(await page.locator('script[src$="pages/interview.js"]').count()).toBe(0);
    expect((await context.request.get(base + "/api/scenario.php?id=interview_general_v1")).ok()).toBe(true);
  });

  it("keeps the original Chinese restart link on the Chinese route", async () => {
    await page.goto(base + "/grad/interview.php?language=zh-HK");
    await textStart();
    await page.locator("#finish").click();
    expect(await page.getByRole("link", { name: "重新開始" }).getAttribute("href"))
      .toBe("../grad/interview.php");
  });

  it("restores start controls when returning during a cancelled scenario request", async () => {
    let release!: () => void;
    let started!: () => void;
    const requestStarted = new Promise<void>((r) => { started = r; });
    const resume = new Promise<void>((r) => { release = r; });
    await page.route("**/api/scenario.php*", async (r) => { started(); await resume; await r.continue(); });
    await page.locator("#start-text").click();
    await requestStarted;
    await page.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    });
    release();
    await page.waitForFunction(() => !(document.querySelector("#start-text") as HTMLButtonElement).disabled);
    await textStart();
    expect(await page.locator("#text-ui").isVisible()).toBe(true);
  });

  it("recovers a report whose response arrived while the completed page was hidden", async () => {
    let release!: () => void;
    let started!: () => void;
    const requestStarted = new Promise<void>((r) => { started = r; });
    const resume = new Promise<void>((r) => { release = r; });
    let attempts = 0;
    await page.route("**/api/evaluate.php", async (r) => {
      if (++attempts === 1) { started(); await resume; }
      await r.continue();
    });
    await textStart();
    await page.locator("#answer").fill(longAnswer);
    await page.locator("#finish").click();
    await requestStarted;
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
    const response = page.waitForResponse((r) => r.url().endsWith("/api/evaluate.php"));
    release();
    await (await response).finished();
    await page.waitForTimeout(100); // Let the hidden-page continuation settle before pageshow.
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    expect((await savedReport()).report.metrics.answeredQuestions).toBe(1);
  });

  it("an old permission rejection cannot close a new session's microphone", async () => {
    await page.evaluate(() => {
      const w = window as any;
      const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      let calls = 0;
      navigator.mediaDevices.getUserMedia = (constraints) => {
        if (++calls === 1) return new Promise((resolve, reject) => { w.voiceHarness.rejectOldPermission = reject; });
        return getUserMedia(constraints);
      };
    });
    await page.locator("#start-voice").click();
    await page.waitForFunction(() => !!(window as any).voiceHarness.rejectOldPermission);
    await page.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    });
    await page.locator("#start-voice").click();
    await page.waitForFunction(() => (window as any).voiceHarness.utterances.length === 1);
    await page.evaluate(() => (window as any).voiceHarness.rejectOldPermission(new DOMException("Old denial", "NotAllowedError")));
    await page.waitForTimeout(100);
    expect(await page.locator("#text-ui").isVisible()).toBe(false);
    expect(await page.evaluate(() => (window as any).voiceHarness.streams[0].active)).toBe(true);
    await speechEnd();
    expect(await page.locator("#voice-ui").isVisible()).toBe(true);
  });

  it("old saved Chinese reports retry on the Chinese route without modifying stored data", async () => {
    await page.evaluate(() => localStorage.setItem("tp:reports", JSON.stringify([{
      id: "old-chinese", createdAt: "2026-09-24T00:00:00Z", scenarioId: "interview_general_v1",
      route: "grad", title: "Chinese interview", retry: "grad/interview.php", next: "grad/index.php",
      report: { scenarioId: "interview_general_v1", summary: "Existing Chinese report", dimensions: [], metrics: { mock: 1 } }
    }])));
    await page.goto(base + "/reports.php?id=old-chinese");
    await page.locator("#detail .badge").waitFor({ state: "visible" });
    expect(await page.getByRole("link", { name: "再試一次" }).getAttribute("href"))
      .toBe("grad/interview.php");
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("tp:reports") || "[]")[0].retry))
      .toBe("grad/interview.php");
  });

  it("explicitly selects English and completes an English sample report without a model key", async () => {
    await page.evaluate(() => (window as any).TPI18n.setLanguage("en"));
    await page.reload();
    expect(await page.locator("html").getAttribute("lang")).toBe("en");
    expect(await page.locator("#idle").innerText()).toContain("Demo question bank");
    expect(await page.locator("#idle").innerText()).not.toMatch(/[\p{Script=Han}]/u);
    await page.screenshot({ path: ".cache/interview-demo-english.png", fullPage: true });
    expect(await page.evaluate(() => {
      const title = document.querySelector("#iv-title")!.getBoundingClientRect();
      return [...document.querySelectorAll(".float-card")].some((card) => {
        const box = card.getBoundingClientRect();
        return title.left < box.right && title.right > box.left && title.top < box.bottom && title.bottom > box.top;
      });
    })).toBe(false);
    await page.setViewportSize({ width: 375, height: 900 });
    await page.screenshot({ path: ".cache/interview-demo-english-mobile.png", fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    expect(await page.evaluate(() => document.querySelector("#idle .eyebrow")!.getBoundingClientRect().top -
      document.querySelector(".iv-top")!.getBoundingClientRect().bottom)).toBeGreaterThanOrEqual(12);
    await page.setViewportSize({ width: 1360, height: 1000 });
    await textStart();
    for (let i = 0; i < 5; i++) await answer();
    const entry = await savedReport();
    expect(entry.report.summary).toContain("Demo score");
    expect(entry.report.metrics).toMatchObject({ mock: 1, answeredQuestions: 5 });
    await page.getByRole("link", { name: "View report", exact: true }).click();
    await page.locator("#detail .badge").waitFor({ state: "visible" });
    expect(await page.locator("#detail").innerText()).toContain("English answer word count");
    expect(await page.locator("#detail").innerText()).not.toMatch(/[\p{Script=Han}]/u);
  });

  it("switches interface language during an answer without clearing the draft", async () => {
    await textStart();
    await page.locator("#answer").fill("I delivered 20 reports.");
    await page.locator('[data-language-switch] [data-lang="en"]').click();
    expect(await page.locator("#answer").inputValue()).toBe("I delivered 20 reports.");
    expect(await page.locator("#answer-count").innerText()).toBe("4 English words");
    expect(await page.locator("#q-text").innerText()).toContain("Tell me about a project");
    await page.locator('[data-language-switch] [data-lang="zh-HK"]').click();
    expect(await page.locator("#answer").inputValue()).toBe("I delivered 20 reports.");
    expect(await page.locator("#answer-count").innerText()).toBe("4 個英文詞");
  });

  it("preserves the colleague's profile-based English interview entrance", async () => {
    await page.evaluate(() => (window as any).TPI18n.setLanguage("en"));
    await page.goto(base + "/grad/interview.php?mode=general");
    expect(await page.locator("#idle").innerText()).toContain("your CV");
    expect(await page.locator('script[src*="interview-english.js"]').count()).toBe(1);
    expect(await page.locator('script[src$="pages/interview.js"]').count()).toBe(0);
    await textStart();
    expect(await page.locator("#q-text").innerText()).not.toMatch(/[\p{Script=Han}]/u);
  });

  it("generates CV questions with consent filtering and pins language before awaiting generation", async () => {
    let release!: () => void;
    let started!: () => void;
    const startedRequest = new Promise<void>((resolve) => { started = resolve; });
    const held = new Promise<void>((resolve) => { release = resolve; });
    let payload: any;
    await page.goto(base + "/grad/interview.php");
    await page.evaluate(() => {
      const w = window as any;
      w.TP.profile.set({ careerStage: "fresh_grad", education: [], skills: ["Excel"], interests: [],
        experiences: [{ title: "Analyst", org: "Sample", bullets: ["Built 20 reports"] }], targetRoles: ["Analyst"], tags: [],
        strengths: { shareWithAI: false, scores: { positivity: 2, dependability: 3, mastery: 5 } } });
      w.TPI18n.setLanguage("en");
    });
    await page.locator("#role").fill("Analyst");
    await page.route("**/api/llm.php", async (route) => {
      const body = route.request().postDataJSON();
      if (body.task === "interview_questions") {
        payload = body; started(); await held;
        return route.fulfill({ json: { source: "ai", questions: ["How did your 20 reports help?", "How did you use Excel?"] } });
      }
      return route.fulfill({ json: { source: "ai", followUp: null } });
    });
    expect(await page.locator("#strength-tip").isVisible()).toBe(true);
    await confirmTrack();
    await page.locator("#start-text").click();
    await startedRequest;
    await page.evaluate(() => (window as any).TPI18n.setLanguage("zh-HK"));
    release();
    await expect.poll(() => page.locator("#q-text").innerText()).toBe("How did your 20 reports help?");
    expect(payload).toMatchObject({ task: "interview_questions", role: "Analyst", _lang: "en", profile: { strengths: null } });
    expect(payload.profile.experiences[0].bullets).toEqual(["Built 20 reports"]);
    expect(await page.locator("#strength-tip").textContent()).toContain("精進");
    await page.locator("#answer").fill(longAnswer);
    await page.locator("#finish").click();
    const entry = await savedReport();
    expect(entry.scenarioId).toBe("interview_general_v1");
    expect(entry.report.summary).toContain("no ability scoring");
    modelRequests = [];
  });

  it("pins fixed demo report language across interface switches and report retries", async () => {
    const requestLanguages: string[] = [];
    await page.route("**/api/evaluate.php", async (route) => {
      requestLanguages.push(route.request().postDataJSON()._lang);
      if (requestLanguages.length === 1) return route.fulfill({ status: 502, json: { error: "Test report unavailable" } });
      await route.continue();
    });
    await page.evaluate(() => (window as any).TPI18n.setLanguage("en"));
    await textStart();
    await page.locator("#answer").fill(longAnswer);
    await page.evaluate(() => (window as any).TPI18n.setLanguage("zh-HK"));
    await page.locator("#finish").click();
    await page.getByRole("button", { name: "重新評分" }).click();
    const entry = await savedReport();
    expect(requestLanguages).toEqual(["en", "en"]);
    expect(entry.report.summary).toContain("Demo score");
    expect(entry.scenarioId).toBe("interview_english_demo_v1");
  });

  it("counts an answered industry fifth question in scoring and the existing plan", async () => {
    await page.route("**/api/llm.php", (route) => route.fulfill({ json: { source: "ai", followUp: null } }));
    await page.route("**/api/evaluate.php", (route) => {
      const keys = ["relevance", "ownership", "judgement", "outcomes", "clarity", "industry"];
      const calc = route.request().postDataJSON().log.finalCalc;
      return route.fulfill({ json: { scenarioId: "interview_general_v1", summary: "Coaching feedback", dimensions: keys.map((key) => ({ key, label: key, score: key === "industry" ? 1 : 4, evidence: "My responsibility was to organize the data", suggestion: "Relevant action.\nExplain how you checked the impact." })),
        metrics: { ...calc, rubricVersion: 2, interviewTrack: 1, coreRated: 5, coreAverage: 4, ...Object.fromEntries(keys.map((key) => ["assessed_" + key, 1])) } } });
    });
    await page.goto(base + "/grad/interview.php");
    await page.evaluate(() => {
      const w = window as any;
      w.TPI18n.setLanguage("en");
      w.TP.store.set("plan", { milestones: [{ id: "practice", year: new Date().getFullYear(), text: "Practise interviews",
        metric: { type: "reports", scenarioId: "interview_general_v1", count: 1, minAvg: 1 } }] });
    });
    await page.locator("#industry-q").check();
    await textStart();
    expect(await page.locator("#progress .stop").count()).toBe(5);
    for (let i = 0; i < 4; i++) { await answer(); await page.waitForFunction(() => document.querySelector("#session")?.getAttribute("data-phase") === "waiting"); }
    expect(await page.locator("#q-policy").isVisible()).toBe(true);
    expect(await page.locator("#q-policy a").count()).toBeGreaterThan(0);
    await answer();
    const entry = await savedReport();
    expect(entry.report.metrics).toMatchObject({ industryQuestions: 1, answeredQuestions: 5 });
    expect(entry.report.dimensions.some((d: any) => d.key === "industry")).toBe(true);
    modelRequests = [];
    await page.getByRole("link", { name: "View report", exact: true }).click();
    await page.locator("#detail .badge").waitFor({ state: "visible" });
    expect(await page.locator("#detail").innerText()).toContain("five-year plan");
    expect(await page.locator("#detail").innerText()).toContain("Core average 4.0");
    expect(await page.locator("[data-industry-score]").innerText()).toContain("excluded from the core average");
  });

  it("does not score industry awareness when ending before the selected fifth question", async () => {
    await conversationStart("en");
    await page.locator("#answer").fill(longAnswer);
    await page.locator("#finish").click();
    const entry = await savedReport();
    expect(await page.locator("#done-status").innerText()).toContain("no ability scoring");
    expect(entry.report.metrics).not.toHaveProperty("industryQuestions");
    expect(entry.report.dimensions.some((d: any) => d.key === "industry")).toBe(false);
  });

  it("keeps five questions and excludes optional scoring when industry is disabled", async () => {
    await page.goto(base + "/grad/interview.php?mode=general");
    await page.evaluate(() => (window as any).TPI18n.setLanguage("en"));
    await page.route("**/api/llm.php", (route) => route.fulfill({ json: { source: "ai", followUp: null } }));
    await page.locator("#industry-q").uncheck();
    await textStart();
    for (let i = 0; i < 5; i++) {
      expect(await page.locator("#q-policy").isVisible()).toBe(false);
      await answer();
      if (i < 4) await page.waitForFunction(() => document.querySelector("#session")?.getAttribute("data-phase") === "waiting");
    }
    const entry = await savedReport();
    expect(entry.scenarioId).toBe("interview_general_v1");
    expect(entry.report.metrics.answeredQuestions).toBe(5);
    expect(entry.report.metrics).not.toHaveProperty("industryQuestions");
    expect(entry.report.dimensions.some((d: any) => d.key === "industry")).toBe(false);
    modelRequests = [];
  });

  it("falls back to text on browsers without speech recognition", async () => {
    await page.addInitScript(() => {
      (window as any).SpeechRecognition = undefined;
      (window as any).webkitSpeechRecognition = undefined;
    });
    await page.reload();
    await page.locator("#start-voice").click();
    await page.waitForFunction(() => document.querySelector("#session")?.getAttribute("data-phase") === "waiting");
    expect(await page.locator("#text-ui").isVisible()).toBe(true);
    expect(await page.evaluate(() => (window as any).voiceHarness.streams.length)).toBe(0);
  });

  it("ending during transcript flush commits once and ignores the late submit continuation", async () => {
    await page.locator("#start-voice").click();
    await page.waitForFunction(() => (window as any).voiceHarness.utterances.length === 1);
    await speechEnd();
    await recognize(longAnswer);
    await page.evaluate(() => {
      const h = (window as any).voiceHarness;
      const r = h.recognizers[0];
      r.stop = () => { h.lateFlushEnd = r.onend; };
      (document.querySelector("#submit-answer") as HTMLButtonElement).click();
      (document.querySelector("#finish") as HTMLButtonElement).click();
      h.lateFlushEnd?.();
    });
    const entry = await savedReport();
    expect(entry.report.metrics.answeredQuestions).toBe(1);
    expect(await page.locator(".bubble.me:not(.partial)").count()).toBe(1);
    expect(await page.evaluate(() => (window as any).voiceHarness.utterances.length)).toBe(1);
  });

  it("runs two complete five-question voice rehearsals with real mic recordings", async () => {
    for (let round = 0; round < 2; round++) {
      if (round) await page.goto(base + "/grad/interview.php?mode=demo");
      await page.locator("#start-voice").click();
      for (let i = 0; i < 5; i++) {
        await page.waitForFunction((count) => (window as any).voiceHarness.utterances.length === count, i + 1);
        if (round === 0 && i === 0) {
          await page.screenshot({ path: fileURLToPath(new URL("../.cache/interview-demo-speaking.png", import.meta.url)) });
        }
        await speechEnd();
        await recognize(longAnswer);
        await page.locator("#submit-answer").click();
      }
      await page.waitForFunction((count) => JSON.parse(localStorage.getItem("tp:reports") || "[]").length === count, round + 1);
      expect((await savedReport()).report.metrics.answeredQuestions).toBe(5);
      await page.waitForFunction(() => (document.querySelector("#audio") as HTMLAudioElement).readyState >= 1);
      const downloading = page.waitForEvent("download");
      await page.locator("#download-audio").click();
      expect(await (await downloading).failure()).toBeNull();
    }
  }, 20000);

  it("keeps the initial page within a mobile viewport", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
