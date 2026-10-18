/**
 * AI 面試教練。
 * 語音：暫時用瀏覽器內建的 Web Speech API（Chrome 支援廣東話 zh-HK）。
 * S 選定語音方案（例如 LiveKit 或 realtime API）後，只需替換下面的 Voice 物件，其餘流程不變。
 */
(function () {
  'use strict';
  const { $, el, api, store, profile, reports, toHK, toast, loading, BASE, t, language } = TP;
  const p = profile.get();
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const voiceSupported = !!(SR && 'speechSynthesis' in window && navigator.mediaDevices && window.MediaRecorder);

  const state = {
    mode: 'voice', questions: [], qi: 0, askedFollowUp: false, currentQuestion: '',
    turns: [], voiceTurns: [], answer: '', answerStart: 0, t0: 0, finished: false, busy: false
  };
  const now = () => (performance.now() - state.t0) / 1000;

  /* ---------- 可替換的語音層 ---------- */
  const Voice = {
    recognizer: null, listening: false, stream: null, recorder: null, chunks: [], audioCtx: null, raf: 0,
    pickVoice() {
      const voices = speechSynthesis.getVoices();
      if (language() === 'en') return voices.find((v) => /^en-HK/i.test(v.lang)) || voices.find((v) => /^en-GB/i.test(v.lang)) || voices.find((v) => /^en/i.test(v.lang)) || null;
      return voices.find((v) => /zh-HK|yue/i.test(v.lang)) || voices.find((v) => /zh-TW|zh-Hant/i.test(v.lang)) || voices.find((v) => /^zh/i.test(v.lang)) || null;
    },
    speak(text) {
      return new Promise((resolve) => {
        if (!('speechSynthesis' in window)) return resolve();
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        const v = this.pickVoice();
        if (v) u.voice = v;
        u.lang = v ? v.lang : (language() === 'en' ? 'en-GB' : 'zh-HK');
        u.rate = 1;
        u.onend = u.onerror = () => resolve();
        speechSynthesis.speak(u);
        setTimeout(resolve, Math.max(4000, text.length * 350)); // 保險：某些瀏覽器不會觸發 onend
      });
    },
    async openMic() {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      this.recorder = new MediaRecorder(this.stream);
      this.chunks = [];
      this.recorder.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data); };
      this.recorder.start(1000);
      // 音量條：S 可以用同一個數值驅動角色口型
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        this.audioCtx = new AC();
        const analyser = this.audioCtx.createAnalyser();
        analyser.fftSize = 512;
        this.audioCtx.createMediaStreamSource(this.stream).connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (const d of data) sum += ((d - 128) / 128) ** 2;
          const level = Math.min(1, Math.sqrt(sum / data.length) * 6);
          $('#levels').style.setProperty('--level', this.listening ? level.toFixed(2) : '0');
          this.raf = requestAnimationFrame(tick);
        };
        tick();
      }
    },
    listen(onPartial, onFinal) {
      this.listening = true;
      const r = new SR();
      r.lang = language() === 'en' ? 'en-HK' : 'zh-HK';
      r.continuous = true;
      r.interimResults = true;
      r.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) onFinal(t); else interim += t;
        }
        onPartial(interim);
      };
      r.onend = () => { if (this.listening) { try { r.start(); } catch (err) { /* 已在運行 */ } } };
      r.onerror = (e) => { if (e.error === 'not-allowed') { this.listening = false; toast('未能使用咪高峰。請在瀏覽器網址列允許咪高峰權限，或改用文字作答。', 'error'); } };
      this.recognizer = r;
      r.start();
    },
    stopListening() {
      this.listening = false;
      if (this.recognizer) { try { this.recognizer.stop(); } catch (e) { /* 忽略 */ } }
    },
    closeMic() {
      this.stopListening();
      cancelAnimationFrame(this.raf);
      if ('speechSynthesis' in window) speechSynthesis.cancel();
      return new Promise((resolve) => {
        if (!this.recorder || this.recorder.state === 'inactive') return resolve(null);
        this.recorder.onstop = () => {
          this.stream.getTracks().forEach((t) => t.stop());
          if (this.audioCtx) this.audioCtx.close();
          resolve(this.chunks.length ? new Blob(this.chunks, { type: this.recorder.mimeType || 'audio/webm' }) : null);
        };
        this.recorder.stop();
      });
    }
  };

  /* ---------- 介面 ---------- */
  function setStatus(s) {
    $('#avatar').dataset.state = s;
    $('#status-text').textContent = { speaking: '說話中', listening: '聆聽中', thinking: '思考中', idle: '準備中' }[s] || s;
  }
  let partialBubble = null;
  function addBubble(speaker, text) {
    if (partialBubble) { partialBubble.remove(); partialBubble = null; }
    const b = el('div', { class: 'bubble ' + (speaker === 'user' ? 'me' : 'ai') }, text);
    $('#transcript').append(b);
    $('#transcript').scrollTop = $('#transcript').scrollHeight;
  }
  function showPartial(text) {
    if (!text) return;
    if (!partialBubble) { partialBubble = el('div', { class: 'bubble me partial' }); $('#transcript').append(partialBubble); }
    partialBubble.textContent = state.answer + text;
    $('#transcript').scrollTop = $('#transcript').scrollHeight;
  }
  function renderProgress() {
    const box = $('#progress');
    box.replaceChildren(...state.questions.map((q, i) => el('div', { class: 'stop' + (i < state.qi ? ' done line-on' : '') + (i === state.qi ? ' now' : '') + (i > state.qi ? ' off' : '') }, [
      el('span', { class: 'dot' }), el('span', { class: 'when' }, '第 ' + (i + 1) + ' 題')
    ])));
  }
  function setMode(mode) {
    state.mode = mode;
    $('#voice-ui').hidden = mode !== 'voice';
    $('#text-ui').hidden = mode !== 'text';
    $('#to-text').hidden = mode !== 'voice';
    $('#submit-answer').textContent = mode === 'voice' ? '答完了' : '送出答案';
    if (mode === 'text') {
      Voice.stopListening();
      if (state.answer && !$('#answer').value) $('#answer').value = state.answer.trim();
      setTimeout(() => $('#answer').focus(), 50);
    }
  }

  /* ---------- 題目 ---------- */
  async function buildQuestions(role) {
    const scenario = await api('scenario.php?id=interview_general_v1');
    const bank = scenario.steps.filter((s) => s.type === 'question');
    const seed = Math.floor(Date.now() / 86400000); // 每日換一組題目
    const rand = Engine.engine.seededRandom(seed);
    const pick = (cat, n) => bank.filter((q) => q.category === cat).map((q) => ({ q, k: rand() })).sort((a, b) => a.k - b.k).slice(0, n).map((x) => x.q);
    let cv = pick('cv', 2).map((q) => ({ kind: t('根據 CV'), text: t(q.text), fallbackFollowUp: t(q.followUp) }));
    if (p) {
      try {
        const r = await api('llm.php', { task: 'interview_questions', profile: p, role });
        if (r.questions && r.questions.length >= 2) cv = r.questions.slice(0, 2).map((text) => ({ kind: t('根據 CV'), text: toHK(text) }));
      } catch (e) { /* 用題庫的後備題 */ }
    }
    // 第 2 版：選了「行業認知」題時，第 5 條改為與香港產業發展有關的情境題（附政策卡出處，只評理解，不評立場）
    const last = $('#industry-q').checked && bank.some((q) => q.category === 'industry')
      ? pick('industry', 1).map((q) => ({ kind: t('行業認知題'), text: t(q.text), fallbackFollowUp: t(q.followUp), category: 'industry', policyId: q.policyId }))
      : pick('situational', 1).map((q) => ({ kind: t('情境題'), text: t(q.text), fallbackFollowUp: t(q.followUp) }));
    return cv
      .concat(pick('behavioral', 2).map((q) => ({ kind: t('行為題'), text: t(q.text), fallbackFollowUp: t(q.followUp) })))
      .concat(last);
  }

  async function ask(text, kind) {
    state.currentQuestion = text;
    $('#q-kind').textContent = kind;
    $('#q-text').textContent = text;
    const cur = state.questions[state.qi];
    const card = cur && cur.policyId && window.TPPolicy ? window.TPPolicy.get(cur.policyId) : null;
    $('#q-policy').hidden = !card;
    $('#q-policy').replaceChildren(card ? window.TPPolicy.sourceLine(card) : '');
    const start = now();
    addBubble('coach', text);
    if (state.mode === 'voice') {
      setStatus('speaking');
      await Voice.speak(text);
      if (state.finished) return;
    }
    state.turns.push({ speaker: 'coach', text, start, end: now() });
    state.answer = '';
    state.answerStart = now();
    if (state.mode === 'voice') {
      setStatus('listening');
      Voice.listen((partial) => showPartial(partial), (final) => { state.answer += final; showPartial(' '); });
    }
  }

  async function submitAnswer() {
    if (state.busy || state.finished) return;
    const answer = (state.mode === 'text' ? $('#answer').value : state.answer).trim();
    if (!answer) { toast(state.mode === 'text' ? '請先輸入你的回答。' : '還未聽到你的回答。可以再說一次，或改用文字作答。'); return; }
    state.busy = true;
    Voice.stopListening();
    addBubble('user', answer);
    state.turns.push({ speaker: 'user', text: answer, start: state.answerStart, end: now() });
    if (state.mode === 'voice') state.voiceTurns.push(state.turns.length - 1);
    $('#answer').value = '';
    $('#answer-count').textContent = '0 字';

    const q = state.questions[state.qi];
    if (q.category === 'industry') state.industryAnswered = true;
    let followUp = null;
    if (!state.askedFollowUp) {
      setStatus('thinking');
      try {
        const r = await api('llm.php', { task: 'interview_followup', question: state.currentQuestion, answer });
        followUp = r.followUp ? toHK(r.followUp) : null;
      } catch (e) { followUp = null; }
    }
    state.busy = false;
    if (followUp) {
      state.askedFollowUp = true;
      return ask(followUp, q.kind + '：追問');
    }
    state.qi++;
    state.askedFollowUp = false;
    renderProgress();
    if (state.qi >= state.questions.length) return finish();
    const next = state.questions[state.qi];
    return ask(next.text, next.kind);
  }

  function metrics() {
    const out = { answeredQuestions: Math.min(state.qi, state.questions.length), durationSec: Math.round(now()) };
    // 有答「行業認知」題時，評分器才會評「行業認知」這個選用維度
    if (state.industryAnswered) out.industryQuestions = 1;
    const spoken = state.voiceTurns.map((i) => state.turns[i]);
    if (spoken.length) {
      // 語速和口頭禪只計語音回答，文字回答不計
      const minutes = spoken.reduce((s, t) => s + Math.max(0, t.end - t.start), 0) / 60;
      const chars = (spoken.map((t) => t.text).join('').match(/[\p{Script=Han}A-Za-z0-9]/gu) || []).length;
      if (minutes > 0.1) out.charsPerMin = Math.round(chars / minutes);
      out.fillerTotal = (spoken.map((t) => t.text).join('').match(/即係|跟住|其實|咁樣|嗯|呃|\bum+\b|\buh+\b|\berm+\b|\byou know\b|\blike\b/gi) || []).length;
    }
    return out;
  }

  async function finish() {
    if (state.finished) return;
    state.finished = true;
    const audio = await Voice.closeMic();
    clearInterval(state.timer);
    $('#session').hidden = true;
    $('#done').hidden = false;
    if (audio) {
      const url = URL.createObjectURL(audio);
      $('#audio').src = url;
      $('#download-audio').href = url;
      $('#recording').hidden = false;
    }
    const answered = state.turns.some((t) => t.speaker === 'user');
    const actions = $('#done-actions');
    if (!answered) {
      $('#done-status').replaceChildren(el('p', { class: 'muted' }, '這次沒有作答，所以沒有報告。'));
      actions.replaceChildren(el('a', { class: 'btn btn-primary', href: BASE + 'grad/interview.php' }, '重新開始'));
      return;
    }
    $('#done-status').replaceChildren(loading('正在產生報告……'));
    const role = $('#role').value.trim() || '入門職位';
    const log = { scenarioId: 'interview_general_v1', kind: 'voice', steps: [], turns: state.turns, finalCalc: metrics() };
    try {
      const report = await api('evaluate.php', { log });
      const id = reports.save({ scenarioId: 'interview_general_v1', route: 'grad', title: 'AI 面試：' + role, retry: 'grad/interview.php', next: 'grad/index.php' }, report);
      $('#done-status').replaceChildren(el('p', {}, '報告已儲存在「我的報告」。'));
      actions.replaceChildren(el('a', { class: 'btn btn-primary', href: BASE + 'reports.php?id=' + encodeURIComponent(id) }, '查看報告'), el('a', { class: 'btn', href: BASE + 'grad/interview.php' }, '再練一次'));
    } catch (e) {
      $('#done-status').replaceChildren(el('div', { class: 'banner' }, e.message));
      const retry = el('button', { type: 'button', class: 'btn btn-primary' }, '重新評分');
      retry.addEventListener('click', () => { state.finished = false; $('#done').hidden = true; finishRetry(log); });
      actions.replaceChildren(retry);
    }
  }
  async function finishRetry(log) {
    $('#done').hidden = false;
    $('#done-status').replaceChildren(loading('正在產生報告……'));
    try {
      const report = await api('evaluate.php', { log });
      const id = reports.save({ scenarioId: 'interview_general_v1', route: 'grad', title: 'AI 面試：' + ($('#role').value.trim() || '入門職位'), retry: 'grad/interview.php', next: 'grad/index.php' }, report);
      location.href = BASE + 'reports.php?id=' + encodeURIComponent(id);
    } catch (e) { $('#done-status').replaceChildren(el('div', { class: 'banner' }, e.message)); }
  }

  async function start(mode) {
    const btns = [$('#start-voice'), $('#start-text')];
    btns.forEach((b) => (b.disabled = true));
    $('#start-voice').textContent = '準備中';
    if (mode === 'voice') {
      try { await Voice.openMic(); } catch (e) {
        toast('未能使用咪高峰，已改用文字作答。', 'error');
        mode = 'text';
      }
    }
    try {
      state.questions = await buildQuestions($('#role').value.trim() || '入門職位');
    } catch (e) {
      toast(e.message, 'error');
      btns.forEach((b) => (b.disabled = false));
      $('#start-voice').textContent = '開始';
      return;
    }
    store.set('interviewRole', $('#role').value.trim());
    state.t0 = performance.now();
    $('#idle').hidden = true;
    $('#session').hidden = false;
    $('#timer').hidden = false;
    state.timer = setInterval(() => {
      const s = Math.floor(now());
      $('#timer').textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    }, 1000);
    setMode(mode);
    renderProgress();
    const q = state.questions[0];
    ask(q.text, q.kind);
  }

  /* ---------- 第 2 版：用一個例子展示你的強項 ---------- */
  function strengthTip() {
    const s = p && p.strengths;
    const box = $('#strength-tip');
    if (!s || !s.scores) { box.hidden = true; return; }
    const top = Engine.strengths.rank(s.scores)[0];
    const name = { positivity: ['積極', 'positivity'], dependability: ['可靠', 'dependability'], mastery: ['精進', 'mastery'] }[top];
    box.textContent = language() === 'en'
      ? `Tip: your questionnaire shows ${name[1]} as a relative strength. Prepare one example that shows it.`
      : `提示：你的問卷結果顯示「${name[0]}」是相對突出的強項，準備一個能展示它的例子。`;
    box.hidden = false;
  }
  strengthTip();
  document.addEventListener('tp:languagechange', strengthTip);

  /* ---------- 初始化 ---------- */
  $('#role').value = store.get('interviewRole') || (p && p.targetRoles && p.targetRoles[0]) || '';
  $('#role').placeholder = '例如：Marketing Analyst';
  if (!voiceSupported) {
    $('#voice-note').textContent = '這個瀏覽器不支援語音功能，建議用桌面版 Chrome；你仍然可以用文字作答。';
    $('#start-voice').addEventListener('click', () => start('text'));
  } else {
    $('#voice-note').textContent = p ? '' : '提示：先建立資料，題目會更貼近你的經歷。';
    $('#start-voice').addEventListener('click', () => start('voice'));
  }
  $('#start-text').addEventListener('click', () => start('text'));
  $('#to-text').addEventListener('click', () => setMode('text'));
  $('#submit-answer').addEventListener('click', submitAnswer);
  $('#finish').addEventListener('click', finish);
  $('#answer').addEventListener('input', () => { $('#answer-count').textContent = $('#answer').value.replace(/\s/g, '').length + ' 字'; });
  if ('speechSynthesis' in window) speechSynthesis.getVoices();
})();
