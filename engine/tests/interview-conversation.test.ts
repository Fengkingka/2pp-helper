import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

function setup() {
  const root: any = { setTimeout, clearTimeout, Blob, AbortController, InterviewDemo: { Voice: class {} } };
  const source = fileURLToPath(new URL("../../site/assets/js/interview-conversation.js", import.meta.url));
  if (existsSync(source)) runInNewContext(readFileSync(source, "utf8"), { window: root, Float32Array, ArrayBuffer, DataView, Math });
  expect(root.InterviewConversation, "Conversation speech module is missing").toBeDefined();
  return root.InterviewConversation;
}

function cloudSetup() {
  const players: any[] = [];
  const root: any = {
    setTimeout, clearTimeout, Blob, AbortController, FormData, fetch: vi.fn(), cancelAnimationFrame: vi.fn(),
    navigator: { mediaDevices: { getUserMedia: vi.fn() } }, MediaRecorder: class {},
    AudioWorkletNode: class {}, AudioContext: class {},
    URL: { createObjectURL: vi.fn(() => "blob:speech"), revokeObjectURL: vi.fn() },
    Audio: class {
      onplaying: any; onended: any; onerror: any;
      pause = vi.fn(); load = vi.fn(); removeAttribute = vi.fn();
      constructor(public src: string) { players.push(this); }
      async play() { this.onplaying?.(); }
    }
  };
  for (const name of ["interview-demo", "interview-conversation"]) {
    const path = fileURLToPath(new URL(`../../site/assets/js/${name}.js`, import.meta.url));
    runInNewContext(readFileSync(path, "utf8"), { window: root });
  }
  const onTranscript = vi.fn();
  const onState = vi.fn();
  const voice = new root.InterviewConversation.CloudVoice({ onTranscript, onState }, { endpoint: "/api/speech.php", language: "zh-HK" });
  voice.audioCtx = { sampleRate: 16000, close: vi.fn(async () => {}) };
  const captureAnswer = () => {
    voice.listen();
    voice.frames = [new Float32Array([0.2, 0.3, -0.2])];
    voice.heardSpeech = true;
  };
  return { root, voice, players, onTranscript, onState, captureAnswer };
}
afterEach(() => vi.useRealTimers());

describe("Conversational answer submission", () => {
  it("waits for activity, resets the pause, and submits exactly once", async () => {
    vi.useFakeTimers();
    const { AutoSubmit } = setup();
    const submit = vi.fn();
    const timer = new AutoSubmit(submit, 2500);
    await vi.advanceTimersByTimeAsync(10000);
    expect(submit).not.toHaveBeenCalled();
    timer.touch();
    await vi.advanceTimersByTimeAsync(2000);
    timer.touch();
    await vi.advanceTimersByTimeAsync(2499);
    expect(submit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(submit).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(10000);
    expect(submit).toHaveBeenCalledOnce();
  });
  it("cancels a pending answer when text fallback or finish clears the timer", async () => {
    vi.useFakeTimers();
    const { AutoSubmit } = setup();
    const submit = vi.fn();
    const timer = new AutoSubmit(submit, 2500);
    timer.touch();
    timer.clear();
    await vi.advanceTimersByTimeAsync(10000);
    expect(submit).not.toHaveBeenCalled();
  });
  it("encodes a valid mono WAV without requiring a WebM conversion service", async () => {
    const { wavBlob } = setup();
    const blob = wavBlob([new Float32Array([0, 0.5, -0.5, 1])], 16000);
    const bytes = await blob.arrayBuffer();
    const view = new DataView(bytes);
    expect(blob.type).toBe("audio/wav");
    expect(bytes.byteLength).toBe(52);
    expect(view.getUint32(0, false)).toBe(0x52494646);
    expect(view.getUint32(8, false)).toBe(0x57415645);
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getInt16(46, true)).toBe(16384);
    expect(view.getInt16(48, true)).toBe(-16384);
  });
});

