/** Turn-based speech support: no permanent microphone upload or full-duplex claim. */
(function (root) {
  'use strict';
  class AutoSubmit {
    constructor(submit, delay = 2500) { this.submit = submit; this.delay = delay; this.timer = null; }
    touch() {
      this.clear();
      this.timer = root.setTimeout(() => { this.timer = null; this.submit(); }, this.delay);
    }
    clear() { root.clearTimeout(this.timer); this.timer = null; }
  }

  function wavBlob(chunks, sampleRate) {
    const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const pcm = new Float32Array(length);
    let offset = 0;
    for (const chunk of chunks) { pcm.set(chunk, offset); offset += chunk.length; }
    const rate = 16000;
    const count = Math.floor(length * rate / sampleRate);
    const buffer = new ArrayBuffer(44 + count * 2);
    const view = new DataView(buffer);
    const tag = (at, value) => { for (let i = 0; i < value.length; i++) view.setUint8(at + i, value.charCodeAt(i)); };
    tag(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); tag(8, 'WAVE'); tag(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true); tag(36, 'data'); view.setUint32(40, count * 2, true);
    for (let i = 0; i < count; i++) {
      const begin = Math.floor(i * sampleRate / rate);
      const end = Math.max(begin + 1, Math.floor((i + 1) * sampleRate / rate));
      let sum = 0;
      for (let j = begin; j < end && j < length; j++) sum += pcm[j];
      const sample = Math.max(-1, Math.min(1, sum / (end - begin)));
      view.setInt16(44 + i * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
    }
    return new root.Blob([buffer], { type: 'audio/wav' });
  }

  class CloudVoice extends root.InterviewDemo.Voice {
    constructor(callbacks, options = {}) {
      super(callbacks, options);
      this.endpoint = options.endpoint;
      this.captureUrl = options.captureUrl;
      this.frames = [];
      this.samples = 0;
      this.heardSpeech = false;
      this.request = null;
      this.player = null;
      this.playbackUrl = null;
    }
    static supported() {
      return !!(root.navigator.mediaDevices?.getUserMedia && root.MediaRecorder && root.AudioWorkletNode && root.AudioContext);
    }
    async openMic() {
      if (!await super.openMic()) return false;
      const stream = this.stream;
      try {
        await this.audioCtx.audioWorklet.addModule(this.captureUrl);
        if (stream !== this.stream) return false;
        this.capture = new root.AudioWorkletNode(this.audioCtx, 'interview-capture');
        this.capture.port.onmessage = ({ data }) => {
          if (!this.listening || this.captureFull) return;
          const rms = Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length);
          if (!this.heardSpeech && rms <= 0.02) return;
          this.frames.push(data);
          this.samples += data.length;
          if (rms > 0.02) { this.heardSpeech = true; this.callbacks.onActivity?.(); }
          if (this.samples >= this.audioCtx.sampleRate * 60) {
            this.captureFull = true;
            this.callbacks.onAnswerEnd?.();
          }
        };
        this.captureSource = this.audioCtx.createMediaStreamSource(stream);
        this.captureGain = this.audioCtx.createGain();
        this.captureGain.gain.value = 0;
        this.captureSource.connect(this.capture);
        this.capture.connect(this.captureGain).connect(this.audioCtx.destination);
        return true;
      } catch (error) { await this.closeMic(); throw error; }
    }
    async response(response) {
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Speech service unavailable');
      }
      return response;
    }
    cancelSpeech() {
      this.request?.abort();
      this.request = null;
      if (this.player) { this.player.pause(); this.player.removeAttribute('src'); this.player.load(); this.player = null; }
      if (this.playbackUrl) { root.URL.revokeObjectURL(this.playbackUrl); this.playbackUrl = null; }
      super.cancelSpeech();
    }
    async speak(text) {
      this.stopListening();
      this.cancelSpeech();
      const request = new root.AbortController();
      this.request = request;
      try {
        const response = await this.response(await root.fetch(this.endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: request.signal,
          body: JSON.stringify({ action: 'speak', language: this.language === 'zh-HK' ? 'zh-HK' : 'en', text })
        }));
        const blob = await response.blob();
        if (request.signal.aborted) return false;
        this.playbackUrl = root.URL.createObjectURL(blob);
        const player = this.player = new root.Audio(this.playbackUrl);
        return await new Promise((resolve) => {
          let settled = false;
          const finish = (ok) => {
            if (settled) return;
            settled = true;
            root.clearTimeout(timer);
            this.cancelUtterance = null;
            this.callbacks.onState?.('idle');
            resolve(ok);
          };
          const timer = root.setTimeout(() => { this.cancelSpeech(); finish(false); }, 60000);
          this.cancelUtterance = () => finish(false);
          player.onplaying = () => { if (!settled) this.callbacks.onState?.('speaking'); };
          player.onended = () => finish(true);
          player.onerror = () => finish(false);
          player.play().catch(() => finish(false));
        });
      } catch (error) { return false; }
      finally { if (this.request === request) this.request = null; }
    }
    listen() {
      this.stopListening();
      this.transcript = '';
      this.frames = [];
      this.samples = 0;
      this.heardSpeech = false;
      this.captureFull = false;
      this.listening = true;
    }
    hasAudio() { return this.heardSpeech && this.frames.length > 0; }
    async stopListening(flush = false) {
      this.listening = false;
      const epoch = ++this.recognitionEpoch;
      this.callbacks?.onLevel?.(0);
      if (!flush || !this.hasAudio()) return this.transcript;
      const audio = wavBlob(this.frames, this.audioCtx.sampleRate);
      const request = new root.AbortController();
      this.request?.abort();
      this.request = request;
      const form = new root.FormData();
      form.append('action', 'transcribe');
      form.append('language', this.language === 'zh-HK' ? 'zh-HK' : 'en');
      form.append('file', audio, 'answer.wav');
      try {
        const response = await this.response(await root.fetch(this.endpoint, { method: 'POST', body: form, signal: request.signal }));
        const data = await response.json();
        if (epoch !== this.recognitionEpoch || request.signal.aborted) return this.transcript;
        if (typeof data.text !== 'string' || !data.text.trim()) throw new Error('No speech recognized');
        this.transcript = data.text.trim().slice(0, 3000);
        this.frames = [];
        this.callbacks.onTranscript?.(this.transcript);
        return this.transcript;
      } finally { if (this.request === request) this.request = null; }
    }
    closeMic() {
      this.request?.abort();
      for (const node of [this.captureSource, this.capture, this.captureGain]) {
        try { node?.disconnect(); } catch (error) { /* Already disconnected. */ }
      }
      if (this.capture) this.capture.port.onmessage = null;
      this.captureSource = this.capture = this.captureGain = null;
      this.frames = [];
      return super.closeMic();
    }
  }
  async function buildQuestions(bank, { profile, role, language, industry, seed, localize, request }) {
    let value = seed >>> 0;
    const random = () => { value = (1664525 * value + 1013904223) >>> 0; return value / 4294967296; };
    const labels = language === 'en'
      ? { cv: 'CV question', behavioral: 'Behavioral question', situational: 'Situational question', industry: 'Industry awareness' }
      : { cv: '根據 CV', behavioral: '行為題', situational: '情境題', industry: '行業認知題' };
    const pick = (category, count) => bank.filter((q) => q.type === 'question' && q.category === category)
      .map((q) => ({ q, key: random() })).sort((a, b) => a.key - b.key).slice(0, count)
      .map(({ q }) => ({ ...q, kind: labels[category],
        text: language === 'zh-HK' ? q.textYue || q.text : q.textEn || localize(q.text),
        followUp: language === 'zh-HK' ? q.followUpYue || q.followUp : q.followUpEn || localize(q.followUp || '') }));
    let cv = pick('cv', 2);
    if (profile) {
      try {
        const response = await request('llm.php', { task: 'interview_questions', profile, role }, language);
        const generated = response.questions?.slice(0, 2);
        if (generated?.length === 2 && generated.every((text) => typeof text === 'string' && text.trim())) {
          cv = cv.map((q, i) => ({ ...q, text: generated[i].trim() }));
        }
      } catch (error) { /* The seeded bank keeps the interview available offline. */ }
    }
    return cv.concat(pick('behavioral', 2), pick(industry ? 'industry' : 'situational', 1));
  }
  root.InterviewConversation = { AutoSubmit, wavBlob, CloudVoice, buildQuestions };
})(window);
