/**
 * 我的五年規劃（第 2 版）：把選定的職涯路徑變成 2026 至 2030 年的個人規劃（PersonalPlan，存在 tp:plan）。
 * 結構借用香港五年規劃「五年規劃統領、年度落實、年度述職」：願景 → 核心目標 → 每年的里程碑 → 年度檢討。
 * AI 只提出初稿；里程碑的進度由程式計算（Engine.plan），與報告頁的分數一致。
 */
(function () {
  'use strict';
  const { $, $$, el, api, store, profile, reports, toast, loading, language, readJson, toHK, BASE } = TP;
  const Policy = window.TPPolicy;
  const roles = readJson('roles') || [];
  let YEARS = [2026, 2027, 2028, 2029, 2030];
  let THIS_YEAR = new Date().getFullYear();
  const MAX_GOALS = 5;
  const MAX_PER_YEAR = 3;
  const SCENARIOS = { interview_general_v1: ['AI 面試', 'AI interview', 'grad/interview.php'] };
  const en = () => language() === 'en';
  const L = (zh, english) => (en() ? english : zh);
  const STATUS = { earned: ['已取得', 'Earned'], in_progress: ['進行中', 'In progress'], planned: ['計劃考取', 'Planned'] };

  let plan = store.get('plan');
  function setHorizon(from) { YEARS = Array.from({ length: 5 }, (_, i) => from + i); THIS_YEAR = Math.max(from, Math.min(from + 4, new Date().getFullYear())); }
  if (TP.demo.active && !plan) { plan = demoPlan(); store.set('plan', plan); }
  setHorizon(plan?.horizon?.[0] || new Date().getFullYear());
  $('#start-year').value = new Date().getFullYear();
  const actions = () => V32.renderActions($('#near-actions'));
  actions(); document.addEventListener('tp:actionschange', actions); document.addEventListener('tp:languagechange', actions);
  let year = THIS_YEAR;
  let editing = false;
  const params = new URLSearchParams(location.search);

  const certs = () => ((profile.get() || {}).certifications || []);
  const ctx = () => ({ reports: reports.list(), certifications: certs() });
  const nextId = (prefix, list) => prefix + (list.reduce((m, x) => Math.max(m, Number(String(x.id).replace(/\D/g, '')) || 0), 0) + 1);
  const goalNo = (id) => plan.goals.findIndex((g) => g.id === id) + 1;
  const perYear = (y) => plan.milestones.filter((m) => m.year === y);

  function save() {
    store.set('plan', plan);
  }

  /* ---------------------------------------------------------------- 建立初稿 */
  function renderSetup() {
    const cached = store.get('advisor');
    const paths = ((cached && cached.paths) || []).map((x) => ({ id: x.id, name: x.name }));
    const wanted = params.get('path');
    // 由職涯方向助理的「把這條路徑變成我的五年規劃」進入時，路徑一定在選項之中
    const wantedRole = roles.find((r) => r.id === wanted);
    if (wantedRole && !paths.some((x) => x.id === wanted)) paths.unshift({ id: wantedRole.id, name: wantedRole.name });
    const box = $('#path-choices');
    box.replaceChildren(...paths.map((x, i) => el('button', {
      type: 'button', class: 'chip', 'data-id': x.id,
      'aria-pressed': (wanted ? x.id === wanted : i === 0) ? 'true' : 'false',
      onclick: (e) => { $$('button', box).forEach((b) => b.setAttribute('aria-pressed', b === e.currentTarget ? 'true' : 'false')); $('#role-name').value = ''; }
    }, x.name)));
    $('#no-paths').hidden = paths.length > 0;
    const card = Policy.get('fyp_mechanism');
    $('#setup-policy').replaceChildren(card ? Policy.card(card) : '');
  }

  function fromDraft(d) {
    const goals = d.goals.map((g, i) => ({ id: 'g' + (i + 1), text: toHK(g.text), policyIds: g.policyIds || [] }));
    const next = {
      version: 1, horizon: [YEARS[0], YEARS[4]], vision: toHK(d.vision), pathId: d.roleId, pathName: d.roleName, pathNameEn: d.roleNameEn,
      goals, milestones: [], reviews: [], draftSource: d.source
    };
    // 由程式加上：今年完成 3 次模擬面試，平均 4 分以上（數字可以自行修改，進度從報告計算）
    next.milestones.push({ id: 'm1', year: THIS_YEAR, goalId: goals[0] ? goals[0].id : null, text: L('完成 3 次模擬面試，平均 4 分以上', 'Complete 3 mock interviews averaging 4 or above'),
      metric: { type: 'reports', scenarioId: 'interview_general_v1', count: 3, minAvg: 4 }, done: false });
    d.milestones.forEach((m) => {
      if (next.milestones.filter((x) => x.year === m.year).length >= MAX_PER_YEAR) return;
      next.milestones.push({ id: nextId('m', next.milestones), year: m.year, goalId: goals[m.goalIndex] ? goals[m.goalIndex].id : null, text: toHK(m.text), metric: { type: 'manual' }, done: false });
    });
    addCertDrafts(next);
    return next;
  }

  /** 「計劃考取」的專業資格 → 里程碑草稿（每年最多 3 個）。 */
  function addCertDrafts(target) {
    const drafts = Engine.plan.certMilestoneDrafts(target, certs());
    let added = 0;
    drafts.forEach((m) => {
      if (target.milestones.filter((x) => x.year === m.year).length >= MAX_PER_YEAR) return;
      const g = target.goals.find((x) => /證書|資格|技能|skill|cert/i.test(x.text));
      target.milestones.push({ ...m, id: nextId('m', target.milestones), text: en() ? m.text.replace(/^考取 /, 'Earn ') : m.text, goalId: g ? g.id : null });
      added++;
    });
    return added;
  }

  function demoPlan() {
    // 示範內容以中文儲存；英文模式下由 i18n 的對照表顯示英文
    const d = JSON.parse(JSON.stringify(Engine.demo.plan));
    d.pathName = '市場數據分析';
    d.pathNameEn = 'Marketing Analyst';
    return d;
  }

  $('#setup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const chosen = $('#path-choices button[aria-pressed="true"]');
    const roleName = $('#role-name').value.trim();
    const pathId = roleName ? null : (chosen ? chosen.dataset.id : null);
    if (!pathId && !roleName) { $('#setup-error').textContent = L('請選一條路徑，或者輸入目標職位。', 'Choose a path or enter a target role.'); $('#role-name').focus(); return; }
    $('#setup-error').textContent = '';
    const startYear = Number($('#start-year').value);
    if (!Number.isInteger(startYear) || startYear < 2020 || startYear > 2100) { $('#setup-error').textContent = L('請選擇 2020 至 2100 的起始年份。', 'Choose a start year between 2020 and 2100.'); return; }
    const btn = $('#create');
    btn.disabled = true;
    $('#setup-status').replaceChildren(loading(L('正在擬定初稿……', 'Drafting your plan…')));
    try {
      const d = await api('llm.php', { task: 'plan_draft', profile: profile.get() || {}, pathId, roleName, startYear });
      setHorizon(startYear); year = THIS_YEAR;
      plan = fromDraft(d);
      save();
      editing = true;
      toast(L('初稿已建立，請按你的情況修改。', 'Draft created. Edit it to fit your situation.'));
      render();
    } catch (err) {
      $('#setup-status').replaceChildren(el('span', { class: 'banner' }, err.message));
    } finally {
      btn.disabled = false;
    }
  });
  $('#use-demo').addEventListener('click', () => {
    if (!TP.demo.active) { TP.demo.start(); return; }
    setHorizon(Engine.demo.plan.horizon[0]); year = THIS_YEAR;
    if (!profile.get()) profile.set(JSON.parse(JSON.stringify(Engine.demo.user)));
    plan = demoPlan();
    save();
    render();
    toast(L('已載入示範規劃。', 'Demo plan loaded.'));
  });

  /* ---------------------------------------------------------------- 路線條 */
  function renderRoute() {
    const route = $('#year-route');
    const stops = YEARS.map((y) => {
      const pr = Engine.plan.yearProgress(plan, y, ctx());
      const done = pr.total > 0 && pr.done === pr.total;
      return el('button', {
        type: 'button', role: 'tab', 'aria-selected': y === year ? 'true' : 'false',
        class: 'stop' + (y < THIS_YEAR || done ? ' done' : '') + (y < year ? ' line-on' : '') + (y === year ? ' now' : '') + (y > THIS_YEAR && !done ? ' off' : ''),
        onclick: () => { year = y; renderYear(); renderRoute(); }
      }, [
        el('span', { class: 'dot' }),
        el('span', { class: 'when' }, [String(y), y === new Date().getFullYear() ? el('span', { class: 'tag tag-accent plan-now' }, L('今年', 'This year')) : null]),
        el('span', { class: 'what mono' }, pr.total ? `${pr.done}／${pr.total} ${L('完成', 'done')}` : L('未定', 'Not set'))
      ]);
    });
    stops.push(el('div', { class: 'stop off plan-vision-stop' }, [
      el('span', { class: 'dot' }), el('span', { class: 'when' }, L('願景', 'Vision')), el('span', { class: 'what' }, String(YEARS[4]))
    ]));
    route.replaceChildren(...stops);
  }

  /* ---------------------------------------------------------------- 願景 */
  function renderVision() {
    const box = $('#vision-card');
    const head = el('div', { class: 'spread' }, [
      el('span', { class: 'eyebrow' }, L(YEARS[4]+' 年願景', 'Vision for '+YEARS[4])),
      plan.draftSource === 'ai' ? el('span', { class: 'badge' }, L('AI 初稿，由你修改', 'AI draft – yours to edit')) : null
    ]);
    if (!editing) {
      box.replaceChildren(head, el('p', { class: 'plan-vision' }, plan.vision || L('（未寫願景）', '(No vision yet)')),
        plan.pathName ? el('span', { class: 'hint' }, L('來自職涯路徑：', 'From career path: ') + (en() ? plan.pathNameEn || plan.pathName : plan.pathName)) : null);
      return;
    }
    const area = el('textarea', { id: 'vision', class: 'textarea', rows: '3', maxlength: '300' });
    area.value = plan.vision;
    area.addEventListener('input', () => { plan.vision = area.value; save(); });
    box.replaceChildren(head, el('label', { for: 'vision', class: 'sr-only' }, L(YEARS[4]+' 年願景', 'Vision for '+YEARS[4])), area,
      el('span', { class: 'hint' }, L('用一句話寫下 '+YEARS[4]+' 年想達到的狀態。', 'Describe in one sentence where you want to be in '+YEARS[4]+'.')));
  }

  /* ---------------------------------------------------------------- 核心目標 */
  function goalPolicyLines(g) {
    return (g.policyIds || []).map((id) => Policy.get(id)).filter(Boolean).map((c) => el('div', { class: 'stack', style: { '--gap': '2px' } }, [
      el('span', { class: 'hint' }, L('相關政策：', 'Related policy: ') + Policy.title(c)),
      Policy.sourceLine(c)
    ]));
  }

  function renderGoals() {
    const box = $('#goals');
    $('#path-label').textContent = plan.pathName ? (en() ? plan.pathNameEn || plan.pathName : plan.pathName) : '';
    box.replaceChildren(...plan.goals.map((g, i) => {
      if (!editing) {
        return el('article', { class: 'card stack plan-goal', style: { '--gap': '8px' } }, [
          el('span', { class: 'mono faint', style: { fontSize: '12px' } }, L('核心目標 ', 'Goal ') + (i + 1)),
          el('b', { style: { fontSize: '16px' } }, g.text),
          ...goalPolicyLines(g)
        ]);
      }
      const id = 'goal-' + g.id;
      const input = el('input', { id, class: 'input', maxlength: '120' });
      input.value = g.text;
      input.addEventListener('input', () => { g.text = input.value; save(); });
      const sel = el('select', { id: id + '-policy', class: 'select' }, [el('option', { value: '' }, L('沒有相關政策卡', 'No related policy card'))]
        .concat(Policy.all().map((c) => el('option', { value: c.id, selected: (g.policyIds || [])[0] === c.id ? true : null }, Policy.title(c)))));
      sel.addEventListener('change', () => { g.policyIds = sel.value ? [sel.value] : []; save(); renderGoals(); });
      const remove = plan.goals.length > 1 ? el('button', { type: 'button', class: 'btn btn-sm', onclick: () => {
        plan.goals.splice(i, 1);
        plan.milestones.forEach((m) => { if (m.goalId === g.id) m.goalId = null; });
        save(); render();
      } }, L('刪除', 'Delete')) : null;
      return el('fieldset', { class: 'card stack plan-goal', style: { '--gap': '10px', margin: '0' } }, [
        el('legend', { class: 'sr-only' }, L('核心目標 ', 'Goal ') + (i + 1)),
        el('div', { class: 'spread' }, [el('span', { class: 'mono faint', style: { fontSize: '12px' } }, L('核心目標 ', 'Goal ') + (i + 1)), remove]),
        el('div', { class: 'field' }, [el('label', { for: id }, L('目標', 'Goal')), input]),
        el('div', { class: 'field' }, [el('label', { for: id + '-policy' }, L('相關政策卡（可選）', 'Related policy card (optional)')), sel]),
        ...goalPolicyLines(g)
      ]);
    }));
    $('#add-goal').hidden = !editing || plan.goals.length >= MAX_GOALS;
  }

  /* ---------------------------------------------------------------- 里程碑 */
  function progressView(m) {
    const pr = Engine.plan.milestoneProgress(m, ctx());
    if (m.metric.type === 'reports') {
      const sc = SCENARIOS[m.metric.scenarioId] || [m.metric.scenarioId, m.metric.scenarioId, null];
      const pct = Math.min(100, Math.round((pr.current / pr.target) * 100));
      const avg = pr.avg === null ? L('未有報告', 'no reports yet') : L('平均 ', 'average ') + pr.avg.toFixed(1);
      return el('div', { class: 'stack', style: { '--gap': '6px' } }, [
        el('span', { class: 'hint' }, L('進度：', 'Progress: ') + `${pr.current}／${pr.target} ${L('次', 'sessions')}${L('，', ', ')}${avg}` + (m.metric.minAvg ? L(`（目標平均 ${m.metric.minAvg} 分以上）`, ` (target average ${m.metric.minAvg}+)`) : '') + L('，由報告計算', ', calculated from your reports')),
        el('div', { class: 'meter', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(pr.target), 'aria-valuenow': String(pr.current) }, [el('span', { style: { width: pct + '%' } })]),
        !pr.done && sc[2] && m.year === THIS_YEAR ? el('a', { class: 'btn btn-sm btn-outline no-print', href: BASE + sc[2], style: { alignSelf: 'flex-start' } }, L('去練習：', 'Practise: ') + L(sc[0], sc[1])) : null
      ]);
    }
    if (m.metric.type === 'cert') {
      const c = certs().find((x) => x.name.trim().toLowerCase() === m.metric.certName.trim().toLowerCase());
      const st = c ? STATUS[c.status] : null;
      return el('span', { class: 'hint' }, L('來自專業資格：', 'From professional qualifications: ') + (st ? L(st[0], st[1]) : L('未加入你的資料', 'not in your profile yet')) + L('。狀態變成「已取得」即完成，可以在路線總覽更新。', '. Marked done when its status is "Earned" – update it on the path overview.'));
    }
    const box = el('input', { type: 'checkbox', id: 'done-' + m.id, checked: m.done ? true : null, onchange: (e) => { m.done = e.target.checked; save(); renderRoute(); renderYear(); } });
    return el('label', { class: 'row plan-check', for: 'done-' + m.id, style: { '--gap': '8px' } }, [box, el('span', {}, L('已完成（自行勾選）', 'Done (tick it yourself)'))]);
  }

  function milestoneRead(m) {
    const pr = Engine.plan.milestoneProgress(m, ctx());
    const g = plan.goals.find((x) => x.id === m.goalId);
    return el('article', { class: 'card stack plan-ms' + (pr.done ? ' is-done' : ''), style: { '--gap': '8px' } }, [
      el('div', { class: 'spread' }, [
        el('span', { class: 'mono faint', style: { fontSize: '12px' } }, `${m.year} ${L('里程碑', 'milestone')}`),
        el('span', { class: 'tag ' + (pr.done ? 'tag-accent' : '') }, pr.done ? L('已完成', 'Done') : L('進行中', 'In progress'))
      ]),
      el('b', { style: { fontSize: '16px' } }, m.text),
      g ? el('span', { class: 'hint' }, [L('目標 ', 'Goal ') + goalNo(g.id) + L('：', ': '), g.text]) : null,
      progressView(m)
    ]);
  }

  function milestoneEdit(m) {
    const id = 'ms-' + m.id;
    const text = el('input', { id, class: 'input', maxlength: '160' });
    text.value = m.text;
    text.addEventListener('input', () => { m.text = text.value; save(); });
    const goalSel = el('select', { id: id + '-goal', class: 'select' }, [el('option', { value: '' }, L('不連到目標', 'No goal'))]
      .concat(plan.goals.map((g, i) => el('option', { value: g.id, selected: m.goalId === g.id ? true : null }, [L('目標 ', 'Goal ') + (i + 1) + L('：', ': '), g.text]))));
    goalSel.addEventListener('change', () => { m.goalId = goalSel.value || null; save(); });
    const typeSel = el('select', { id: id + '-type', class: 'select' }, [
      ['reports', L('練習報告（次數和平均分）', 'Practice reports (count and average)')],
      ['cert', L('專業資格（已取得即完成）', 'Professional qualification (done when earned)')],
      ['manual', L('自行勾選', 'Tick it yourself')]
    ].map(([v, label]) => el('option', { value: v, selected: m.metric.type === v ? true : null }, label)));
    typeSel.addEventListener('change', () => {
      const v = typeSel.value;
      if (v === 'reports') m.metric = { type: 'reports', scenarioId: 'interview_general_v1', count: 3, minAvg: 4 };
      else if (v === 'cert') m.metric = { type: 'cert', certName: (certs()[0] || {}).name || '' };
      else m.metric = { type: 'manual' };
      save(); renderYear();
    });
    const fields = [];
    if (m.metric.type === 'reports') {
      const count = el('input', { id: id + '-count', class: 'input num', type: 'number', min: '1', max: '20', value: String(m.metric.count) });
      count.addEventListener('change', () => { m.metric.count = Math.max(1, Math.min(20, Math.round(Number(count.value) || 1))); count.value = m.metric.count; save(); renderRoute(); });
      const avg = el('select', { id: id + '-avg', class: 'select' }, [['', L('不設平均分', 'No minimum')], ['3', '3'], ['3.5', '3.5'], ['4', '4'], ['4.5', '4.5']]
        .map(([v, label]) => el('option', { value: v, selected: String(m.metric.minAvg || '') === v ? true : null }, label)));
      avg.addEventListener('change', () => { if (avg.value) m.metric.minAvg = Number(avg.value); else delete m.metric.minAvg; save(); renderRoute(); });
      fields.push(el('div', { class: 'grid-2', style: { '--gap': '12px' } }, [
        el('div', { class: 'field' }, [el('label', { for: id + '-count' }, L('AI 面試次數', 'Number of AI interviews')), count]),
        el('div', { class: 'field' }, [el('label', { for: id + '-avg' }, L('平均分最少', 'Minimum average')), avg])
      ]));
    } else if (m.metric.type === 'cert') {
      const names = Array.from(new Set(certs().map((c) => c.name).concat(m.metric.certName ? [m.metric.certName] : [])));
      if (!names.length) fields.push(el('span', { class: 'hint' }, L('先在路線總覽加入專業資格。', 'Add a professional qualification on the path overview first.')));
      else {
        const sel = el('select', { id: id + '-cert', class: 'select' }, names.map((n) => el('option', { value: n, selected: n === m.metric.certName ? true : null }, n)));
        sel.addEventListener('change', () => { m.metric.certName = sel.value; save(); renderRoute(); });
        if (!m.metric.certName) { m.metric.certName = names[0]; save(); }
        fields.push(el('div', { class: 'field' }, [el('label', { for: id + '-cert' }, L('專業資格', 'Professional qualification')), sel]));
      }
    }
    const yearSel = el('select', { id: id + '-year', class: 'select' }, YEARS.map((y) => el('option', { value: String(y), selected: m.year === y ? true : null }, String(y))));
    yearSel.addEventListener('change', () => {
      const y = Number(yearSel.value);
      if (perYear(y).length >= MAX_PER_YEAR) { toast(L(`${y} 年已經有 3 個里程碑。`, `${y} already has 3 milestones.`)); yearSel.value = String(m.year); return; }
      m.year = y; save(); render();
    });
    return el('fieldset', { class: 'card stack plan-ms', style: { '--gap': '12px', margin: '0' } }, [
      el('legend', { class: 'sr-only' }, L('里程碑', 'Milestone')),
      el('div', { class: 'spread' }, [el('span', { class: 'mono faint', style: { fontSize: '12px' } }, `${m.year} ${L('里程碑', 'milestone')}`),
        el('button', { type: 'button', class: 'btn btn-sm', onclick: () => { plan.milestones = plan.milestones.filter((x) => x !== m); save(); render(); } }, L('刪除', 'Delete'))]),
      el('div', { class: 'field' }, [el('label', { for: id }, L('里程碑', 'Milestone')), text]),
      el('div', { class: 'grid-2', style: { '--gap': '12px' } }, [
        el('div', { class: 'field' }, [el('label', { for: id + '-goal' }, L('對應目標', 'Goal')), goalSel]),
        el('div', { class: 'field' }, [el('label', { for: id + '-year' }, L('年份', 'Year')), yearSel])
      ]),
      el('div', { class: 'field' }, [el('label', { for: id + '-type' }, L('怎樣量度', 'How it is measured')), typeSel]),
      ...fields,
      progressView(m)
    ]);
  }

  function renderYear() {
    const ms = perYear(year);
    const pr = Engine.plan.yearProgress(plan, year, ctx());
    $('#ms-title').textContent = L(`${year} 年里程碑`, `${year} milestones`);
    $('#ms-count').textContent = ms.length ? L(`已完成 ${pr.done}／${pr.total}`, `${pr.done} of ${pr.total} done`) : '';
    const box = $('#milestones');
    box.replaceChildren(...(ms.length ? ms.map(editing ? milestoneEdit : milestoneRead)
      : [el('div', { class: 'empty' }, L('這一年還沒有里程碑。按「編輯規劃」加入 1 至 3 個。', 'No milestones for this year yet. Choose "Edit plan" to add one to three.'))]));
    $('#add-milestone').hidden = !editing || ms.length >= MAX_PER_YEAR;
    renderReview();
  }

  /* ---------------------------------------------------------------- 年度檢討 */
  function renderReview() {
    const box = $('#review');
    const existing = plan.reviews.find((r) => r.year === year);
    const pr = Engine.plan.yearProgress(plan, year, ctx());
    const head = el('div', { class: 'spread' }, [el('h2', { id: 'review-title', style: { fontSize: '18px' } }, L(`${year} 年度檢討`, `${year} annual review`)),
      el('span', { class: 'mono faint', style: { fontSize: '13px' } }, L(`完成度 ${pr.done}／${pr.total}`, `${pr.done} of ${pr.total} done`))]);
    if (year > THIS_YEAR) {
      box.replaceChildren(head, el('p', { class: 'hint' }, L('到了這一年再寫檢討。每年檢討後，可以調整下一年的里程碑。', 'Write this review when the year comes. After each review, adjust the next year\'s milestones.')));
      return;
    }
    const area = el('textarea', { id: 'review-note', class: 'textarea', rows: '4', maxlength: '1000', placeholder: L('今年完成了甚麼？哪些未完成，原因是甚麼？下一年要怎樣調整？', 'What did you achieve this year? What did not happen, and why? What will you change next year?') });
    area.value = existing ? existing.note : '';
    const saveBtn = el('button', { type: 'button', class: 'btn btn-sm btn-primary no-print' }, L('儲存檢討', 'Save review'));
    saveBtn.addEventListener('click', () => {
      const note = area.value.trim();
      if (!note) { toast(L('請先寫下檢討內容。', 'Write your review first.')); area.focus(); return; }
      plan.reviews = plan.reviews.filter((r) => r.year !== year).concat([{ year, date: new Date().toISOString().slice(0, 10), note }]);
      save();
      renderReview();
      toast(L('已儲存年度檢討。', 'Annual review saved.'));
    });
    box.replaceChildren(head,
      el('label', { for: 'review-note', class: 'hint' }, L('像政府的年度述職一樣：回顧進度，再調整下一年。', 'Like the government\'s annual report: review progress, then adjust next year.')),
      area,
      el('div', { class: 'row' }, [saveBtn, existing ? el('span', { class: 'hint' }, L('上次儲存：', 'Last saved: ') + existing.date) : null]));
  }

  /* ---------------------------------------------------------------- 證書草稿 */
  function renderCertDrafts() {
    const drafts = Engine.plan.certMilestoneDrafts(plan, certs());
    const box = $('#cert-drafts');
    box.hidden = !drafts.length;
    if (!drafts.length) return;
    box.replaceChildren(el('div', { class: 'spread' }, [
      el('span', {}, L(`你有 ${drafts.length} 項「計劃考取」的專業資格還未放進規劃。`, `You have ${drafts.length} planned qualification(s) not yet in your plan.`)),
      el('button', { type: 'button', class: 'btn btn-sm', onclick: () => {
        const n = addCertDrafts(plan);
        save(); render();
        toast(n ? L(`已加入 ${n} 個里程碑草稿。`, `${n} draft milestone(s) added.`) : L('那幾年的里程碑已滿。', 'Those years already have 3 milestones.'));
      } }, L('加入為里程碑草稿', 'Add as draft milestones'))
    ]));
  }

  /* ---------------------------------------------------------------- 列印 */
  function renderPrint() {
    const box = $('#plan-print');
    const metricText = (m) => {
      const pr = Engine.plan.milestoneProgress(m, ctx());
      if (m.metric.type === 'reports') return L(`指標：${pr.current}／${pr.target} 次 AI 面試`, `Measure: ${pr.current} of ${pr.target} AI interviews`) + (pr.avg !== null ? L(`，平均 ${pr.avg.toFixed(1)}`, `, average ${pr.avg.toFixed(1)}`) : '') + (m.metric.minAvg ? L(`（目標 ${m.metric.minAvg} 分以上）`, ` (target ${m.metric.minAvg}+)`) : '');
      if (m.metric.type === 'cert') return L('指標：專業資格「已取得」', 'Measure: qualification earned');
      return L('指標：自行勾選', 'Measure: self-assessed');
    };
    box.replaceChildren(...[
      el('h1', {}, L('我的五年規劃（'+YEARS[0]+'–'+YEARS[4]+'）', 'My Five-Year Plan ('+YEARS[0]+'–'+YEARS[4]+')')),
      el('p', {}, [el('b', {}, L(YEARS[4]+' 年願景：', 'Vision for '+YEARS[4]+': ')), plan.vision]),
      el('h2', {}, L('核心目標', 'Goals')),
      el('ol', {}, plan.goals.map((g) => el('li', {}, [g.text].concat((g.policyIds || []).map((id) => Policy.get(id)).filter(Boolean).map((c) =>
        el('div', { class: 'small' }, L('相關政策：根據〔', 'Related policy: based on 〔') + Policy.doc(c) + '〕' + Policy.title(c) + ' — ' + c.source.url)))))),
      el('h2', {}, L('每年里程碑', 'Milestones by year')),
      ...YEARS.map((y) => el('div', {}, [
        el('h3', {}, String(y) + L(`（完成 ${Engine.plan.yearProgress(plan, y, ctx()).done}／${perYear(y).length}）`, ` (${Engine.plan.yearProgress(plan, y, ctx()).done} of ${perYear(y).length} done)`)),
        el('ul', {}, perYear(y).map((m) => el('li', {}, [m.text + (Engine.plan.milestoneProgress(m, ctx()).done ? L('　✓ 已完成', '  ✓ done') : ''), el('div', { class: 'small' }, metricText(m))])))
      ])),
      plan.reviews.length ? el('h2', {}, L('年度檢討', 'Annual reviews')) : null,
      ...plan.reviews.map((r) => el('p', {}, [el('b', {}, `${r.year}（${r.date}）：`), r.note])),
      el('p', { class: 'small' }, L('由 2PP Helper 產生，資料只存在你的瀏覽器。政策內容只列出處，不作評價。列印日期：', 'Generated by 2PP Helper; your data stays in your browser. Policy references are listed with sources, without evaluation. Printed: ') + new Date().toISOString().slice(0, 10))
    ].filter(Boolean));
  }

  /* ---------------------------------------------------------------- 整頁 */
  function render() {
    const mech = Policy.get('fyp_mechanism');
    $('#mechanism-source').replaceChildren(mech ? Policy.sourceLine(mech) : '');
    $('#setup').hidden = !!plan;
    $('#plan').hidden = !plan;
    $('#plan-actions').hidden = !plan;
    if (!plan) { renderSetup(); return; }
    const toggle = $('#edit-toggle');
    toggle.textContent = editing ? L('完成編輯', 'Done editing') : L('編輯規劃', 'Edit plan');
    toggle.setAttribute('aria-pressed', editing ? 'true' : 'false');
    toggle.classList.toggle('btn-primary', editing);
    renderRoute();
    renderCertDrafts();
    renderVision();
    renderGoals();
    renderYear();
    renderPrint();
  }

  $('#edit-toggle').addEventListener('click', () => {
    if (editing && plan.goals.some((g) => !g.text.trim())) { toast(L('目標不可以留空。', 'Goals cannot be empty.')); return; }
    editing = !editing;
    render();
  });
  $('#add-goal').addEventListener('click', () => {
    if (plan.goals.length >= MAX_GOALS) return;
    plan.goals.push({ id: nextId('g', plan.goals), text: '', policyIds: [] });
    save(); renderGoals();
    const inputs = $$('#goals input');
    if (inputs.length) inputs[inputs.length - 1].focus();
  });
  $('#add-milestone').addEventListener('click', () => {
    if (perYear(year).length >= MAX_PER_YEAR) return;
    plan.milestones.push({ id: nextId('m', plan.milestones), year, goalId: plan.goals[0] ? plan.goals[0].id : null, text: '', metric: { type: 'manual' }, done: false });
    save(); renderYear(); renderRoute();
    const inputs = $$('#milestones input.input');
    if (inputs.length) inputs[inputs.length - 1].focus();
  });
  $('#print').addEventListener('click', () => {
    renderPrint();
    document.body.classList.add('print-plan');
    window.print();
    setTimeout(() => document.body.classList.remove('print-plan'), 500);
  });
  $('#reset').addEventListener('click', () => {
    if (!confirm(L('確定要刪除這份規劃並重新開始嗎？', 'Delete this plan and start again?'))) return;
    store.remove('plan');
    plan = null;
    editing = false;
    render();
  });
  document.addEventListener('tp:languagechange', render);

  render();
})();
