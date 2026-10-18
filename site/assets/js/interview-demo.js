/** English demo voice lifecycle and transcript-based metrics. No cloud SDK or AI calls. */
(function (root) {
  'use strict';

  const countWords = (text) => (text.match(/[A-Za-z0-9]+(?:['’\-][A-Za-z0-9]+)*/g) || []).length;
  const needsFollowUp = (answer, followed) => !followed && countWords(answer) < 30;
  function metrics(turns, voiceTurns, answered, duration) {
    const out = {
      answeredQuestions: answered,
      durationSec: Math.max(0, Math.round(duration)),
      answerWords: turns.filter((t) => t.speaker === 'user').reduce((sum, t) => sum + countWords(t.text), 0)
    };
    const spoken = voiceTurns.map((i) => turns[i]);
    if (spoken.length) {
      const seconds = spoken.reduce((sum, t) => sum + Math.max(0, t.end - t.start), 0);
      const words = spoken.reduce((sum, t) => sum + countWords(t.text), 0);
      if (seconds > 0) out.wordsPerMin = Math.round(words * 60 / seconds);
      out.fillerWordsEn = spoken.reduce((sum, t) => sum + (t.text.match(/\b(?:um|uh|you\s+know|i\s+mean)\b/gi) || []).length, 0);
    }
    return out;
  }
  function recordingExtension(mime) {
    if (/mp4|m4a/i.test(mime)) return 'm4a';
    if (/ogg/i.test(mime)) return 'ogg';
    if (/wav/i.test(mime)) return 'wav';
    return /webm/i.test(mime) ? 'webm' : 'audio';
  }

  class Voice {
    constructor(callbacks, options = {}) {
      this.callbacks = callbacks || {};
      this.language = options.language === 'zh-HK' ? 'zh-HK' : 'en-US';
      this.recognizer = null;
      this.listening = false;
      this.transcript = '';
      this.recognitionEpoch = 0;
      this.micEpoch = 0;
      this.stream = null;
      this.recorder = null;
      this.audioCtx = null;
      this.raf = 0;
      this.recording = null;
      this.closing = null;
      this.cancelUtterance = null;
      this.flush = null;
    }
    static supported() {
      return !!((root.SpeechRecognition || root.webkitSpeechRecognition) && root.speechSynthesis &&
        root.SpeechSynthesisUtterance && root.navigator.mediaDevices?.getUserMedia && root.MediaRecorder);
    }
    cancelSpeech() {
      if (this.cancelUtterance) this.cancelUtterance();
      root.speechSynthesis?.cancel();
    }
    speak(text) {
      this.stopListening();
      this.cancelSpeech();
      return new Promise((resolve) => {
        let settled = false;
        let timer;
        const finish = (ok) => {
          if (settled) return;
          settled = true;
          root.clearTimeout(timer);
          this.cancelUtterance = null;
          this.callbacks.onState?.('idle');
          resolve(ok);
        };
        this.cancelUtterance = () => finish(false);
        try {
          const u = new root.SpeechSynthesisUtterance(text);
          const voices = root.speechSynthesis.getVoices();
          const selected = this.language === 'zh-HK'
            ? voices.find((v) => /^zh[-_]HK$|^yue(?:[-_]|$)/i.test(v.lang))
            : voices.find((v) => /^en-US$/i.test(v.lang)) || voices.find((v) => /^en[-_]/i.test(v.lang));
          if (this.language === 'zh-HK' && !selected) { finish(false); return; }
          if (selected) u.voice = selected;
          u.lang = selected ? selected.lang : this.language;
          u.rate = 1;
          u.onstart = () => { if (!settled) this.callbacks.onState?.('speaking'); };
          u.onend = () => finish(true);
          u.onerror = () => { if (!settled) this.cancelSpeech(); };
          timer = root.setTimeout(() => { if (!settled) this.cancelSpeech(); }, Math.max(8000, text.length * 150));
          root.speechSynthesis.speak(u);
        } catch (error) {
          this.cancelSpeech();
          finish(false);
        }
      });
    }
    async openMic() {
      const epoch = ++this.micEpoch;
      const stream = await root.navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (epoch !== this.micEpoch) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }
      this.stream = stream;
      try {
        const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus']
          .find((type) => root.MediaRecorder.isTypeSupported?.(type));
        this.recorder = new root.MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        this.chunks = [];
        this.recorder.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data); };
        this.recorder.onerror = () => this.callbacks.onError?.('recording');
        this.recorder.start(1000);
      } catch (error) {
        await this.closeMic();
        throw error;
      }
      // Microphone levels visualize the user's voice, never the coach's mouth.
      const AC = root.AudioContext || root.webkitAudioContext;
      if (AC) {
        try {
          this.audioCtx = new AC();
          const analyser = this.audioCtx.createAnalyser();
          analyser.fftSize = 512;
          this.audioCtx.createMediaStreamSource(stream).connect(analyser);
          this.audioCtx.resume().catch(() => {});
          const data = new Uint8Array(analyser.fftSize);
          const tick = () => {
            if (!this.stream) return;
            analyser.getByteTimeDomainData(data);
            const rms = Math.sqrt(data.reduce((sum, d) => sum + ((d - 128) / 128) ** 2, 0) / data.length);
            this.callbacks.onLevel?.(this.listening ? Math.min(1, rms * 6) : 0);
            this.raf = root.requestAnimationFrame(tick);
          };
          tick();
        } catch (error) { /* Metering is optional; recording and recognition still work. */ }
      }
      return true;
    }
    listen() {
      this.stopListening();
      const SR = root.SpeechRecognition || root.webkitSpeechRecognition;
      const r = new SR();
      const epoch = ++this.recognitionEpoch;
      this.recognizer = r;
      this.listening = true;
      this.transcript = '';
      let base = '';
      let endings = 0;
      const valid = () => this.recognizer === r && epoch === this.recognitionEpoch;
      const fail = (error) => {
        if (!valid()) return;
        this.stopListening();
        this.callbacks.onError?.(error);
      };
      r.lang = this.language;
      r.continuous = true;
      r.interimResults = true;
      r.onresult = (e) => {
        if (!valid()) return;
        const parts = [base];
        for (let i = 0; i < e.results.length; i++) parts.push(e.results[i][0].transcript);
        this.transcript = parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, 3000);
        endings = 0;
        this.callbacks.onTranscript?.(this.transcript);
      };
      r.onend = () => {
        if (!valid() || !this.listening) return;
        if (++endings > 3) return fail('recognition-ended');
        base = this.transcript;
        try { r.start(); } catch (error) { fail('recognition-start'); }
      };
      r.onerror = (e) => {
        if (e.error === 'no-speech') return; // onend limits repeated idle restarts.
        fail(e.error || 'recognition');
      };
      try { r.start(); } catch (error) { fail('recognition-start'); }
    }
    stopListening(flush = false) {
      this.listening = false;
      this.callbacks.onLevel?.(0);
      if (this.flush) this.flush();
      const r = this.recognizer;
      if (!r) return Promise.resolve(this.transcript);
      const detach = () => {
        ++this.recognitionEpoch;
        this.recognizer = null;
        r.onend = r.onresult = r.onerror = null;
        try { r.abort(); } catch (error) { /* Already stopped. */ }
      };
      if (!flush) {
        detach();
        return Promise.resolve(this.transcript);
      }
      return new Promise((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          root.clearTimeout(timer);
          this.flush = null;
          const transcript = this.transcript;
          detach();
          resolve(transcript);
        };
        const timer = root.setTimeout(finish, 300);
        this.flush = finish;
        r.onend = r.onerror = finish;
        try { r.stop(); } catch (error) { finish(); }
      });
    }
    closeMic() {
      ++this.micEpoch;
      this.stopListening();
      this.cancelSpeech();
      if (this.closing) return this.closing;
      root.cancelAnimationFrame(this.raf);
      const stream = this.stream;
      const recorder = this.recorder;
      this.stream = this.recorder = null;
      if (this.audioCtx) {
        this.audioCtx.close().catch(() => {});
        this.audioCtx = null;
      }
      const tracks = stream ? stream.getTracks() : [];
      if (!recorder || recorder.state === 'inactive') {
        tracks.forEach((track) => track.stop());
        if (recorder && this.chunks.length) {
          this.recording = new root.Blob(this.chunks, { type: recorder.mimeType || this.chunks[0].type });
        }
        return Promise.resolve(this.recording);
      }
      const pending = new Promise((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          root.clearTimeout(timer);
          recorder.onerror = recorder.onstop = null;
          this.recording = this.chunks.length ? new root.Blob(this.chunks, { type: recorder.mimeType || this.chunks[0].type }) : null;
          resolve(this.recording);
        };
        const timer = root.setTimeout(finish, 2000);
        recorder.onstop = recorder.onerror = finish;
        try { recorder.stop(); } catch (error) { finish(); }
        tracks.forEach((track) => track.stop());
      });
      this.closing = pending;
      pending.then(() => { this.closing = null; });
      return pending;
    }
  }
  root.InterviewDemo = { countWords, needsFollowUp, metrics, recordingExtension, Voice };
})(window);
