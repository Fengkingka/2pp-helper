/** Guided interviews: optional conversational turns, browser/cloud voice, shared scoring. */
(function () {
  'use strict';
  const { $, el, api, store, profile, reports, toast, loading, BASE } = TP;
  const { Voice, countWords, needsFollowUp, metrics, recordingExtension } = InterviewDemo;
  const conversation = JSON.parse($('#interview-settings')?.textContent || '{}').conversation === true;
  const scenarioId = conversation ? 'interview_general_v1' : 'interview_english_demo_v1';
  const state = {
    phase: 'idle', mode: 'text', generation: 0, starting: false, questions: [], qi: 0, followed: false,
    turns: [], voiceTurns: [], answered: new Set(), answer: '', answerStart: null, committed: false,
    t0: 0, timer: null, log: null, reporting: false, reportId: null, audioUrl: null, downloaded: false, leaving: false,
    language: 'en', provider: 'browser', answerEnd: null, industryAnswered: false,
    interviewContext: null, classification: null, manualTrack: false, assessmentGeneration: 0
  };
  const now = () => Math.max(0, (performance.now() - state.t0) / 1000);
  let draftBubble = null;
  const auto = conversation ? new InterviewConversation.AutoSubmit(() => { if (state.phase === 'waiting' && state.mode === 'voice') void submit(); }) : null;
  const callbacks = {
    onState: (s) => {
      if (state.phase === 'completed') s = 'idle';
      $('#avatar').dataset.state = s;
      $('#status-text').textContent = { idle: '準備中', speaking: conversation ? '面試官提問中' : '英文提問中', listening: conversation ? '聆聽回答' : '聆聽英文回答', thinking: '整理回答中' }[s];
    },
    onTranscript: (text) => {
      if (state.phase !== 'waiting' || state.mode !== 'voice') return;
      if (text && state.answerStart === null) state.answerStart = now();
      state.answer = text;
      showDraft(text);
      if (conversation && text.trim()) auto.touch();
    },
    onActivity: () => {
      if (state.phase !== 'waiting' || state.mode !== 'voice') return;
      if (state.answerStart === null) state.answerStart = now();
      auto?.touch();
    },
    onAnswerEnd: () => { if (state.phase === 'waiting' && state.mode === 'voice') void submit(); },
    onLevel: (level) => $('#levels').style.setProperty('--level', String(level)),
    onError: () => {
      if (state.phase !== 'completed' && state.mode === 'voice') {
        toText(conversation ? '語音暫時不可用；已有字幕已保留，請繼續用文字作答。' : '語音識別或錄音暫時不可用；已有字幕已保留，請繼續用英文文字作答。');
      }
    }
  };
  let voice = new Voice(callbacks);
  const speechSettings = conversation ? api('speech.php').catch(() => ({ provider: 'browser', ready: false })) : Promise.resolve({ provider: 'browser', ready: false });

  function phase(value) {
    state.phase = value;
    if (value !== 'waiting') auto?.clear();
    $('#session').dataset.phase = value;
    $('#submit-answer').disabled = value !== 'waiting';
    $('#to-text').disabled = value === 'submitting' || value === 'completed';
    if (value === 'submitting') voice.callbacks.onState('thinking');
    if (value === 'completed') voice.callbacks.onState('idle');
  }
  function wordCount() {
    $('#answer-count').textContent = conversation && state.language === 'zh-HK'
      ? Array.from($('#answer').value.replace(/\s/g, '')).length + ' 字'
      : countWords($('#answer').value) + ' 個英文詞';
  }
  function mode(value) {
    state.mode = value;
    $('#voice-ui').hidden = value !== 'voice';
    $('#text-ui').hidden = value !== 'text';
    $('#to-text').hidden = value !== 'voice';
    $('#submit-answer').textContent = value === 'voice' ? '答完了' : '送出答案';
  }
  function toText(message) {
    const resume = state.phase === 'submitting' && state.committed;
    if (state.phase === 'completed' || state.mode === 'text' && !resume) return;
    const generation = ++state.generation;
    state.answer = resume ? '' : voice.transcript || state.answer;
    mode('text');
    $('#answer').value = state.answer;
    wordCount();
    void voice.closeMic();
    voice.callbacks.onState('idle');
    phase(resume ? 'submitting' : 'waiting');
    $('#mode-note').textContent = message || (conversation ? '已改用文字作答；咪高峰已停止，已有回答及錄音會保留。' : '已改用英文文字作答；咪高峰已停止，之前的錄音會在完結後提供下載。');
    $('#answer').focus();
    if (resume) void advance(state.turns.findLast((turn) => turn.speaker === 'user').text, generation);
  }
  function bubble(speaker, text) {
    if (draftBubble) { draftBubble.remove(); draftBubble = null; }
    $('#transcript').append(el('div', { class: 'bubble ' + (speaker === 'user' ? 'me' : 'ai'), lang: conversation ? state.language : 'en' }, text));
    $('#transcript').scrollTop = $('#transcript').scrollHeight;
  }
  function showDraft(text) {
    if (!draftBubble) {
      draftBubble = el('div', { class: 'bubble me partial', lang: conversation ? state.language : 'en' });
      $('#transcript').append(draftBubble);
    }
    draftBubble.textContent = text;
    $('#transcript').scrollTop = $('#transcript').scrollHeight;
  }
  function progress() {
    $('#progress').replaceChildren(...state.questions.map((q, i) => el('div', {
      class: 'stop' + (i < state.qi ? ' done line-on' : '') + (i === state.qi ? ' now' : '') + (i > state.qi ? ' off' : '')
    }, [el('span', { class: 'dot' }), el('span', { class: 'when' }, '第 ' + (i + 1) + ' 題')])));
  }
  function startTimer() {
    clearInterval(state.timer);
    state.timer = setInterval(() => {
      const seconds = Math.floor(now());
      $('#timer').textContent = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
    }, 1000);
  }
  async function ask(text, kind) {
    const generation = ++state.generation;
    voice.stopListening();
    voice.transcript = '';
    state.answer = '';
    state.answerStart = null;
    state.answerEnd = null;
    state.committed = false;
    $('#answer').value = '';
    wordCount();
    $('#q-kind').textContent = kind;
    $('#q-text').textContent = text;
    $('#q-text').lang = conversation ? state.language : 'en';
    const card = state.questions[state.qi]?.policyId && window.TPPolicy
      ? window.TPPolicy.get(state.questions[state.qi].policyId) : null;
    $('#q-policy').hidden = !card;
    $('#q-policy').replaceChildren(card ? window.TPPolicy.sourceLine(card) : '');
    bubble('coach', text);
    const turn = { speaker: 'coach', text, start: now(), end: now() };
    state.turns.push(turn);
    phase('speaking');
    if (state.mode === 'voice') {
      const ok = await voice.speak(text);
      turn.end = now();
      if (generation !== state.generation || state.phase === 'completed') return;
      if (!ok) {
        toText(conversation ? '本次語言的朗讀不可用，已改用文字；不會改用普通話或其他語言。' : '英文朗讀暫時不可用，已改用文字。請閱讀問題並用英文回答。');
        return;
      }
    }
    if (generation !== state.generation || state.phase === 'completed') return;
    phase('waiting');
    if (state.mode === 'voice') {
      voice.callbacks.onState('listening');
      voice.listen();
    } else {
      $('#answer').focus();
    }
  }
  function commit(answer, spoken) {
    if (state.committed || !answer.trim()) return;
    state.committed = true;
    const end = state.answerEnd ?? now();
    state.turns.push({ speaker: 'user', text: answer.trim(), start: state.answerStart ?? end, end });
    if (spoken) state.voiceTurns.push(state.turns.length - 1);
    state.answered.add(state.qi);
    if (state.questions[state.qi]?.category === 'industry') state.industryAnswered = true;
    bubble('user', answer.trim());
    state.answer = '';
    $('#answer').value = '';
    wordCount();
  }
  async function submit() {
    if (state.phase !== 'waiting') return;
    const spoken = state.mode === 'voice';
    let answer = (spoken ? state.answer : $('#answer').value).trim();
    if (!answer && !(spoken && state.provider === 'minimax' && voice.hasAudio())) {
      toast(spoken ? '還未聽到回答。請再說一次，或改用文字作答。' : conversation ? '請先輸入回答。' : '請先輸入英文回答。');
      return;
    }
    phase('submitting');
    const generation = ++state.generation;
    if (spoken) {
      if (state.provider === 'minimax') state.answerEnd = now();
      try { answer = (await voice.stopListening(true)).trim() || answer; }
      catch (error) {
        if (generation !== state.generation || state.phase === 'completed') return;
        toText('雲端轉錄未能完成，請用文字補回這個回答。已有錄音會保留。');
        return;
      }
    }
    if (generation !== state.generation || state.phase === 'completed') return;
    if (!answer) { toText('未能識別回答，請改用文字作答。'); return; }
    commit(answer, spoken);
    return advance(answer, generation);
  }
  async function advance(answer, generation) {
    const q = state.questions[state.qi];
    let followUp = null;
    let source = 'fallback';
    if (conversation && !state.followed) {
      try {
        const response = await api('llm.php', { task: 'interview_conversation', question: q.text, answer,
          role: state.interviewContext.role, history: state.turns.map((turn) => ({ role: turn.speaker === 'user' ? 'user' : 'assistant', text: turn.text })) }, state.language);
        if (generation !== state.generation || state.phase === 'completed' || state.leaving) return;
        followUp = typeof response.followUp === 'string' ? response.followUp : null;
        source = response.source;
      } catch (error) {
        if (generation !== state.generation || state.phase === 'completed' || state.leaving) return;
        const short = state.language === 'en' ? countWords(answer) < 30 : Array.from(answer).length < 60;
        followUp = short ? q.followUp : null;
      }
    } else if (!conversation && needsFollowUp(answer, state.followed)) followUp = q.followUp;
    if (followUp) {
      state.followed = true;
      return ask(followUp, q.kind + '：' + (conversation ? source === 'ai' ? 'AI 追問' : '後備追問' : '預設追問'));
    }
    state.qi++;
    state.followed = false;
    progress();
    if (state.qi === state.questions.length) return finish();
    const next = state.questions[state.qi];
    return ask(next.text, next.kind);
  }
  async function evaluate() {
    if (state.reporting || state.reportId || state.leaving) return;
    state.reporting = true;
    $('#done-actions').replaceChildren();
    $('#done-status').replaceChildren(loading('正在產生報告……'));
    try {
      const report = await api('evaluate.php', { log: state.log, ...(conversation ? { interviewContext: state.interviewContext } : {}) }, state.language);
      if (state.leaving) return;
      const isMock = !!report.metrics?.mock;
      const title = conversation ? '對話面試：' : isMock ? '英文面試（示範）：' : '英文面試：';
      const id = reports.save({ scenarioId, route: 'grad', title: title + (conversation ? state.interviewContext.role : $('#role').value.trim() || '入門職位'),
        practiceLength: state.questions.length, language: state.language,
        retry: conversation ? 'grad/interview.php' : 'grad/interview.php?mode=demo', next: 'grad/index.php',
        ...(conversation ? { interviewContext: state.interviewContext, classification: state.classification } : {}) }, report);
      state.reportId = id;
      $('#done-status').replaceChildren(el('p', {}, isMock
        ? conversation ? '流程示範報告已儲存在「我的報告」；未進行能力評分。' : '示範報告已儲存在「我的報告」。尚未連接 AI，分數只按簡單規則估算。'
        : 'AI 評分報告已儲存在「我的報告」。'));
      $('#done-actions').replaceChildren(
        el('a', { class: 'btn btn-primary', href: BASE + 'reports.php?id=' + encodeURIComponent(id) }, '查看報告'),
        el('a', { class: 'btn', href: BASE + 'grad/interview.php' + (conversation ? '' : '?mode=demo') }, '再練一次'));
    } catch (error) {
      if (state.leaving) return;
      $('#done-status').replaceChildren(el('div', { class: 'banner' }, error.message + ' 回答已保留在本頁，可重試評分。'));
      const retry = el('button', { type: 'button', class: 'btn btn-primary', onclick: evaluate }, '重新評分');
      $('#done-actions').replaceChildren(retry);
    } finally { state.reporting = false; }
  }
  async function finish() {
    if (state.phase === 'completed') return;
    // Keep the current visible answer even when the user ends before submitting.
    const spoken = state.mode === 'voice';
    const pending = !state.committed && (state.phase === 'waiting' || state.phase === 'submitting');
    const answer = spoken ? voice.transcript || state.answer : $('#answer').value;
    if (pending) commit(answer, spoken);
    const duration = now();
    ++state.generation;
    phase('completed');
    clearInterval(state.timer);
    $('#finish').disabled = true;
    $('#session').hidden = true;
    $('#done').hidden = false;
    $('#done-status').replaceChildren(loading('正在整理錄音……'));
    state.log = { scenarioId, kind: 'voice', steps: [], turns: state.turns.map((t) => ({ ...t })),
      finalCalc: metrics(state.turns, state.voiceTurns, state.answered.size, duration) };
    if (state.industryAnswered) state.log.finalCalc.industryQuestions = 1;
    if (conversation) state.interviewContext = { ...state.interviewContext,
      answeredCategories: [...new Set([...state.answered].map((i) => state.questions[i].category))] };
    if (conversation && state.language === 'zh-HK') {
      const chars = (text) => Array.from(text.replace(/\s/g, '')).length;
      const spokenTurns = state.voiceTurns.map((i) => state.turns[i]);
      const seconds = spokenTurns.reduce((sum, turn) => sum + Math.max(0, turn.end - turn.start), 0);
      const calc = state.log.finalCalc;
      delete calc.answerWords; delete calc.wordsPerMin; delete calc.fillerWordsEn;
      calc.answerChars = state.turns.filter((turn) => turn.speaker === 'user').reduce((sum, turn) => sum + chars(turn.text), 0);
      if (spokenTurns.length) {
        if (seconds > 0) calc.charsPerMin = Math.round(spokenTurns.reduce((sum, turn) => sum + chars(turn.text), 0) * 60 / seconds);
        calc.fillerTotal = spokenTurns.reduce((sum, turn) => sum + (turn.text.match(/即係|跟住|嗯|呃/g) || []).length, 0);
      }
    }
    await complete(await voice.closeMic());
  }
  async function complete(audio) {
    if (state.leaving) return;
    if (audio && audio.size && !state.audioUrl) {
      state.audioUrl = URL.createObjectURL(audio);
      $('#audio').src = state.audioUrl;
      $('#download-audio').href = state.audioUrl;
      $('#download-audio').download = 'interview-english.' + recordingExtension(audio.type);
      $('#recording').hidden = false;
    }
    if (!state.answered.size) {
      $('#done-status').replaceChildren(el('p', { class: 'muted' }, '這次沒有作答，所以沒有報告。'));
      $('#done-actions').replaceChildren(el('a', { class: 'btn btn-primary', href: BASE + 'grad/interview.php' }, '重新開始'));
      return;
    }
    if (conversation) return reviewAnswers();
    await evaluate();
  }
  function reviewAnswers() {
    const box = el('div', { class: 'stack', translate: 'no', style: { '--gap': '12px' } }, [el('h3', {}, V32.L('評分前檢查回答', 'Review answers before scoring')), el('p', { class: 'hint' }, V32.L('可修正轉錄錯字。修改後不再顯示語速等字幕估算指標；錄音不會改動。', 'Correct transcription errors here. Edited transcripts omit speech-rate estimates; the recording is unchanged.'))]);
    state.log.turns.forEach((turn, i) => {
      if (turn.speaker !== 'user') return;
      const ta = el('textarea', { class: 'textarea', rows: 3, maxlength: 3000, 'aria-label': V32.L('檢查回答 ', 'Review answer ') + (i+1) }); ta.value = turn.text;
      ta.addEventListener('input', () => { turn.text = ta.value; ['wordsPerMin','charsPerMin','fillerWordsEn','fillerTotal'].forEach(k => delete state.log.finalCalc[k]); state.log.finalCalc.transcriptEdited = 1; });
      const question = state.log.turns.slice(0,i).reverse().find(t=>t.speaker!=='user');
      box.append(el('label', { class: 'field' }, [el('span', {}, question?.text || V32.L('回答', 'Answer')), ta]));
    });
    const button = el('button', { type: 'button', class: 'btn btn-primary', onclick: () => {
      if (state.log.turns.some(t=>t.speaker==='user' && !t.text.trim())) { toast(V32.L('回答不可以留空。','Answers cannot be blank.')); return; }
      const text = state.log.turns.filter(t=>t.speaker==='user').map(t=>t.text).join(' ');
      if (state.log.finalCalc.transcriptEdited) {
        if (state.language==='en') state.log.finalCalc.answerWords = countWords(text);
        else state.log.finalCalc.answerChars = Array.from(text.replace(/\s/g,'')).length;
      }
      void evaluate();
    } }, V32.L('確認回答並評分', 'Confirm answers and score'));
    $('#done-status').replaceChildren(box); $('#done-actions').replaceChildren(button);
  }
  async function start(requested) {
    if (state.starting || state.phase !== 'idle') return;
    if (conversation && (!$('#track-confirm').checked || !['graduate', 'experienced'].includes($('#interview-track').value))) return;
    state.language = TP.language();
    if (conversation) {
      state.interviewContext = { version: 2, confirmed: true, track: $('#interview-track').value,
        jobDescription: $('#job-description')?.value.trim().slice(0, 2000) || '',
        role: $('#role').value.trim() || (state.language === 'en' ? 'Entry-level role' : '入門職位'),
        categories: ['cv', 'behavioral', $('#industry-q').checked ? 'industry' : 'situational'], answeredCategories: [] };
      lockContext(true);
    }
    const generation = ++state.generation;
    state.starting = generation;
    $('#start-voice').disabled = $('#start-text').disabled = true;
    $('#start-voice').textContent = '準備中';
    let selected = requested;
    try {
      if (conversation) {
        const settings = await speechSettings;
        if (generation !== state.generation || state.leaving) return;
        state.provider = settings.provider;
        const options = { language: state.language, endpoint: BASE + 'api/speech.php', captureUrl: BASE + 'assets/js/interview-capture.js' };
        const VoiceClass = state.provider === 'minimax' ? InterviewConversation.CloudVoice : Voice;
        voice = new VoiceClass(callbacks, options);
        if (selected === 'voice' && !VoiceClass.supported()) selected = 'text';
        $('#answer').lang = state.language;
        $('#answer').placeholder = state.language === 'en' ? 'Use Situation, Task, Action and Result.' : '講下當時情況、你負責嘅任務、行動同結果。';
        $('#mode-note').textContent = state.provider === 'minimax'
          ? 'MiniMax 雲端語音：每次回答片段會上傳轉錄，停頓後才顯示字幕；只下載本地咪高峰錄音。結束前請先提交回答；尚未轉錄的回答不會計入報告。'
          : '瀏覽器語音：停頓約 2.5 秒自動提交；可按「答完了」。問答語言在開始時鎖定，請戴耳機。';
      }
      // Load first: a failed scenario request must not leave the microphone open.
      const scenario = await api('scenario.php?id=' + scenarioId);
      if (generation !== state.generation || state.leaving) return;
      if (conversation) {
        state.questions = await InterviewConversation.buildQuestions(scenario.steps, {
          profile: interviewExperiences().length ? { experiences: interviewExperiences(), strengths: null } : null,
          role: state.interviewContext.role, language: state.language,
          industry: $('#industry-q').checked, seed: Math.floor(Date.now() / 86400000), localize: TP.t,
          request: (path, body, lang) => api(path, { ...body, jobDescription: state.interviewContext.jobDescription, interviewVersion: 2 }, lang)
        });
      } else {
        const labels = { cv: '經歷題', behavioral: '行為題', situational: '情境題' };
        state.questions = scenario.steps.filter((q) => q.type === 'question').map((q) => ({ ...q, kind: labels[q.category] }));
      }
      if (generation !== state.generation || state.leaving) return;
      if (conversation && $('#practice-length')?.value === '3') state.questions = [state.questions[0], state.questions[2], state.questions[4]].filter(Boolean);
      if (![3, 5].includes(state.questions.length)) throw new Error('示範題庫未準備好，請稍後再試。');
      if (selected === 'voice') {
        try {
          if (!await voice.openMic()) return;
        } catch (error) {
          if (generation !== state.generation || state.leaving) return;
          selected = 'text';
          $('#mode-note').textContent = conversation ? '未能使用咪高峰，已改用文字作答。請檢查瀏覽器權限。' : '未能使用咪高峰，已改用英文文字作答。請檢查瀏覽器權限。';
        }
      }
      if (generation !== state.generation || state.leaving) return;
      state.t0 = performance.now();
      store.set('interviewRole', $('#role').value.trim());
      mode(selected);
      $('#idle').hidden = true;
      $('#session').hidden = false;
      $('#timer').hidden = false;
      startTimer();
      progress();
      await ask(state.questions[0].text, state.questions[0].kind);
    } catch (error) {
      if (generation !== state.generation || state.leaving) return;
      await voice.closeMic();
      if (!state.leaving) {
        toast(error.message, 'error');
        if (conversation) lockContext(false);
        $('#start-voice').disabled = $('#start-text').disabled = false;
        $('#start-voice').textContent = conversation ? '開始對話面試' : '開始英文面試';
      }
    } finally { if (state.starting === generation) state.starting = false; }
  }
  $('#role').value = store.get('interviewRole') || profile.get()?.targetRoles?.[0] || '';
  $('#role').placeholder = '例如：Marketing Analyst';
  function lockContext(locked) {
    for (const selector of ['#role', '#industry-q', '#interview-track', '#track-confirm', '#practice-length', '#job-description']) $(selector).disabled = locked;
  }
  function updateStart() {
    if (!conversation || state.phase !== 'idle' || state.starting) return;
    const ready = $('#track-confirm').checked && ['graduate', 'experienced'].includes($('#interview-track').value);
    $('#start-voice').disabled = $('#start-text').disabled = !ready;
  }
  async function recommendTrack() {
    const generation = ++state.assessmentGeneration;
    // Send only interview-relevant fields; PHP repeats this allowlist at the trust boundary.
    const experiences = interviewExperiences();
    let result;
    try { result = await api('llm.php', { task: 'interview_assess_profile', role: $('#role').value.trim(), cv: { experiences } }); }
    catch { result = { source: 'fallback', track: 'unknown', reason: TP.t('經歷建議暫時不可用，請自行選擇並確認。'), evidence: [] }; }
    if (generation !== state.assessmentGeneration || state.phase !== 'idle' || state.starting || state.leaving) return;
    const track = ['graduate', 'experienced', 'unknown'].includes(result.track) ? result.track : 'unknown';
    const reason = typeof result.reason === 'string' ? result.reason.slice(0, 300) : TP.t('未有足夠經歷證據，請自行選擇並確認。');
    state.classification = { track, source: result.source === 'ai' ? 'ai' : 'fallback', reason };
    const labels = { graduate: TP.t('畢業生／初入職場'), experienced: TP.t('已有工作經驗'), unknown: TP.t('未能確定') };
    const evidence = Array.isArray(result.evidence) ? result.evidence.slice(0, 4).filter((e) => typeof e.quote === 'string').map((e) => e.quote.slice(0, 200)) : [];
    $('#track-recommendation').textContent = (state.classification.source === 'ai' ? TP.t('AI 建議') : TP.t('後備建議')) + '：' + labels[track] + '。' + reason
      + (evidence.length ? ' ' + TP.t('經歷原文') + '：' + evidence.join(' / ') : '');
    if (!state.manualTrack) { $('#interview-track').value = track === 'unknown' ? '' : track; $('#track-confirm').checked = false; }
    updateStart();
  }
  function interviewExperiences() {
    const cv = store.get('cv')?.experiences;
    const source = Array.isArray(cv) && cv.length ? cv : profile.get()?.experiences || [];
    return source.slice(0, 8).map((e) => ({ title: e.title, period: e.period, bullets: (e.bullets || []).slice(0, 8) }));
  }
  if (conversation) {
    $('#interview-track').addEventListener('change', () => { state.manualTrack = true; $('#track-confirm').checked = false; updateStart(); });
    $('#track-confirm').addEventListener('change', updateStart);
    $('#role').addEventListener('change', () => { $('#track-confirm').checked = false; updateStart(); void recommendTrack(); });
    updateStart();
    void recommendTrack();
  }
  function strengthTip() {
    const strengths = profile.get()?.strengths;
    const box = $('#strength-tip');
    if (!conversation || !strengths?.scores) { box.hidden = true; return; }
    const top = Engine.strengths.rank(strengths.scores)[0];
    const name = { positivity: ['積極', 'positivity'], dependability: ['可靠', 'dependability'], mastery: ['精進', 'mastery'] }[top];
    box.textContent = TP.language() === 'en'
      ? `Tip: your questionnaire shows ${name[1]} as a relative strength. Prepare one example that shows it.`
      : `提示：你的問卷結果顯示「${name[0]}」是相對突出的強項，準備一個能展示它的例子。`;
    box.hidden = false;
  }
  strengthTip();
  document.addEventListener('tp:languagechange', strengthTip);
  $('#voice-note').textContent = Voice.supported()
    ? '免費瀏覽器語音；英文識別需要網絡。只錄咪高峰，請戴耳機。'
    : '此瀏覽器不支援完整語音功能，會改用英文文字作答；建議桌面版 Chrome。';
  if (conversation) speechSettings.then((settings) => {
    if (state.phase !== 'idle' || state.starting) return;
    $('#voice-note').textContent = settings.provider === 'minimax'
      ? 'MiniMax 語音已啟用；每次回答會上傳轉錄，停頓後顯示字幕，最長 60 秒自動提交。'
      : 'MiniMax 尚未設定，先用瀏覽器語音。中文需要粵語聲音；沒有時改用文字，不改用普通話。識別需要網絡。';
  });
  $('#start-voice').addEventListener('click', () => start(conversation || Voice.supported() ? 'voice' : 'text'));
  $('#start-text').addEventListener('click', () => start('text'));
  $('#to-text').addEventListener('click', () => toText());
  $('#submit-answer').addEventListener('click', submit);
  $('#finish').addEventListener('click', finish);
  $('#answer').addEventListener('input', () => {
    if ($('#answer').value.trim() && state.answerStart === null) state.answerStart = now();
    wordCount();
  });
  $('#download-audio').addEventListener('click', () => { state.downloaded = true; });
  window.addEventListener('beforeunload', (event) => {
    const active = state.phase !== 'idle' && state.phase !== 'completed';
    if (active || state.audioUrl && !state.downloaded) { event.preventDefault(); event.returnValue = ''; }
  });
  window.addEventListener('pagehide', (event) => {
    state.leaving = true;
    ++state.assessmentGeneration;
    auto?.clear();
    ++state.generation;
    clearInterval(state.timer);
    void voice.closeMic();
    if (!event.persisted && state.audioUrl) URL.revokeObjectURL(state.audioUrl);
  });
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    state.leaving = false;
    if (state.phase === 'idle') {
      state.starting = false;
      if (conversation) { lockContext(false); updateStart(); void recommendTrack(); }
      else $('#start-voice').disabled = $('#start-text').disabled = false;
      $('#start-voice').textContent = conversation ? '開始對話面試' : '開始英文面試';
    } else if (state.phase === 'completed') {
      void voice.closeMic().then(complete);
    } else {
      startTimer();
      toText(conversation ? '頁面已恢復；咪高峰已停止，請用文字繼續作答。' : '頁面已恢復；咪高峰已停止，請用英文文字繼續作答。');
    }
  });
  phase('idle');
})();
