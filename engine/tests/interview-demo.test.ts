import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const source = fileURLToPath(new URL("../../site/assets/js/interview-demo.js", import.meta.url));

function setup() {
  const recognizers: any[] = [];
  const utterances: any[] = [];
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] };
  class Recognition {
    onresult: any; onend: any; onerror: any;
    lang = ""; starts = 0;
    constructor() { recognizers.push(this); }
    start() { this.starts++; }
    stop() { this.onend?.(); }
    abort() { this.onend?.(); }
  }
  class Recorder {
    static isTypeSupported(type: string) { return type === "audio/webm;codecs=opus"; }
    state = "inactive"; mimeType = "audio/webm;codecs=opus";
    ondataavailable: any; onstop: any; onerror: any;
    start() { this.state = "recording"; }
    stop() {
      this.state = "inactive";
      this.ondataavailable?.({ data: new Blob(["microphone"], { type: this.mimeType }) });
      this.onstop?.();
    }
  }
  const root: any = {
    SpeechRecognition: Recognition,
    SpeechSynthesisUtterance: class { constructor(public text: string) {} },
    speechSynthesis: {
      getVoices: () => [{ lang: "zh-HK" }, { lang: "en-GB" }, { lang: "en-US" }],
      speak: vi.fn((u) => { utterances.push(u); u.onstart?.(); }),
      cancel: vi.fn()
    },
    navigator: { mediaDevices: { getUserMedia: vi.fn(async () => stream) } },
    MediaRecorder: Recorder, Blob, setTimeout, clearTimeout,
    requestAnimationFrame: vi.fn(() => 1), cancelAnimationFrame: vi.fn()
  };
  if (existsSync(source)) runInNewContext(readFileSync(source, "utf8"), { window: root });
  expect(root.InterviewDemo, "English demo voice/metrics module is missing").toBeDefined();
  const transcript = vi.fn();
  const error = vi.fn();
  const voice = new root.InterviewDemo.Voice({ onTranscript: transcript, onError: error });
  return { root, demo: root.InterviewDemo, voice, recognizers, utterances, track, stream, transcript, error };
}

function result(r: any, entries: [string, boolean][]) {
  r.onresult?.({ resultIndex: 0, results: entries.map(([text, isFinal]) => Object.assign([{ transcript: text }], { isFinal })) });
}

afterEach(() => vi.useRealTimers());

describe("English interview metrics", () => {
  it("counts English words, contractions and numbers but not punctuation or Chinese", () => {
    const { demo } = setup();
    expect(demo.countWords("I'm ready for a 20% year-on-year increase. 中文" )).toBe(7);
    expect(demo.countWords(" ... 中文 ")).toBe(0);
  });
  it("uses a strict 30-word follow-up threshold and never follows up twice", () => {
    const { demo } = setup();
    expect(demo.needsFollowUp("word ".repeat(29), false)).toBe(true);
    expect(demo.needsFollowUp("word ".repeat(30), false)).toBe(false);
    expect(demo.needsFollowUp("short", true)).toBe(false);
  });
  it("counts submitted main questions and excludes text answers from speech metrics", () => {
    const { demo } = setup();
    const turns = [
      { speaker: "coach", text: "Question", start: 0, end: 1 },
      { speaker: "user", text: "Um, I mean we delivered 20 reports", start: 5, end: 35 },
      { speaker: "user", text: "Written answer", start: 36, end: 40 }
    ];
    const metrics = demo.metrics(turns, [1], 1, 40);
    expect(metrics).toMatchObject({ answeredQuestions: 1, durationSec: 40, answerWords: 9, wordsPerMin: 14, fillerWordsEn: 2 });
    expect(demo.metrics(turns, [], 1, 40)).not.toHaveProperty("wordsPerMin");
    expect(demo.metrics(turns, [], 1, 40)).not.toHaveProperty("fillerWordsEn");
  });
  it("does not count filler substrings or cross-answer phrases", () => {
    const { demo } = setup();
    const turns = [
      { speaker: "user", text: "summary humble you", start: 0, end: 1 },
      { speaker: "user", text: "know Uh YOU KNOW I MEAN like", start: 1, end: 3 }
    ];
    expect(demo.metrics(turns, [0, 1], 2, 3).fillerWordsEn).toBe(3);
  });
  it("matches recording extension to its actual MIME type", () => {
    const { demo } = setup();
    expect(demo.recordingExtension("audio/mp4;codecs=mp4a.40.2")).toBe("m4a");
    expect(demo.recordingExtension("audio/ogg;codecs=opus")).toBe("ogg");
    expect(demo.recordingExtension("audio/webm;codecs=opus")).toBe("webm");
  });
});