describe("Optional cloud speech lifecycle", () => {
  it("supports cloud speech without browser SpeechRecognition", () => {
    const { root } = cloudSetup();
    expect(root.SpeechRecognition).toBeUndefined();
    expect(root.InterviewConversation.CloudVoice.supported()).toBe(true);
  });
  it("does not lock an unanswered question after a minute of microphone silence", async () => {
    const { root, voice } = cloudSetup();
    const node = () => ({ connect: vi.fn(function (this: any) { return this; }), disconnect: vi.fn(), gain: { value: 1 } });
    root.InterviewDemo.Voice.prototype.openMic = async function () { this.stream = {}; return true; };
    Object.assign(voice.audioCtx, { audioWorklet: { addModule: vi.fn(async () => {}) }, createMediaStreamSource: node, createGain: node });
    root.AudioWorkletNode = class { port: any = {}; connect = vi.fn((target) => target); };
    const end = voice.callbacks.onAnswerEnd = vi.fn();
    await voice.openMic();
    voice.listen();
    for (let i = 0; i < 480; i++) voice.capture.port.onmessage({ data: new Float32Array(2000) });
    expect(end).not.toHaveBeenCalled();
    expect(voice.frames).toHaveLength(0);
    voice.capture.port.onmessage({ data: new Float32Array(2000).fill(0.2) });
    expect(voice.hasAudio()).toBe(true);
  });
  it("uploads a Cantonese mono WAV and commits only the returned transcript", async () => {
    const { root, voice, onTranscript, captureAnswer } = cloudSetup();
    root.fetch.mockResolvedValue({ ok: true, json: async () => ({ text: " 我整咗報表。 " }) });
    captureAnswer();
    expect(await voice.stopListening(true)).toBe("我整咗報表。");
    const form = root.fetch.mock.calls[0][1].body;
    expect(form.get("action")).toBe("transcribe");
    expect(form.get("language")).toBe("zh-HK");
    expect(form.get("file").type).toBe("audio/wav");
    expect(form.get("file").name).toBe("answer.wav");
    expect(onTranscript).toHaveBeenCalledExactlyOnceWith("我整咗報表。");
    expect(voice.frames).toEqual([]);
  });
  it("ignores transcription returned after finish closes the microphone", async () => {
    const { root, voice, onTranscript, captureAnswer } = cloudSetup();
    let release!: (value: any) => void;
    root.fetch.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    captureAnswer();
    const transcribing = voice.stopListening(true);
    const signal = root.fetch.mock.calls[0][1].signal;
    await voice.closeMic();
    expect(signal.aborted).toBe(true);
    release({ ok: true, json: async () => ({ text: "Late transcript" }) });
    expect(await transcribing).toBe("");
    expect(onTranscript).not.toHaveBeenCalled();
  });
  it("keeps earlier text when the transcription service fails", async () => {
    const { root, voice, captureAnswer } = cloudSetup();
    root.fetch.mockResolvedValue({ ok: false, json: async () => ({ error: "Speech service unavailable" }) });
    captureAnswer();
    voice.transcript = "Earlier answer";
    await expect(voice.stopListening(true)).rejects.toThrow("Speech service unavailable");
    expect(voice.transcript).toBe("Earlier answer");
    expect(voice.request).toBeNull();
  });
  it("never plays a synthesis response delivered after cancellation", async () => {
    const { root, voice, players } = cloudSetup();
    let release!: (value: any) => void;
    root.fetch.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    const speaking = voice.speak("可唔可以介紹下？");
    voice.cancelSpeech();
    release({ ok: true, blob: async () => new Blob(["audio"], { type: "audio/mpeg" }) });
    expect(await speaking).toBe(false);
    expect(players).toHaveLength(0);
    expect(root.URL.createObjectURL).not.toHaveBeenCalled();
  });
  it("uses playback events for speaking state and releases audio on close", async () => {
    const { root, voice, players, onState } = cloudSetup();
    root.fetch.mockResolvedValue({ ok: true, blob: async () => new Blob(["audio"], { type: "audio/mpeg" }) });
    const speaking = voice.speak("講下你嘅貢獻。");
    await vi.waitFor(() => expect(players).toHaveLength(1));
    expect(JSON.parse(root.fetch.mock.calls[0][1].body).language).toBe("zh-HK");
    expect(onState).toHaveBeenCalledWith("speaking");
    players[0].onended();
    expect(await speaking).toBe(true);
    await voice.closeMic();
    expect(players[0].pause).toHaveBeenCalled();
    expect(root.URL.revokeObjectURL).toHaveBeenCalledWith("blob:speech");
  });
});
