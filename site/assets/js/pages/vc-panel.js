/** Six-round VC rehearsal. Setup and language are pinned; all async effects are guarded. */
(function () {
  'use strict';
  const { $, $$, el, BASE, profile, reports, readJson, language } = TP;
  const content = readJson('vc-content');
  if (!content) return;
  const session = $('#vc-session'); const answer = $('#vc-answer');
  const labels = {
    intro: ['三位投資者，六輪問題。練習用證據、假設與下一步回應質疑。', 'Three investors, six questions. Practise responding with evidence, assumptions and a practical next step.'],
    setup: ['公司與簡短 pitch', 'Company and short pitch'], name: ['公司名稱', 'Company name'], industry: ['行業', 'Industry'], stage: ['階段', 'Stage'], pitch: ['簡短 pitch（必填，最多 1,200 字）', 'Short pitch (required, up to 1,200 characters)'],
    finances: ['以下數字可留空，留空代表未知；自報資料只作練習，不視為已核實財務。', 'Optional figures: blank means unknown. These are self-reported practice inputs, not verified financials.'],
    cac: ['CAC（HK$）', 'CAC (HK$)'], ltv: ['LTV（HK$）', 'LTV (HK$)'], monthlyBurn: ['每月現金消耗（HK$/月）', 'Monthly cash burn (HK$/month)'], runway: ['現金可撐（月）', 'Runway (months)'],
    deck: ['可選：本機 PDF 或貼上 deck 文字', 'Optional: local PDF or pasted deck text'], pdf: ['PDF：最多 10 MB、30 頁；只在本機提取最多 12,000 字', 'PDF: up to 10 MB and 30 pages; extract up to 12,000 characters locally'], preview: ['提取文字預覽／貼上相關內容（可編輯；原始檔案不會上傳或儲存）', 'Extracted preview / paste relevant text (editable; the original file is never uploaded or saved)'],
    consent: ['我同意開始後將以上相關文字及回答傳給 AI；若選 MiniMax，回答錄音片段亦會傳給 MiniMax 作識別。瀏覽器語音識別可能使用瀏覽器供應商的網絡服務。', 'I agree to send the relevant setup text and answers to AI after starting. MiniMax mode also sends answer audio clips to MiniMax for transcription. Browser recognition may use the browser provider’s network service.'],
    notice: ['中文問答用粵語，英文問答用英語；開始時鎖定語言與設定並申請麥克風權限。每題播放完畢後顯示 3 秒倒數，然後自動錄音。戴耳機可減少回音。錄音只包含本機麥克風，請在離開前下載。', 'Chinese questions use Cantonese; English questions use English. Starting locks setup/language and requests microphone permission. Each question is followed by a 3-second countdown, then automatic recording. Use headphones to reduce echo. Recordings contain only the microphone. Download before leaving.'],
    mode: ['語音識別方式', 'Speech recognition mode'], cloud: ['MiniMax 片段識別（最多 60 秒／段）', 'MiniMax clip transcription (up to 60 seconds per clip)'], browser: ['瀏覽器即時識別（如可用）', 'Browser live recognition (when available)'],
    startVoice: ['開始語音練習', 'Start voice practice'], startText: ['開始文字練習', 'Start text practice'], answer: ['你的回答／可修改的字幕', 'Your answer / editable transcript'], submit: ['提交回答', 'Submit answer'], switch: ['改用文字', 'Switch to text'], finish: ['結束面試', 'End interview'], retry: ['重新評分', 'Retry evaluation'], report: ['查看報告', 'View report'], restart: ['再練一次', 'Practise again'],
    answerStart: ['重試麥克風', 'Retry microphone'], answerEnd: ['結束回答', 'End answer'], replay: ['重新播放問題', 'Replay question'],
    recovery: ['錄音未能轉錄。請在上方重建回答並確認內容；未確認前不會評分。原錄音可在下方下載。', 'Audio could not be transcribed. Reconstruct the answer above and confirm its content before grading. Download the original microphone recording below.'],
    recording: ['本機麥克風錄音', 'Local microphone recording'], download: ['下載錄音', 'Download recording'], downloadNote: ['錄音未儲存至報告；離開或重新整理後將失去，請先下載。', 'Audio is not saved in the report and will be lost on leaving or reloading. Download it first.'],
    disclaimer: ['只作內容練習；五個核心維度等權，未完成用戶校準。不是專業投資評估，也不提供法律或財務建議。不評發音、口音、性格、信心或人口特徵。', 'Content coaching only. Five core dimensions have equal weight among assessed dimensions; user calibration is incomplete. This is not a professional investment assessment or legal/financial advice. No pronunciation, accent, personality, confidence or demographic inference.']
  };
  const ui = (zh, en) => language() === 'en' ? en : zh;
  let phase = 'idle'; let epoch = 0; let speechEpoch = 0; let exited = false; let activeVoice = null; let mode = 'text';
  let pinnedLanguage; let context; let startAt = 0; let turns = []; let speakers = [];
  let clarificationUsed = false; let prefix = '';
  let ruleTimer; let submitJob = null; let finishRequested = false; let recoveryRequired = false;
  let evaluationPayload = null; let audioUrl = null; let audioDownloaded = false; let recoveryJob = null;
  let capture = 'ready'; let captureJob = null; let captureEpoch = 0; let micOpened = false;
  let capturedSeconds = 0; let segmentStarted = null;
  let countdownTimer = null; let countdownRemaining = 0; let pendingQuestion = null;
  let pdfEpoch = 0; let pdfAbort = null; let status = { ready: false, shared: {} };
  const requests = new Set();
  const valid = (token) => !exited && token === epoch;
  const seconds = () => Math.max(0, (performance.now() - startAt) / 1000);
  const clearRule = () => { clearInterval(ruleTimer); ruleTimer = null; };
  function clearCountdown() { clearTimeout(countdownTimer); countdownTimer = null; countdownRemaining = 0; $('#vc-countdown').hidden = true; }
  const roleById = (id) => content.panel.roles.find((r) => r.id === id);
  const roleName = (id) => id === 'user' ? ui('創辦人', 'Founder') : roleById(id)?.[language() === 'en' ? 'name' : 'nameYue'] || id;
  const answerDuration = () => capturedSeconds + (segmentStarted === null ? 0 : seconds() - segmentStarted);
  function stopClock() { if (segmentStarted !== null) { capturedSeconds += seconds() - segmentStarted; segmentStarted = null; } }
  function setCapture(next) { capture = next; session.dataset.capture = next; setPhase(phase); }

  async function request(path, payload, token) {
    const abort = new AbortController(); requests.add(abort);
    try {
      const response = await fetch(BASE + 'api/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, _lang: pinnedLanguage }), signal: abort.signal });
      const data = await response.json();
      if (!valid(token)) throw new Error('Cancelled');
      if (!response.ok) throw new Error(data.error || 'Request failed');
      return data;
    } finally { requests.delete(abort); }
  }

  function setPhase(next) {
    phase = next; session.dataset.phase = next;
    $('#vc-phase').textContent = { idle: ui('準備', 'Ready'), speaking: ui('投資者提問', 'Investor speaking'), countdown: ui('準備回答', 'Get ready'), answering: ui('輪到你', 'Your answer'), processing: ui('處理中', 'Processing'), completed: ui('已結束', 'Completed') }[next];
    answer.disabled = next !== 'answering'; answer.readOnly = capture !== 'review' && !recoveryRequired;
    $('#vc-submit').disabled = next !== 'answering' || (mode !== 'text' && capture !== 'review');
    $('#vc-finish').disabled = next === 'completed';
    $('#vc-text-switch').disabled = true;
    $('#vc-answer-controls').hidden = next === 'completed';
    $('#vc-answer-start').hidden = capture !== 'error';
    $('#vc-answer-start').disabled = next !== 'answering' || capture !== 'error' || finishRequested;
    $('#vc-replay').hidden = !pendingQuestion || next !== 'answering' || capture !== 'ready';
    $('#vc-answer-pause').disabled = next !== 'answering' || !['recording', 'paused'].includes(capture) || finishRequested;
    $('#vc-answer-pause').textContent = capture === 'paused' ? ui('繼續', 'Continue') : ui('暫停', 'Pause');
    $('#vc-answer-end').disabled = next !== 'answering' || !['recording', 'paused'].includes(capture) || finishRequested;
    $('#vc-recording-status').textContent = { ready: ui('尚未錄音；題目播放及 3 秒倒數結束後自動開始。', 'Not recording. Capture starts after the question and 3-second countdown.'), opening: ui('正在開啟麥克風……', 'Opening microphone…'), error: ui('麥克風未能使用；請檢查權限後重試。', 'Microphone unavailable. Check permission and retry.'), recording: ui('正在錄音', 'Recording'), flushing: ui('已停止錄音，正在整理字幕……', 'Recording stopped. Preparing transcript…'), paused: ui('已暫停；繼續會保留同一回答與錄音。', 'Paused. Continue keeps the same answer and recording.'), review: ui('回答已結束；請檢查字幕，再提交回答。', 'Answer ended. Review the text, then submit your answer.') }[capture];
  }
  function message(zh, en) { $('#vc-message').textContent = ui(zh, en); }
  function renderLabels() {
    $$('[data-vc-label]').forEach((node) => { node.setAttribute('translate', 'no'); node.textContent = labels[node.dataset.vcLabel][language() === 'en' ? 1 : 0]; });
    for (const role of content.panel.roles) {
      $('[data-vc-name="' + role.id + '"]').textContent = roleName(role.id);
      $('[data-vc-focus="' + role.id + '"]').textContent = role[language() === 'en' ? 'focus' : 'focusYue'];
      const voices = window.speechSynthesis ? VcVoice.eligible(window.speechSynthesis.getVoices(), pinnedLanguage || language()) : [];
      const shared = status.ready ? status.shared?.[pinnedLanguage || language()]?.[role.id] !== false : voices.length < 3;
      $('[data-vc-voice="' + role.id + '"]').textContent = shared ? ui('共用語音；身份由標籤分辨', 'Shared voice; identity shown by label') : ui('角色語音', 'Role voice');
    }
    if (phase === 'idle') {
      const cloud = status.ready && InterviewConversation.CloudVoice.supported(); const browser = VcVoice.Voice.supported();
      $('#vc-provider-status').textContent = cloud ? ui('預設 MiniMax 片段模式；規則在轉錄後檢查。', 'MiniMax clip mode by default; rules are checked after transcription.') : browser ? VcVoice.Voice.recognitionSupported() ? ui('使用瀏覽器即時識別；文字練習暫停開放。', 'Browser live recognition available. Text practice is temporarily disabled.') : ui('可錄音及下載，但此瀏覽器沒有自動字幕；請使用 Chrome 或配置 MiniMax。', 'Recording available but no automatic subtitles. Use Chrome or configure MiniMax.') : ui('此瀏覽器無法錄音；請使用支援麥克風的 Chrome。', 'Microphone recording unavailable. Use Chrome with microphone support.');
    }
    if (phase !== 'idle') {
      $('#vc-language').textContent = ui('本次問答及報告語言：', 'Pinned question/report language: ') + (pinnedLanguage === 'en' ? 'English' : '粵語 / Cantonese');
      $('#vc-round').textContent = ui('主回合 ', 'Main round ') + speakers.length + ' / 6';
      setPhase(phase);
      if (phase === 'countdown') renderCountdown();
    }
  }
  function addTurn(speaker, text, start, end, clarification = false) {
    const previousEnd = turns.length ? turns[turns.length - 1].end : 0;
    const turn = { speaker, text, start: Math.max(previousEnd, start), end: Math.max(previousEnd, start, end) };
    turns.push(turn);
    const attrs = { class: 'vc-turn', 'data-speaker': speaker, translate: 'no' };
    if (clarification) attrs['data-clarification'] = '';
    const node = el('div', attrs, [el('b', {}, roleName(speaker) + (clarification ? ui(' · 規則澄清', ' · Rule clarification') : '')), text]);
    $('#vc-log').append(node); $('#vc-log').scrollTop = $('#vc-log').scrollHeight;
  }
  function activate(speaker) { $$('.vc-investor').forEach((n) => n.classList.toggle('is-active', n.dataset.role === speaker)); }
  function combined(text) { return [prefix, text || ''].filter(Boolean).join(' ').trim().slice(0, 3000); }
  function watchRules() {
    clearRule();
    if (mode !== 'browser') return;
    ruleTimer = setInterval(() => {
      if (phase !== 'answering' || capture !== 'recording') return;
      const cue = VcPanel.cue(answer.value, answerDuration(), pinnedLanguage, clarificationUsed);
      if (cue) void clarify(cue, true);
    }, 1000);
  }
  function renderCountdown() {
    $('#vc-countdown').hidden = false;
    $('#vc-countdown').textContent = ui(countdownRemaining + ' 秒後自動開始錄音，請準備回答', 'Recording starts in ' + countdownRemaining + ' — get ready to answer');
  }
  function listen() {
    clearCountdown(); const token = epoch; const speechToken = speechEpoch;
    countdownRemaining = 3; setPhase('countdown'); renderCountdown();
    $('#vc-countdown').scrollIntoView({ block: 'center', behavior: 'instant' });
    const tick = () => {
      if (!valid(token) || speechToken !== speechEpoch || finishRequested || phase !== 'countdown') { clearCountdown(); return; }
      if (--countdownRemaining > 0) { renderCountdown(); countdownTimer = setTimeout(tick, 1000); return; }
      clearCountdown(); setPhase('answering'); void startCapture();
    };
    countdownTimer = setTimeout(tick, 1000);
  }
  function startCapture(record = true) {
    if (captureJob || finishRequested || (record && phase !== 'answering') || !['ready', 'paused', 'error'].includes(capture)) return;
    if (!activeVoice) createVoice();
    const token = epoch; const generation = captureEpoch; const voice = activeVoice;
    prefix = answer.value.trim(); setCapture('opening');
    const job = (async () => {
      try {
        if (!micOpened) { if (!await voice.openMic()) return false; }
        if (!valid(token) || generation !== captureEpoch || finishRequested) return false;
        micOpened = true;
        if (!record) { setCapture('ready'); return true; }
        voice.listen();
        if (!valid(token) || generation !== captureEpoch || recoveryRequired || finishRequested) return false;
        segmentStarted = seconds(); setCapture('recording'); watchRules();
        if (mode === 'browser' && !VcVoice.Voice.recognitionSupported()) message('錄音中；此瀏覽器沒有自動字幕，結束後請輸入回答。', 'Recording. No automatic subtitles in this browser; type your answer after ending.');
      } catch (error) {
        if (!valid(token) || generation !== captureEpoch || finishRequested) return;
        await closeVoice(); if (!valid(token) || generation !== captureEpoch || finishRequested) return false;
        setCapture('error'); setPhase('answering');
        message('未能開啟麥克風；請允許麥克風權限後重試。文字練習暫停開放。', 'Unable to open microphone. Allow microphone permission and retry. Text practice is disabled.');
        return false;
      }
    })().finally(() => { if (captureJob === job) captureJob = null; });
    captureJob = job; return job;
  }
  function stopCapture(end) {
    if (captureJob || !['recording', 'paused'].includes(capture)) return captureJob;
    if (capture === 'paused' && !end) return;
    const token = epoch; const voice = activeVoice; const wasRecording = capture === 'recording'; stopClock(); clearRule(); setCapture('flushing');
    const job = (async () => {
      try {
        const text = wasRecording ? await voice.stopListening(true) : '';
        if (!valid(token)) return;
        if (text) answer.value = combined(text);
        prefix = answer.value.trim();
        if (end && voice.snapshot) await publishAudio(await voice.snapshot());
        if (!valid(token)) return;
        setCapture(end ? 'review' : 'paused');
      } catch (error) { if (valid(token)) recover(); }
    })().finally(() => { if (captureJob === job) captureJob = null; });
    captureJob = job; return job;
  }
  async function speakQuestion(q, clarification, token) {
    clearCountdown(); const speechToken = ++speechEpoch;
    const start = seconds(); activate(q.speaker); $('#vc-question').textContent = roleName(q.speaker) + ': ' + q.question;
    addTurn(q.speaker, q.question, start, start, clarification);
    setPhase('speaking');
    await playQuestion(q, token, speechToken);
  }
  async function playQuestion(q, token = epoch, speechToken = ++speechEpoch) {
    if (pendingQuestion) message('', '');
    clearCountdown(); pendingQuestion = null; setPhase('speaking');
    const spoke = await activeVoice.speak(q.question, q.speaker);
    if (!valid(token) || speechToken !== speechEpoch || finishRequested) return;
    if (!spoke) {
      pendingQuestion = q; setCapture('ready'); setPhase('answering');
      message('未能播放角色語音；請檢查聲音設定，然後重新播放問題。尚未錄音。', 'Question playback failed. Check audio settings and replay the question. Not recording.'); return;
    }
    listen();
  }
  function fallbackRound() {
    const missing = VcPanel.roles.filter((r) => !speakers.includes(r));
    const eligible = missing.length >= 6 - speakers.length ? missing : VcPanel.roles;
    const q = content.steps[speakers.length];
    const selected = eligible.includes(q.speaker) ? q : content.steps.find((s) => s.speaker === eligible[0]);
    return { source: 'fallback', speaker: selected.speaker, question: selected[pinnedLanguage === 'en' ? 'text' : 'textYue'] };
  }
  function validQuestion(q) {
    const missing = VcPanel.roles.filter((r) => !speakers.includes(r));
    return q && VcPanel.roles.includes(q.speaker) && (missing.length < 6 - speakers.length || missing.includes(q.speaker))
      && typeof q.question === 'string' && q.question.trim() && q.question.length <= 500 && VcPanel.questionCompatible(q.question, pinnedLanguage);
  }
  async function nextRound(token) {
    if (!valid(token)) return;
    if (speakers.length >= 6) { finishRequested = true; return grade(token); }
    setPhase('processing'); message('', '');
    if (recoveryJob) { await recoveryJob; recoveryJob = null; if (!valid(token) || finishRequested) return; }
    if (!micOpened) setCapture('ready');
    if (!micOpened && !await startCapture(false)) return;
    if (!valid(token) || finishRequested) return;
    let q;
    try { q = await request('llm.php', { task: 'vc_panel', vcContext: context, round: speakers.length + 1, speakers: [...speakers], history: turns.slice(-12).map(({ speaker, text }) => ({ speaker, text })) }, token); }
    catch (error) { if (!valid(token)) return; q = fallbackRound(); }
    if (!valid(token) || finishRequested) return;
    if (!validQuestion(q)) q = fallbackRound();
    speakers.push(q.speaker); clarificationUsed = false; prefix = ''; answer.value = '';
    capturedSeconds = 0; segmentStarted = null; setCapture('ready');
    $('#vc-source').textContent = q.source === 'ai' ? ui('AI 主持問題', 'AI moderated question') : ui('後備劇本問題（AI 未連接或回應無效）', 'Script fallback (AI unavailable or invalid response)');
    renderLabels(); await speakQuestion(q, false, token);
  }
  async function clarify(key, live) {
    if (clarificationUsed || phase !== 'answering') return;
    const token = epoch; clarificationUsed = true; clearRule();
    if (live) { await stopCapture(false); if (!valid(token) || finishRequested) return; }
    else { capturedSeconds = 0; segmentStarted = null; setCapture('ready'); }
    if (recoveryJob) { await recoveryJob; recoveryJob = null; if (!valid(token) || finishRequested) return; }
    if (!micOpened && !await startCapture(false)) return;
    const c = content.panel.clarifications[key];
    await speakQuestion({ speaker: c.speaker, question: c[pinnedLanguage === 'en' ? 'text' : 'textYue'] }, true, token);
  }
  function allowStart() {
    const allowed = phase === 'idle' && !exited && $('#consent').checked && $('#pitch').value.trim();
    $('#start-text').disabled = true; $('#start-voice').disabled = !allowed || !VcVoice.Voice.supported();
  }
  async function start() {
    if (phase !== 'idle' || !$('#consent').checked || !$('#pitch').value.trim()) return;
    try {
      const values = { name: $('#vc-name').value, industry: $('#vc-industry').value, stage: $('#vc-stage').value, pitch: $('#pitch').value, deckText: $('#deck-text').value };
      for (const key of ['cac', 'ltv', 'monthlyBurn', 'runway']) values[key] = $('#vc-' + key).value;
      context = VcPanel.context(values);
    } catch (error) { $('#vc-provider-status').textContent = ui('請檢查財務數字：不能負數或超出上限。', 'Check financial figures: no negative or out-of-range values.'); return; }
    mode = $('#vc-speech-mode').value;
    if (!VcVoice.Voice.supported() || (mode === 'cloud' && (!status.ready || !InterviewConversation.CloudVoice.supported()))) return;
    pinnedLanguage = language(); const token = ++epoch; startAt = performance.now();
    pdfAbort?.abort(); ++pdfEpoch;
    $('#vc-setup').querySelectorAll('input,textarea,select,button').forEach((n) => { n.disabled = true; });
    session.hidden = false; setPhase('processing'); renderLabels();
    await nextRound(token);
  }
  function createVoice() {
    const token = epoch;
      activeVoice = new VcVoice.Voice({
        onTranscript(text) {
          if (!valid(token) || !['recording', 'flushing'].includes(capture) || !['answering', 'processing'].includes(phase)) return;
          answer.value = combined(text);
          if (mode === 'browser' && phase === 'answering' && capture === 'recording') {
            const key = VcPanel.cue(answer.value, answerDuration(), pinnedLanguage, clarificationUsed);
            if (key) void clarify(key, true);
          }
        },
        onAnswerEnd() { if (valid(token) && phase === 'answering') void stopCapture(true); },
        onError() { if (valid(token) && phase !== 'completed' && !finishRequested) recover(); }
      }, { mode, language: pinnedLanguage, cloudTts: status.ready, endpoint: BASE + 'api/speech.php', captureUrl: BASE + 'assets/js/interview-capture.js' });
  }
  async function publishAudio(blob) {
    if (!blob?.size || exited) return;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = URL.createObjectURL(blob); audioDownloaded = false; $('#vc-audio').src = audioUrl; $('#vc-download').href = audioUrl;
    $('#vc-download').download = 'vc-microphone.' + InterviewDemo.recordingExtension(blob.type); $('#vc-audio-box').hidden = false;
  }
  async function closeVoice() {
    const voice = activeVoice; if (!voice) return;
    const blob = await voice.closeMic(); if (voice === activeVoice) { activeVoice = null; micOpened = false; }
    await publishAudio(blob);
  }
  function recover() {
    if (recoveryRequired || exited || phase === 'completed') return;
    ++captureEpoch;
    recoveryRequired = true; $('#vc-recovery').hidden = false; $('#vc-recovery-confirm').checked = false;
    finishRequested = false; clearRule(); clearCountdown(); ++speechEpoch;
    stopClock(); setCapture('review'); recoveryJob = closeVoice(); setPhase('answering');
    message('轉錄未完成，請重建回答並確認內容後才提交或評分。', 'Transcription failed. Reconstruct and confirm the answer before submitting or grading.');
  }
  async function submit() {
    if (submitJob || phase !== 'answering') return submitJob;
    if (mode !== 'text' && capture !== 'review') return;
    if (recoveryRequired && (!$('#vc-recovery-confirm').checked || !answer.value.trim())) return;
    const token = epoch; const elapsed = mode === 'text' ? 0 : answerDuration();
    if (!answer.value.trim() && !activeVoice?.hasAudio()) { message('請先回答，不能跳過空白回答。', 'Please answer before advancing.'); return; }
    clearRule(); setPhase('processing');
    submitJob = (async () => {
      const text = answer.value.trim();
      if (!valid(token)) return;
      if (!text) { setPhase('answering'); message('請先檢查或補回回答字幕，不能提交空白回答。', 'Review or restore the answer transcript before submitting.'); return; }
      const cue = VcPanel.cue(text, elapsed, pinnedLanguage, clarificationUsed);
      addTurn('user', text, turns.length ? turns[turns.length - 1].end : 0, seconds());
      answer.value = ''; prefix = '';
      if (recoveryRequired) { recoveryRequired = false; $('#vc-recovery').hidden = true; }
      if (finishRequested) return grade(token);
      if (cue) {
        setPhase('answering');
        message(mode === 'cloud' ? '片段轉錄後觸發規則澄清（不是即時打斷）。' : '規則澄清：可補充你的回答。', mode === 'cloud' ? 'Rule clarification after clip transcription (not a live interruption).' : 'Rule clarification: you can add to your answer.');
        return clarify(cue, false);
      }
      return nextRound(token);
    })();
    try { await submitJob; } finally { submitJob = null; }
  }
  async function finish() {
    if (phase === 'completed' || exited || finishRequested) return;
    if (recoveryRequired && (!$('#vc-recovery-confirm').checked || !answer.value.trim())) {
      message('請先重建並確認未轉錄回答。', 'Reconstruct and confirm the untranscribed answer first.'); return;
    }
    finishRequested = true; clearRule(); clearCountdown(); pendingQuestion = null;
    ++captureEpoch;
    if (capture === 'opening') { void activeVoice?.closeMic(); captureJob = null; setCapture('ready'); }
    if (captureJob) await captureJob;
    if (recoveryRequired && (!$('#vc-recovery-confirm').checked || !answer.value.trim())) { finishRequested = false; return; }
    if (capture === 'recording' || capture === 'paused') await stopCapture(true);
    if ((recoveryRequired && (!$('#vc-recovery-confirm').checked || !answer.value.trim())) || exited) { finishRequested = false; return; }
    if (submitJob) {
      const token = epoch; ++speechEpoch; activeVoice?.cancelSpeech();
      if (!evaluationPayload) requests.forEach((r) => r.abort());
      await submitJob;
      if (valid(token) && phase !== 'completed' && !recoveryRequired) await grade(token);
      return;
    }
    if (answer.value.trim() || (phase === 'answering' && activeVoice?.hasAudio())) {
      ++speechEpoch; activeVoice?.cancelSpeech(); setCapture('review'); setPhase('answering');
      await submit(); return;
    }
    if (recoveryRequired) { finishRequested = false; message('請先重建並確認未轉錄回答。', 'Reconstruct and confirm the untranscribed answer first.'); return; }
    const token = ++epoch; ++speechEpoch; requests.forEach((r) => r.abort()); activeVoice?.cancelSpeech();
    await grade(token);
  }
  async function grade(token) {
    setPhase('processing'); clearRule(); clearCountdown(); await closeVoice(); if (!valid(token)) return;
    activate(null); $('#vc-restart').hidden = false;
    if (!turns.some((t) => t.speaker === 'user')) { setPhase('completed'); message('未有回答，沒有產生評分報告。', 'No answers were submitted, so no report was created.'); return; }
    if (!evaluationPayload) evaluationPayload = { log: { scenarioId: 'hostile_vc_v1', kind: 'voice', steps: [], turns: turns.map((t) => ({ ...t })) }, vcContext: { ...context } };
    try {
      const report = await request('evaluate.php', evaluationPayload, token); if (!valid(token)) return;
      const id = reports.save({ scenarioId: 'hostile_vc_v1', route: 'startup', title: 'Hostile VC', retry: 'startup/vc-panel.php', next: 'startup/index.php', vcPanel: { version: 1, language: pinnedLanguage, rounds: speakers.length } }, report);
      $('#vc-report-link').href = BASE + 'reports.php?id=' + encodeURIComponent(id); $('#vc-report-link').hidden = false; $('#vc-retry').hidden = true;
      message('報告已儲存，錄音請另外下載。', 'Report saved. Download the recording separately.');
    } catch (error) { if (!valid(token)) return; $('#vc-retry').hidden = false; message('暫時未能評分，可用原設定與回答重新評分。', 'Evaluation failed. Retry using the same setup and answers.'); }
    if (valid(token)) setPhase('completed');
  }
  async function readPdf() {
    const file = $('#vc-pdf').files[0]; pdfAbort?.abort(); const token = ++pdfEpoch; const abort = pdfAbort = new AbortController();
    if (!file || phase !== 'idle') return;
    $('#vc-pdf-status').textContent = ui('正在本機提取文字……', 'Extracting text locally…');
    try {
      const pdfjs = await VcPdf.load(BASE);
      const text = await VcPdf.extract(file, pdfjs, () => !exited && phase === 'idle' && token === pdfEpoch, abort.signal);
      if (exited || token !== pdfEpoch || phase !== 'idle') return;
      $('#deck-text').value = text; $('#vc-pdf-status').textContent = ui('已提取；請檢查預覽，最多保留 12,000 字。', 'Extracted. Review the preview; up to 12,000 characters retained.');
    } catch (error) { if (!exited && token === pdfEpoch && phase === 'idle') $('#vc-pdf-status').textContent = ui('無法提取（可能加密、損壞、掃描或超出限制）。請貼上相關文字。', 'Unable to extract (encrypted, malformed, scanned or over limit). Paste relevant text instead.'); }
    finally { if (token === pdfEpoch) $('#vc-pdf').value = ''; }
  }
  const company = profile.startup(); $('#vc-name').value = company.name || ''; $('#vc-industry').value = company.industry || ''; $('#vc-stage').value = company.stage || 'pre_seed';
  $('#pitch').addEventListener('input', allowStart); $('#consent').addEventListener('change', allowStart);
  $('#start-voice').addEventListener('click', () => void start());
  $('#vc-answer-start').addEventListener('click', () => { if (capture !== 'error') return; if (!speakers.length) { setCapture('ready'); void nextRound(epoch); } else void startCapture(); });
  $('#vc-replay').addEventListener('click', () => { if (pendingQuestion && phase === 'answering' && !finishRequested) void playQuestion(pendingQuestion); });
  $('#vc-answer-pause').addEventListener('click', () => { if (capture === 'paused') void startCapture(); else void stopCapture(false); });
  $('#vc-answer-end').addEventListener('click', () => void stopCapture(true));
  $('#vc-submit').addEventListener('click', () => void submit()); $('#vc-finish').addEventListener('click', () => void finish());
  $('#vc-retry').addEventListener('click', () => { if (phase === 'completed' && evaluationPayload) { $('#vc-retry').hidden = true; void grade(++epoch); } });
  $('#vc-pdf').addEventListener('change', () => void readPdf()); $('#vc-download').addEventListener('click', () => { audioDownloaded = true; });
  document.addEventListener('tp:languagechange', renderLabels);
  window.addEventListener('beforeunload', (event) => { if ((phase !== 'idle' && phase !== 'completed') || (audioUrl && !audioDownloaded)) { event.preventDefault(); event.returnValue = ''; } });
  window.addEventListener('pagehide', () => { exited = true; ++epoch; ++pdfEpoch; pdfAbort?.abort(); clearRule(); clearCountdown(); requests.forEach((r) => r.abort()); void activeVoice?.closeMic(); if (audioUrl) URL.revokeObjectURL(audioUrl); $('#vc-audio').removeAttribute('src'); });
  renderLabels(); allowStart();
  fetch(BASE + 'api/speech.php?vc=1').then((r) => r.ok ? r.json() : status).then((s) => {
    if (exited || phase !== 'idle') return; status = s;
    const cloud = status.ready && InterviewConversation.CloudVoice.supported(); const browser = VcVoice.Voice.supported();
    $('#vc-speech-mode option[value="cloud"]').disabled = !cloud; $('#vc-speech-mode option[value="browser"]').disabled = !browser;
    $('#vc-speech-mode').value = cloud ? 'cloud' : 'browser';
    renderLabels(); allowStart();
  }).catch(() => { $('#vc-provider-status').textContent = ui('語音狀態未能載入，請重新整理或使用瀏覽器識別。', 'Speech status unavailable. Reload or use browser recognition.'); });
})();