describe("English browser voice lifecycle", () => {
  it("uses Cantonese recognition and an installed Cantonese voice", async () => {
    const { root, utterances, recognizers } = setup();
    const voice = new root.InterviewDemo.Voice({}, { language: "zh-HK" });
    const speaking = voice.speak("可唔可以介紹一個你做過嘅項目？");
    expect(utterances[0].lang).toBe("zh-HK");
    utterances[0].onend();
    await speaking;
    voice.listen();
    expect(recognizers[0].lang).toBe("zh-HK");
    await voice.closeMic();
  });
  it("does not substitute Mandarin or English when Cantonese speech is unavailable", async () => {
    const { root, utterances } = setup();
    root.speechSynthesis.getVoices = () => [{ lang: "zh-CN" }, { lang: "en-US" }];
    const voice = new root.InterviewDemo.Voice({}, { language: "zh-HK" });
    expect(await voice.speak("講下你嘅經驗。" )).toBe(false);
    expect(utterances).toHaveLength(0);
  });
  it("selects English speech and does not listen until speech finishes", async () => {
    const { voice, utterances, recognizers } = setup();
    const speaking = voice.speak("Tell me about a project.");
    expect(utterances[0].lang).toBe("en-US");
    expect(recognizers).toHaveLength(0);
    utterances[0].onend();
    expect(await speaking).toBe(true);
    voice.listen();
    expect(recognizers[0].lang).toBe("en-US");
    await voice.closeMic();
  });
  it("never chooses a Chinese voice when no English voice is installed", async () => {
    const { root, voice, utterances } = setup();
    root.speechSynthesis.getVoices = () => [{ lang: "zh-HK" }];
    const pending = voice.speak("English question");
    expect(utterances[0].lang).toBe("en-US");
    expect(utterances[0].voice).toBeUndefined();
    utterances[0].onend();
    await pending;
  });
  it("preserves interim results without duplicating repeated final results", async () => {
    const { voice, recognizers, transcript } = setup();
    voice.listen();
    const r = recognizers[0];
    result(r, [["I led", true], ["a project", false]]);
    result(r, [["I led", true], ["a project", true]]);
    expect(transcript.mock.lastCall?.[0]).toBe("I led a project");
    expect(await voice.stopListening(true)).toBe("I led a project");
  });
  it("flushes the last final result when the answer is submitted", async () => {
    const { voice, recognizers } = setup();
    voice.listen();
    const r = recognizers[0];
    result(r, [["draft", false]]);
    r.stop = () => { result(r, [["final answer", true]]); r.onend?.(); };
    expect(await voice.stopListening(true)).toBe("final answer");
  });
  it("stopped recognizers cannot restart or update a newer answer", async () => {
    const { voice, recognizers, transcript } = setup();
    voice.listen();
    const old = recognizers[0];
    const lateEnd = old.onend;
    const lateResult = old.onresult;
    await voice.stopListening();
    voice.listen();
    lateEnd();
    lateResult({ resultIndex: 0, results: [Object.assign([{ transcript: "stale" }], { isFinal: true })] });
    expect(old.starts).toBe(1);
    expect(transcript).not.toHaveBeenCalled();
    await voice.closeMic();
  });
  it("a late flush end event cannot detach a newer recognizer", async () => {
    const { voice, recognizers, transcript } = setup();
    voice.listen();
    let lateEnd!: () => void;
    recognizers[0].stop = () => { lateEnd = recognizers[0].onend; lateEnd(); };
    await voice.stopListening(true);
    voice.listen();
    lateEnd();
    result(recognizers[1], [["current answer", true]]);
    expect(transcript.mock.lastCall?.[0]).toBe("current answer");
    await voice.closeMic();
  });
  it("recognition errors preserve the displayed draft for text fallback", async () => {
    const { voice, recognizers, error } = setup();
    voice.listen();
    result(recognizers[0], [["visible draft", false]]);
    recognizers[0].onerror({ error: "network" });
    expect(error).toHaveBeenCalledWith("network");
    expect(voice.transcript).toBe("visible draft");
    expect(voice.listening).toBe(false);
    await voice.closeMic();
  });
  it("limits repeated unexpected recognition endings", async () => {
    const { voice, recognizers, error } = setup();
    voice.listen();
    const r = recognizers[0];
    for (let i = 0; i < 4; i++) r.onend?.();
    expect(error).toHaveBeenCalledWith("recognition-ended");
    expect(voice.listening).toBe(false);
    await voice.closeMic();
  });
  it("cancellation resolves pending speech and ignores its late events", async () => {
    const { voice, utterances } = setup();
    const pending = voice.speak("Question");
    const lateEnd = utterances[0].onend;
    voice.cancelSpeech();
    expect(await pending).toBe(false);
    lateEnd();
    expect(voice.listening).toBe(false);
  });
  it("a cancelled utterance's late error cannot cancel the next question", async () => {
    const { voice, utterances } = setup();
    const first = voice.speak("First question");
    const lateError = utterances[0].onerror;
    voice.cancelSpeech();
    await first;
    const second = voice.speak("Second question");
    lateError();
    utterances[1].onend();
    expect(await second).toBe(true);
  });
  it("speech timeout cancels playback instead of starting recognition", async () => {
    vi.useFakeTimers();
    const { root, voice } = setup();
    const pending = voice.speak("Question");
    await vi.advanceTimersByTimeAsync(60000);
    expect(await pending).toBe(false);
    expect(root.speechSynthesis.cancel).toHaveBeenCalled();
    expect(voice.listening).toBe(false);
  });
  it("closing the microphone stops tracks and preserves a recording for later finish", async () => {
    const { voice, track } = setup();
    await voice.openMic();
    const recording = await voice.closeMic();
    expect(track.stop).toHaveBeenCalledOnce();
    expect(recording.type).toBe("audio/webm;codecs=opus");
    expect(recording.size).toBeGreaterThan(0);
    expect(await voice.closeMic()).toBe(recording);
  });
  it("keeps audio chunks if the recorder has already become inactive", async () => {
    const { voice, track } = setup();
    await voice.openMic();
    voice.recorder.ondataavailable({ data: new Blob(["saved audio"], { type: "audio/webm" }) });
    voice.recorder.state = "inactive";
    expect((await voice.closeMic())?.size).toBeGreaterThan(0);
    expect(track.stop).toHaveBeenCalledOnce();
  });
  it("releases a mic granted after the page has already been closed", async () => {
    const { root, voice, stream, track } = setup();
    let resolve!: (value: any) => void;
    root.navigator.mediaDevices.getUserMedia = () => new Promise((r) => { resolve = r; });
    const opening = voice.openMic();
    await voice.closeMic();
    resolve(stream);
    expect(await opening).toBe(false);
    expect(track.stop).toHaveBeenCalledOnce();
    expect(voice.stream).toBeNull();
  });
  it("releases tracks even if MediaRecorder construction fails", async () => {
    const { root, voice, track } = setup();
    root.MediaRecorder = class { constructor() { throw new Error("recorder unavailable"); } };
    await expect(voice.openMic()).rejects.toThrow("recorder unavailable");
    expect(track.stop).toHaveBeenCalledOnce();
    expect(voice.stream).toBeNull();
  });
});
