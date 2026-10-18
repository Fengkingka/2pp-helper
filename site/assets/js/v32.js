/* Shared profile and action helpers. User text is always rendered as text. */
(function (root) {
  'use strict';
  const clone = x => JSON.parse(JSON.stringify(x));
  const clean = (x, n = 160) => typeof x === 'string' ? x.trim().slice(0, n) : '';
  const ALIASES = {
    python: ['python', 'python 基礎', 'python basics', '基礎 python'],
    excel: ['excel', 'microsoft excel', 'ms excel'],
    sql: ['sql', 'sql 基礎', 'sql basics'],
    powerbi: ['power bi', 'powerbi', 'microsoft power bi'],
    javascript: ['javascript', 'js'], canva: ['canva'], communication: ['communication', '溝通', '溝通技巧']
  };
  function skillId(value) {
    const v = clean(value).toLowerCase().replace(/\s+/g, ' ');
    return Object.keys(ALIASES).find(k => ALIASES[k].includes(v)) || v;
  }
  function fingerprint(p) {
    if (!p) return '';
    const { education = [], strengths, updatedAt, ...rest } = p;
    return JSON.stringify({ ...rest, education: education.map(({ school, ...e }) => e) });
  }
  function normalizeProfile(raw = {}) {
    const p = clone(raw);
    p.version = 2;
    p.careerStage = ['student', 'graduating', 'fresh_grad', 'career_switch'].includes(p.careerStage) ? p.careerStage : 'fresh_grad';
    p.goal = ['explore', 'internship', 'graduate_job', 'interview', 'startup'].includes(p.goal) ? p.goal : 'explore';
    ['education', 'interests', 'skills', 'experiences', 'targetRoles', 'certifications', 'tags'].forEach(k => { if (!Array.isArray(p[k])) p[k] = []; });
    p.education = p.education.map(e => ({ ...e, gradYear: e.gradYear || null }));
    p.skillDetails = p.skills.map(name => ({ name, id: skillId(name), level: (p.skillDetails || []).find(s => skillId(s.name) === skillId(name))?.level || 'learning' }));
    p.preferences = { location: '', arrangement: '', availableFrom: '', language: '', learningHours: '', learningBudget: '', ...p.preferences };
    p.strengths = p.strengths || null;
    return p;
  }
  function comparable(a, b) {
    const x = a.report?.metrics || {}, y = b.report?.metrics || {};
    return a.route === 'grad' && b.route === 'grad' && Number.isInteger(a.practiceLength) && typeof a.language === 'string' && a.scenarioId === b.scenarioId && a.route === b.route && !x.mock && !y.mock
      && x.rubricVersion === y.rubricVersion && x.interviewTrack === y.interviewTrack
      && a.practiceLength === b.practiceLength && a.language === b.language
      && clean(a.interviewContext?.role).toLowerCase() === clean(b.interviewContext?.role).toLowerCase();
  }
  const core = { clone, clean, skillId, fingerprint, normalizeProfile, comparable };
  if (typeof module !== 'undefined') module.exports = core;
  if (!root.TP) return;
  const { store, el, $, language, toast } = root.TP;
  const L = (zh, en) => language() === 'en' ? en : zh;
  function translate() {
    document.querySelectorAll('[data-zh][data-en]').forEach(n => { n.setAttribute('translate', 'no'); n.textContent = language() === 'en' ? n.dataset.en : n.dataset.zh; });
  }
  const actionList = () => store.get('actions', []);
  function addAction(text, opts = {}) {
    const label = clean(text, 300);
    if (!label) return;
    const list = actionList();
    if (!list.some(a => a.text === label && !a.done)) {
      const due = new Date(); due.setDate(due.getDate() + (opts.days || 30));
      list.unshift({ id: 'a' + Date.now().toString(36), text: label, done: false, due: due.toISOString().slice(0, 10), source: opts.source || '', createdAt: new Date().toISOString() });
      store.set('actions', list.slice(0, 100));
    }
    document.dispatchEvent(new Event('tp:actionschange'));
    toast(L('已加入行動清單。', 'Added to your action list.'));
  }
  function renderActions(box) {
    if (!box) return;
    const list = actionList();
    box.replaceChildren(el('h2', {}, L('未來 30／90 日的行動', 'Your next 30 / 90 days')),
      el('p', { class: 'hint' }, L('把建議變成可完成的行動；日期和完成狀態由你決定。', 'Turn advice into actions. You control the dates and completion status.')));
    const form = el('form', { class: 'row no-print' });
    const input = el('input', { class: 'input', maxlength: 300, required: true, 'aria-label': L('新行動', 'New action'), placeholder: L('例如：完成一個 Excel 分析項目', 'Example: complete an Excel analysis project') });
    const period = el('select', { class: 'select', 'aria-label': L('期限', 'Timeframe'), style: { width: 'auto' } }, [el('option', { value: '30' }, L('30 日', '30 days')), el('option', { value: '90' }, L('90 日', '90 days'))]);
    form.append(input, period, el('button', { type: 'submit', class: 'btn btn-primary' }, L('新增', 'Add')));
    form.addEventListener('submit', e => { e.preventDefault(); addAction(input.value, { days: Number(period.value) }); input.value = ''; });
    box.append(form);
    if (!list.length) box.append(el('p', { class: 'hint' }, L('可以從職涯建議或報告儲存行動。', 'Save an action from career advice or a report.')));
    list.forEach(a => {
      const check = el('input', { type: 'checkbox', 'aria-label': a.text }); check.checked = a.done;
      const date = el('input', { type: 'date', class: 'input', value: a.due, 'aria-label': L('完成日期', 'Due date'), style: { width: '160px' } });
      const change = () => { const all = actionList(); const row = all.find(x => x.id === a.id); if (row) { row.done = check.checked; row.due = date.value; store.set('actions', all); } };
      check.addEventListener('change', change); date.addEventListener('change', change);
      const remove = el('button', { type: 'button', class: 'btn btn-sm no-print', onclick: () => { store.set('actions', actionList().filter(x => x.id !== a.id)); document.dispatchEvent(new Event('tp:actionschange')); } }, L('移除', 'Remove'));
      box.append(el('div', { class: 'action-row' }, [check, el('span', { translate: 'no' }, a.text), date, remove]));
    });
  }
  function actionButton(text, source) {
    return el('button', { type: 'button', class: 'btn btn-sm', onclick: () => addAction(text, { source }) }, L('加入行動清單', 'Add to action list'));
  }
  function exportData() {
    const data = { version: 3, fitcheckDraft: store.get('fitcheckDraft'), fitcheckReports: store.get('fitcheckReports', []), exportedAt: new Date().toISOString(), profile: store.get('profile'), cv: store.get('cv'), cvVersions: store.get('cvVersions', []), profileDraft: store.get('profileDraft'), advisor: store.get('advisor'), advisorChat: store.get('advisorChat', []), vcDraft: store.get('vcDraft'), plan: store.get('plan'), actions: actionList(), reports: store.get('reports', []), startup: store.get('startup'), savedOpportunities: store.get('savedOpportunities', []) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = el('a', { href: url, download: '2pp-helper-backup.json' }); a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  root.V32 = { ...core, L, translate, addAction, actionList, renderActions, actionButton, exportData };
  translate(); document.addEventListener('tp:languagechange', translate);
  if (root.TP.demo.active) {
    document.body.prepend(el('div', { class: 'demo-banner no-print', translate: 'no' }, [el('span', {'data-zh':'示範模式：你的原有資料已保留。','data-en':'Demo mode: your original data is preserved.'}), el('button', { class: 'btn btn-sm', 'data-zh':'返回我的資料','data-en':'Return to my data', onclick: () => root.TP.demo.exit() })]));
    translate();
  }
})(typeof window !== 'undefined' ? window : globalThis);
