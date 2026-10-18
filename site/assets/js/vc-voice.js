/** VC input/output composition. Existing interview voice implementations are untouched. */
(function (root) {
  'use strict';
  const roles = ['numbers', 'vision', 'legal'];
  const eligible = (voices, language) => voices.filter((v) => language === 'zh-HK' ? /^zh[-_]HK$|^yue(?:[-_]|$)/i.test(v.lang) : /^en(?:[-_]|$)/i.test(v.lang));

  class BrowserOutput extends root.InterviewDemo.Voice {
    speakRole(text, speaker) {
      this.cancelSpeech();
      return new Promise((resolve) => {
        let settled = false; let timer;
        const finish = (ok) => { if (settled) return; settled = true; root.clearTimeout(timer); this.cancelUtterance = null; this.callbacks.onState?.('idle'); resolve(ok); };
        this.cancelUtterance = () => finish(false);
        try {
          const voices = eligible(root.speechSynthesis.getVoices(), this.language === 'zh-HK' ? 'zh-HK' : 'en');
          if (!voices.length) { finish(false); return; }
          const u = new root.SpeechSynthesisUtterance(text);
          u.voice = voices[roles.indexOf(speaker) % voices.length]; u.lang = u.voice.lang; u.rate = 1;
          u.onstart = () => { if (!settled) this.callbacks.onState?.('speaking'); };
          u.onend = () => finish(true); u.onerror = () => finish(false);
          timer = root.setTimeout(() => this.cancelSpeech(), Math.max(8000, text.length * 150));
          root.speechSynthesis.speak(u);
        } catch (error) { finish(false); }
      });
    }
  }

  class Voice {
    static supported() { return !!(root.navigator.mediaDevices?.getUserMedia && root.MediaRecorder); }
    static recognitionSupported() { return !!(root.SpeechRecognition || root.webkitSpeechRecognition); }
    constructor(callbacks, options) {
      this.callbacks = callbacks || {}; this.options = options; this.mode = options.mode;
      const Input = options.mode === 'cloud' ? root.InterviewConversation.CloudVoice : root.InterviewDemo.Voice;
      this.input = new Input(callbacks, options);
      this.output = new BrowserOutput({ onState: callbacks.onState }, options);
      this.request = null; this.player = null; this.url = null; this.cancelPlay = null;
    }
    get transcript() { return this.input.transcript; }
    get recording() { return this.input.recording; }
    get duration() { return this.mode === 'cloud' && this.input.audioCtx ? this.input.samples / this.input.audioCtx.sampleRate : 0; }
    async openMic() {
      const opened = await this.input.openMic();
      this.gateCapture(false);
      return opened;
    }
    gateCapture(enabled) {
      this.input.stream?.getAudioTracks().forEach((track) => { track.enabled = enabled; });
      const recorder = this.input.recorder;
      if (!enabled && recorder?.state === 'recording') recorder.pause();
      if (enabled && recorder?.state === 'paused') recorder.resume();
    }
    listen() {
      this.gateCapture(true);
      if (this.mode === 'cloud' || Voice.recognitionSupported()) this.input.listen();
    }
    hasAudio() { return this.mode === 'cloud' ? this.input.hasAudio() : !!this.input.transcript.trim(); }
    stopListening(flush = false) { this.gateCapture(false); return this.input.stopListening(flush); }
    async snapshot() {
      const recorder = this.input.recorder;
      if (!recorder || recorder.state === 'inactive') return this.recording;
      await new Promise((resolve) => { recorder.addEventListener('dataavailable', resolve, { once: true }); recorder.requestData(); });
      return this.input.chunks.length ? new root.Blob(this.input.chunks, { type: recorder.mimeType || this.input.chunks[0].type }) : null;
    }
    cancelSpeech() {
      this.request?.abort(); this.request = null;
      this.cancelPlay?.(); this.cancelPlay = null;
      if (this.player) { this.player.pause(); this.player.removeAttribute('src'); this.player.load(); this.player = null; }
      if (this.url) { root.URL.revokeObjectURL(this.url); this.url = null; }
      this.output.cancelSpeech();
    }
    async speak(text, speaker) {
      if (!roles.includes(speaker)) throw new Error('Invalid VC speaker');
      this.cancelSpeech();
      if (!this.options.cloudTts) return this.output.speakRole(text, speaker);
      const request = new root.AbortController(); this.request = request;
      try {
        const response = await root.fetch(this.options.endpoint, { method: 'POST', signal: request.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'speak', language: this.options.language === 'zh-HK' ? 'zh-HK' : 'en', text, speaker }) });
        if (!response.ok) return false;
        const blob = await response.blob(); if (request.signal.aborted) return false;
        this.url = root.URL.createObjectURL(blob); const player = this.player = new root.Audio(this.url);
        return await new Promise((resolve) => {
          let settled = false;
          const finish = (ok) => { if (settled) return; settled = true; root.clearTimeout(timer); this.cancelPlay = null; this.callbacks.onState?.('idle'); resolve(ok); };
          const timer = root.setTimeout(() => { this.cancelSpeech(); finish(false); }, 60000);
          this.cancelPlay = () => finish(false);
          player.onplaying = () => { if (!settled) this.callbacks.onState?.('speaking'); };
          player.onended = () => finish(true); player.onerror = () => finish(false);
          player.play().catch(() => finish(false));
        });
      } catch (error) { return false; }
      finally { if (this.request === request) this.request = null; }
    }
    async closeMic() { this.cancelSpeech(); return this.input.closeMic(); }
  }
  root.VcVoice = { Voice, eligible };
})(window);
