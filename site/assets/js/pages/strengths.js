/**
 * 性格與強項問卷（第 2 版）：18 題 IPIP 公有領域題目，每頁 6 題。
 * 程式計分（Engine.strengths.score，反向題轉換後取平均），結果存入 UserProfile.strengths。
 * 只顯示相對高低，不用「好」或「差」；預設不送給 AI。
 */
(function () {
  'use strict';
  const { $, $$, el, store, profile, toast, language, readJson } = TP;
  const q = readJson('questionnaire');
  const pages = Math.ceil(q.items.length / q.pageSize);
  const resumed = J1Journey.resumeQuestionnaire(q, store.get('strengthsDraft'), store.get('strengthsAnswers', {}));
  let page = resumed.page;
  let answers = resumed.answers;
  let retaking = resumed.retaking;
  function saveDraft() {
    store.set('strengthsDraft', { key: J1Journey.questionnaireKey(q), page, answers, retaking });
    store.remove('strengthsAnswers');
  }
  function invalidateAdvisor() { store.remove('advisor'); store.remove('advisorChat'); }
  const en = () => language() === 'en';
  const pick = (o, k) => (en() && o[k + 'En'] ? o[k + 'En'] : o[k]);
  const scaleOf = (key) => q.scales.find((s) => s.key === key);

  /* ---------- 問卷 ---------- */
  function pageItems() { return q.items.slice(page * q.pageSize, (page + 1) * q.pageSize); }
  const answeredCount = () => q.items.filter((it) => answers[it.id]).length;

  function renderQuiz() {
    $('#page-label').textContent = en() ? `Page ${page + 1} of ${pages}` : `第 ${page + 1} 頁，共 ${pages} 頁`;
    $('#answered').textContent = en() ? `${answeredCount()} / ${q.items.length} answered` : `已答 ${answeredCount()} / ${q.items.length}`;
    $('#quiz-route').replaceChildren(...Array.from({ length: pages }, (_, i) => el('div', {
      class: 'stop' + (i < page ? ' done line-on' : '') + (i === page ? ' now' : '') + (i > page ? ' off' : '')
    }, [el('span', { class: 'dot' }), el('span', { class: 'when' }, en() ? `Page ${i + 1}` : `第 ${i + 1} 頁`)])));
    $('#items').replaceChildren(...pageItems().map((it, k) => {
      const n = page * q.pageSize + k + 1;
      return el('fieldset', { class: 'card likert-item', 'data-item': it.id }, [
        el('legend', { class: 'likert-q' }, [el('span', { class: 'mono faint' }, '_' + String(n).padStart(2, '0') + ' '), pick(it, 'text')]),
        el('div', { class: 'likert' }, q.responses.map((r) => el('label', { class: 'likert-opt' }, [
          el('input', { type: 'radio', name: it.id, value: String(r.value), checked: answers[it.id] === r.value ? true : null,
            onchange: () => { answers[it.id] = r.value; saveDraft(); renderCount(); } }),
          el('span', {}, pick(r, 'label'))
        ])))
      ]);
    }));
    $('#prev').disabled = page === 0;
    $('#next').textContent = page === pages - 1 ? (en() ? 'See my results' : '看結果') : (en() ? 'Next page' : '下一頁');
    $('#quiz-error').textContent = '';
  }
  function renderCount() {
    $('#answered').textContent = en() ? `${answeredCount()} / ${q.items.length} answered` : `已答 ${answeredCount()} / ${q.items.length}`;
  }

  /* ---------- 結果 ---------- */
  function renderResult(s) {
    const order = Engine.strengths.rank(s.scores);
    const leaders = J1Journey.strengthLeaders(s.scores);
    const tiedAll = leaders.length === order.length;
    const prominent = (key) => !tiedAll && leaders.includes(key);
    const label = en() ? (leaders.length > 1 ? 'Jointly prominent' : 'Most prominent') : (leaders.length > 1 ? '相對並列突出' : '相對最突出');
    $('#bars').replaceChildren(...order.map((key, i) => {
      const sc = scaleOf(key);
      const v = s.scores[key];
      const filled = Math.round(v);
      return el('div', { class: 'strength-row' + (prominent(key) ? ' top' : '') }, [
        el('span', { class: 'strength-name' }, [el('b', {}, pick(sc, 'label')), en() ? null : el('span', { class: 'mono faint', style: { fontSize: '12px' } }, ' ' + sc.labelEn)]),
        el('span', { class: 'dots', role: 'img', 'aria-label': (en() ? `${v.toFixed(1)} out of 5` : `5 分中的 ${v.toFixed(1)} 分`) },
          Array.from({ length: 5 }, (_, d) => el('i', { class: d < filled ? 'on' : '' }))),
        el('span', { class: 'mono faint', style: { fontSize: '13px' } }, v.toFixed(1)),
        prominent(key) || tiedAll ? el('span', { class: 'tag' + (prominent(key) ? ' tag-accent' : '') }, tiedAll ? (en() ? 'Similar scores' : '分數相若') : label) : el('span')
      ]);
    }));
    $('#taken').textContent = (en() ? 'Completed on ' : '完成日期：') + s.takenAt + (en() ? '. Scores show how the three strengths compare for you; they are not a ranking against other people.' : '。分數只顯示三個強項在你身上的相對高低，不是和其他人比較。');
    $('#explain').replaceChildren(...order.map((key, i) => {
      const sc = scaleOf(key);
      return el('div', { class: 'card stack' + (prominent(key) ? ' strength-top' : ''), style: { '--gap': '8px', gridColumn: i === 0 ? '1 / -1' : null } }, [
        el('b', { style: { color: prominent(key) ? 'var(--accent)' : 'var(--text)' } }, pick(sc, 'label')),
        el('span', { class: 'muted', style: { fontSize: '14px' } }, pick(sc, 'about')),
        el('span', { class: 'hint accent' }, en() ? 'Using it at work' : '在工作中怎樣運用'),
        el('span', { style: { fontSize: '14px' } }, pick(sc, 'work')),
        el('span', { class: 'hint accent' }, en() ? 'For interviews' : '面試準備'),
        el('span', { style: { fontSize: '14px' } }, pick(sc, 'interview'))
      ]);
    }));
    $$('#share button').forEach((b) => b.setAttribute('aria-pressed', (b.dataset.value === 'yes') === !!s.shareWithAI ? 'true' : 'false'));
  }

  function show(which) {
    $('#quiz').hidden = which !== 'quiz';
    $('#result').hidden = which !== 'result';
    $('#need-profile').hidden = which !== 'none';
  }

  function render() {
    const p = profile.get();
    if (!p) { show('none'); return; }
    if (J1Journey.validStrengths(p.strengths) && !retaking) { show('result'); renderResult(p.strengths); return; }
    show('quiz');
    renderQuiz();
  }

  function renderAbout() {
    $('#about-instrument').textContent = (en() ? 'Instrument: ' : '問卷：') + pick(q, 'instrument') + (en() ? ', version ' : '，版本 ') + q.version + (en() ? '. Source: ' : '。出處：') + q.source.citation;
    $('#about-license').textContent = pick(q.source, 'license');
    $('#about-translation').textContent = pick(q, 'translationNote');
    $('#about-items').href = q.source.itemsUrl;
    $('#about-paper').href = q.source.paperUrl;
  }

  /* ---------- 事件 ---------- */
  $('#quiz-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const missing = pageItems().filter((it) => !answers[it.id]);
    if (missing.length) {
      $('#quiz-error').textContent = en() ? `${missing.length} question(s) on this page are not answered yet.` : `這一頁還有 ${missing.length} 題未答。`;
      const first = $(`[data-item="${missing[0].id}"] input`);
      if (first) first.focus();
      return;
    }
    if (page < pages - 1) { page++; saveDraft(); renderQuiz(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const r = Engine.strengths.score(q.items, answers);
    if (!r.complete) { toast(en() ? 'Some questions are not answered yet.' : '還有題目未答。'); return; }
    const p = profile.get();
    p.strengths = {
      instrument: q.instrument, version: q.version, takenAt: new Date().toISOString().slice(0, 10),
      scores: r.scores, shareWithAI: false
    };
    profile.set(p);
    store.remove('strengthsAnswers');
    store.remove('strengthsDraft');
    invalidateAdvisor();
    retaking = false;
    answers = {};
    show('result');
    renderResult(p.strengths);
    toast(en() ? 'Results saved to your profile.' : '結果已儲存到你的資料。');
  });
  $('#prev').addEventListener('click', () => { if (page > 0) { page--; saveDraft(); renderQuiz(); } });
  $('#share').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    const p = profile.get();
    if (!b || !p || !p.strengths) return;
    p.strengths.shareWithAI = b.dataset.value === 'yes';
    profile.set(p);
    invalidateAdvisor();
    renderResult(p.strengths);
    toast(p.strengths.shareWithAI ? (en() ? 'The AI assistant may now refer to your strengths.' : 'AI 助理之後會參考你的強項。') : (en() ? 'Your strengths will not be sent to AI.' : '你的強項不會送給 AI。'));
  });
  $('#retake').addEventListener('click', () => {
    page = 0; answers = {}; retaking = true;
    const p = profile.get();
    if (p && p.strengths) { p.strengths.shareWithAI = false; profile.set(p); }
    invalidateAdvisor(); saveDraft(); show('quiz'); renderQuiz();
  });
  $('#clear-answers').addEventListener('click', () => {
    if (!confirm(en() ? 'Clear the answers for this attempt?' : '清除這次未完成的答案？')) return;
    page = 0; answers = {}; saveDraft(); renderQuiz();
  });
  document.addEventListener('tp:languagechange', () => { renderAbout(); if (!$('#quiz').hidden) renderQuiz(); else render(); });

  renderAbout();
  render();
})();
