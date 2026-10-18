/* Guided profile. Drafts and committed profiles are separate; updates keep chat and CVs. */
(function () {
  'use strict';
  const { $, el, store, profile, reports, BASE, toast } = TP;
  const { L, clone, normalizeProfile, skillId, fingerprint } = V32;
  const tagMap = TP.readJson('tag-map') || { majors: [], interests: [], labels: {} };
  const roles = TP.readJson('roles-list') || [];
  const blankEducation = () => ({ school: '', major: '', degreeLevel: '', degree: '', educationStatus: '', gradYear: null });
  if (TP.demo.active && !profile.get()) { const sample = clone(Engine.demo.user); sample.strengths = null; profile.set(sample); }
  const savedDraft = store.get('profileDraft');
  let draft = normalizeProfile(savedDraft?.profile || profile.get() || {});
  if (!draft.education.length) draft.education.push(blankEducation());
  let step = location.hash === '#certs' ? 1 : Math.min(2, Math.max(0, savedDraft?.step || 0));
  const stages = [['student', '修讀中', 'Studying'], ['graduating', '即將畢業', 'Graduating soon'], ['fresh_grad', '最近畢業', 'Recently graduated'], ['career_switch', '轉換職涯', 'Changing career']];
  const goals = [['explore', '探索方向', 'Explore careers'], ['internship', '尋找實習', 'Find an internship'], ['graduate_job', '尋找畢業生工作', 'Find a graduate job'], ['interview', '準備面試', 'Prepare for interviews'], ['startup', '探索創業', 'Explore entrepreneurship']];
  const levels = [['', '未填寫', 'Not specified'], ['secondary', '中學／DSE', 'Secondary / DSE'], ['associate', '副學士／高級文憑', 'Associate / higher diploma'], ['bachelor', '學士', 'Bachelor'], ['master', '碩士', 'Master'], ['doctorate', '博士', 'Doctorate'], ['other', '其他', 'Other']];
  let timer;
  function persist() {
    store.set('profileDraft', { profile: draft, step });
    $('#save-status').textContent = store.persistent ? L('草稿已儲存在此瀏覽器。', 'Draft saved in this browser.') : L('儲存空間不可用；草稿只在本頁。請匯出資料後再離開。', 'Storage unavailable. This draft lasts only while this page is open. Export before leaving.');
  }
  function changed() { clearTimeout(timer); persist(); }
  function field(label, value, set, options = {}) {
    const node = el(options.rows ? 'textarea' : 'input', { class: options.rows ? 'textarea' : 'input', maxlength: 160, ...options });
    node.value = value ?? '';
    node.addEventListener('input', () => { set(node.value); changed(); });
    return el('label', { class: 'field' }, [el('span', {}, label), node]);
  }
  function select(label, value, choices, set, id) {
    const node = el('select', { class: 'select', id }, choices.map(([v, zh, en]) => el('option', { value: v }, L(zh, en))));
    node.value = value ?? '';
    node.addEventListener('change', () => { set(node.value); changed(); });
    return el('label', { class: 'field' }, [el('span', {}, label), node]);
  }
  function removeButton(fn) { return el('button', { type: 'button', class: 'btn btn-sm', onclick: () => { fn(); changed(); render(); } }, L('移除', 'Remove')); }
  function addButton(text, fn) { return el('button', { type: 'button', class: 'btn btn-sm', onclick: () => { fn(); changed(); render(); } }, text); }
  function educationCard(e, i) {
    const suffix = i ? '-' + i : '';
    const majors = [['', '未確定／沒有主修', 'Not sure / no major'], ...tagMap.majors.map(x => [x, x, TP.t(x)])];
    const known = majors.some(x => x[0] === e.major);
    if (e.major && !known) majors.push([e.major, e.major, e.major]);
    return el('div', { class: 'repeat-card' }, [
      el('div', { class: 'spread' }, [el('b', {}, L('學歷 ', 'Education ') + (i + 1)), draft.education.length > 1 ? removeButton(() => draft.education.splice(i, 1)) : null]),
      el('div', { class: 'form-grid' }, [select(L('主修／學科', 'Major / subject'), e.major, majors, v => { e.major = v; e.majorOther = ""; render(); }, 'major' + suffix), field(L('其他主修（可選）', 'Other subject (optional)'), e.majorOther, v => e.majorOther = v, { id: 'major-other' + suffix })]),
      el('div', { class: 'form-grid' }, [select(L('學歷程度', 'Qualification level'), e.degreeLevel, levels, v => e.degreeLevel = v, 'degreeLevel' + suffix), field(L('課程名稱（可選）', 'Programme (optional)'), e.degree, v => e.degree = v, { id: 'degreeName' + suffix })]),
      el('div', { class: 'form-grid' }, [select(L('修讀狀態', 'Study status'), e.educationStatus, [['', '未填寫', 'Not specified'], ['completed', '已完成', 'Completed'], ['in_progress', '修讀中', 'In progress'], ['planned', '未來計劃', 'Future plan']], v => e.educationStatus = v, 'educationStatus' + suffix), field(L('畢業／預計年份（可選）', 'Graduation / expected year (optional)'), e.gradYear, v => e.gradYear = v, { id: 'gradYear' + suffix, inputmode: 'numeric', maxlength: 4 })]),
      field(L('學校（可選，不用於職位排序）', 'School (optional; not used to rank careers)'), e.school, v => e.school = v, { id: 'school' + suffix })
    ]);
  }
  function experienceCard(x, i) {
    return el('div', { class: 'repeat-card' }, [
      el('div', { class: 'spread' }, [el('b', {}, L('經歷 ', 'Experience ') + (i + 1)), removeButton(() => draft.experiences.splice(i, 1))]),
      select(L('類型', 'Type'), x.type || 'project', [['project', '課程／個人項目', 'Course / personal project'], ['internship', '實習', 'Internship'], ['part_time', '兼職', 'Part-time work'], ['volunteer', '義工', 'Volunteering'], ['employment', '工作', 'Employment']], v => x.type = v),
      el('div', { class: 'form-grid' }, [field(L('項目名稱／職位', 'Project title / role'), x.title, v => x.title = v), field(L('機構（可選）', 'Organisation (optional)'), x.org, v => x.org = v)]),
      field(L('時間（可選）', 'Period (optional)'), x.period, v => x.period = v),
      field(L('你的貢獻、使用工具、成果（每行一項）', 'Your contribution, tools and results (one per line)'), (x.bullets || []).join('\n'), v => x.bullets = v.split('\n').slice(0, 8), { rows: 4, maxlength: 2500 })
    ]);
  }
  function certCard(c, i) {
    return el('div', { class: 'repeat-card' }, [el('div', { class: 'spread' }, [el('b', {}, L('資格 ', 'Qualification ') + (i + 1)), removeButton(() => draft.certifications.splice(i, 1))]),
      el('div', { class: 'form-grid' }, [field(L('資格名稱', 'Qualification name'), c.name, v => c.name = v, { list: 'cert-names', maxlength: 120 }), field(L('頒發機構', 'Issuer'), c.issuer, v => c.issuer = v, { maxlength: 120 })]),
      el('div', { class: 'form-grid' }, [select(L('狀態', 'Status'), c.status, [['earned', '已取得', 'Earned'], ['in_progress', '修讀中', 'In progress'], ['planned', '計劃考取', 'Planned']], v => c.status = v), field(L('取得／預計年份（可選）', 'Earned / expected year (optional)'), c.year, v => c.year = v, { inputmode: 'numeric', maxlength: 4 })]),
      el('details', {}, [el('summary', {}, L('更多資料', 'Additional details')), select(L('資歷架構級別（可選）', 'QF level (optional)'), String(c.qfLevel || ''), [['', '不適用／未確定', 'Not applicable / unsure'], ...[1,2,3,4,5,6,7].map(n => [String(n), String(n), String(n)])], v => c.qfLevel = v ? Number(v) : null)])
    ]);
  }
  function render() {
    $('#profile-next').hidden = false;
    $('#wizard-nav').replaceChildren(...[L('1 · 你的現況', '1 · Your situation'), L('2 · 能力與經驗', '2 · Skills & experience'), L('3 · 偏好與確認', '3 · Preferences & review')].map((text, i) => el('button', { type: 'button', class: 'btn', 'aria-current': i === step ? 'step' : null, onclick: () => { step = i; persist(); render(); } }, text)));
    const page = el('div', { class: 'stack wizard-page', style: { '--gap': '18px' } });
    if (step === 0) page.append(
      el('h2', {}, L('你現在在哪一步？', 'Where are you starting?')),
      select(L('目前情況', 'Current situation'), draft.careerStage, stages, v => draft.careerStage = v, 'stage'),
      select(L('現在最想做的事', 'Your immediate goal'), draft.goal, goals, v => draft.goal = v, 'goal'),
      el('p', { class: 'hint' }, L('沒有工作經驗或未確定方向都可以開始。學歷可稍後補充；未來進修不會當作已取得資格。', 'You can start without work experience or a chosen career. Education can be added later; future study is not treated as an earned credential.')),
      ...draft.education.map(educationCard), draft.education.length < 3 ? addButton(L('新增學歷', 'Add education'), () => draft.education.push(blankEducation())) : el('span'));
    if (step === 1) {
      page.append(el('h2', {}, L('讓你的經驗說話', 'Show what you have done')),
        el('p', { class: 'hint' }, L('技能程度由你自行描述，不是測試分數。學校項目、義工和兼職都算經驗。', 'Skill levels are self-reported, not test scores. Projects, volunteering and part-time work all count.')));
      const skillEntry = el('input', { id: 'skills', class: 'input', maxlength: 300, placeholder: L('Excel, Python, Canva…', 'Excel, Python, Canva…'), 'aria-label': L('新增技能', 'Add skills'), list: 'skill-suggestions' });
      const addSkills = () => { skillEntry.value.split(/[,，、]/).map(x => x.trim()).filter(Boolean).forEach(name => { if (draft.skills.length < 20 && !draft.skills.some(x => skillId(x) === skillId(name))) { draft.skills.push(name.slice(0, 60)); draft.skillDetails.push({ name: name.slice(0,60), id: skillId(name), level: 'learning' }); } }); changed(); render(); };
      skillEntry.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addSkills(); } });
      page.append(el('div', { class: 'row' }, [skillEntry, addButton(L('加入技能', 'Add skills'), addSkills)]), el('datalist', { id: 'skill-suggestions' }, ['Excel','Python','SQL','Power BI','Canva','JavaScript','Communication'].map(x => el('option', { value:x }))));
      draft.skills.forEach((name,i) => page.append(el('div', { class: 'skill-row' }, [el('b', {}, name), select(L('使用程度', 'Experience level'), draft.skillDetails.find(s => s.id === skillId(name))?.level || 'learning', [['learning','學習中','Learning'],['project','曾用於項目','Used in a project'],['work','曾用於工作','Used at work']], v => { const s = draft.skillDetails.find(s => s.id === skillId(name)); if (s) s.level = v; }), removeButton(() => { draft.skills.splice(i,1); draft.skillDetails = draft.skillDetails.filter(s => s.id !== skillId(name)); })])));
      page.append(...draft.experiences.map(experienceCard));
      if (draft.experiences.length < 4) page.append(addButton(L('新增項目／經歷（可選）','Add project / experience (optional)'), () => draft.experiences.push({ type: 'project', title: '', org: '', period: '', bullets: [] })));
      page.append(el('h3', {}, L('專業資格（可選）', 'Qualifications (optional)')), ...draft.certifications.map(certCard));
      if (draft.certifications.length < 10) page.append(addButton(L('新增資格', 'Add qualification'), () => draft.certifications.push({ name:'', issuer:'', status:'planned', year:null, qfLevel:null })));
      page.append(el('datalist', { id:'cert-names' }, [...new Set(roles.flatMap(r => (r.recommendedCerts || []).map(c => c.name)))].map(name => el('option', { value:name }))));
    }
    if (step === 2) {
      page.append(el('h2', {}, L('你的方向與偏好', 'Your direction and preferences')));
      const interests = el('div', { class: 'row', id: 'interests' });
      tagMap.interests.forEach(name => interests.append(el('button', { type:'button', class:'chip', 'aria-pressed':draft.interests.includes(name) ? 'true':'false', onclick: e => { draft.interests = draft.interests.includes(name) ? draft.interests.filter(x=>x!==name) : [...draft.interests,name]; e.currentTarget.setAttribute('aria-pressed',String(draft.interests.includes(name))); changed(); } }, TP.t(name))));
      page.append(interests, field(L('其他興趣（逗號分隔，可選）','Other interests (comma-separated, optional)'), draft.interests.filter(x=>!tagMap.interests.includes(x)).join(', '), v => draft.interests = [...draft.interests.filter(x=>tagMap.interests.includes(x)), ...v.split(/[,，、]/).map(x=>x.trim()).filter(Boolean)].slice(0,15)),
        field(L('目標職位（最多 3 個；留空代表探索中）','Target roles (up to 3; leave blank to explore)'), draft.targetRoles.join(', '), v => draft.targetRoles = v.split(/[,，、]/).map(x=>x.trim()).filter(Boolean).slice(0,3), { id:'targetRole' }));
      const pref = draft.preferences;
      page.append(el('div', { class:'form-grid' }, [field(L('工作地點偏好（可選）','Preferred work location (optional)'), pref.location, v=>pref.location=v), select(L('工作安排（可選）','Work arrangement (optional)'), pref.arrangement, [['','未有偏好','No preference'],['onsite','辦公室','On-site'],['hybrid','混合','Hybrid'],['remote','遙距','Remote']],v=>pref.arrangement=v), field(L('可開始日期（可選）','Available from (optional)'),pref.availableFrom,v=>pref.availableFrom=v,{type:'date'}), field(L('工作語言（可選）','Working languages (optional)'),pref.language,v=>pref.language=v), field(L('每週學習時數（可選）','Learning hours per week (optional)'),pref.learningHours,v=>pref.learningHours=v,{type:'number',min:0,max:80}), field(L('每月學習預算 HK$（可選）','Monthly learning budget HK$ (optional)'),pref.learningBudget,v=>pref.learningBudget=v,{type:'number',min:0,max:100000})]));
      page.append(el('p', { class:'assumption-note' }, L('儲存後可選擇強項問卷或直接探索。資料存在本機瀏覽器；使用 AI 時會傳送有限職涯資料及你的對話。問卷分享預設關閉。','After saving, choose the optional strengths questionnaire or explore directly. Data is stored in this browser; AI features send a limited career summary and your messages to the provider. Questionnaire sharing is off by default.')));
    }
    $('#wizard-pages').replaceChildren(page);
    $('#profile-back').hidden = step === 0; $('#profile-back').textContent = L('上一步','Back');
    $('#profile-next').textContent = step === 2 ? L('儲存資料','Save profile') : L('儲存並繼續','Save and continue');
    dashboard();
  }
  function validate() {
    const y = new Date().getFullYear();
    for (const e of draft.education) if (e.gradYear !== null && e.gradYear !== '' && (!/^\d{4}$/.test(String(e.gradYear)) || Number(e.gradYear)<1950 || Number(e.gradYear)>y+15)) return L('請填寫有效的四位數畢業年份，或留空。','Enter a valid four-digit graduation year, or leave it blank.');
    for (const c of draft.certifications) if (c.year !== null && c.year !== '' && (!/^\d{4}$/.test(String(c.year)) || Number(c.year)<1950 || Number(c.year)>y+15)) return L('請修正資格年份，或留空。','Correct the qualification year, or leave it blank.');
    for (const [key,max] of [['learningHours',80],['learningBudget',100000]]) { const v=draft.preferences[key]; if(v!=='' && (!Number.isFinite(Number(v)) || Number(v)<0 || Number(v)>max)) return L('請修正學習時間或預算。','Correct the learning time or budget.'); }
    return '';
  }
  function commit() {
    const old = profile.get(); const p = clone(draft);
    p.education = p.education.filter(e=>e.major || e.degree || e.school || e.majorOther).map(e=>({...e,major:e.majorOther?.trim() || e.major,gradYear:e.gradYear ? Number(e.gradYear):null}));
    p.certifications = p.certifications.filter(c=>c.name.trim()).map(c=>({...c,year:c.year ? Number(c.year):null}));
    p.experiences = p.experiences.filter(x=>x.title.trim() || x.bullets.some(b=>b.trim())).map(x=>({...x,bullets:x.bullets.map(b=>b.trim()).filter(Boolean)}));
    p.tags = [...new Set([...p.education.filter(e=>e.educationStatus!=='planned').map(e=>e.major),...p.interests,...p.skills].flatMap(x=>tagMap.labels[x] || []))];
    p.updatedAt = new Date().toISOString();
    profile.set(p); store.remove('profileDraft');
    if (old && fingerprint(old)!==fingerprint(p)) store.set('advisorNeedsReview',true);
    draft = normalizeProfile(p);
    toast(L('資料已儲存；既有 CV 和對話已保留。','Profile saved. Existing CVs and conversations are preserved.'));
    $('#wizard-pages').replaceChildren(el('div',{class:'stack'},[el('h2',{},L('準備好了。下一步由你選。','Ready. Choose your next step.')),el('a',{class:'btn btn-primary',href:BASE+(p.goal==='startup'?'startup/index.php':'grad/advisor.php')},L('探索我的方向','Explore my direction')),el('a',{class:'btn',href:BASE+'grad/strengths.php'},L('填寫可選強項問卷','Take the optional strengths questionnaire')),el('button',{type:'button',class:'btn',onclick:render},L('繼續編輯資料','Continue editing'))]));
    $('#profile-next').hidden=true; $('#profile-back').hidden=true; $('#save-status').textContent=store.persistent?L('已儲存。','Saved.'):L('儲存空間不可用，請先匯出。','Storage unavailable. Export before leaving.'); dashboard();
  }
  function dashboard() {
    const p=profile.get(), saved=store.get('savedOpportunities',[]), rs=reports.list();
    const goal=goals.find(g=>g[0]===p?.goal);
    const next=p?.goal==='startup'?['startup/index.php',L('探索我的創業情景','Explore my startup scenario')]:!p?['grad/index.php',L('完成資料','Complete your profile')]:!store.get('advisor')?['grad/advisor.php',L('探索職涯方向','Explore career paths')]:!store.get('cv')?['grad/cv.php',L('整理你的 CV','Build your CV')]:!rs.some(r=>r.route==='grad')?['grad/interview.php',L('練習一次面試','Practise an interview')]:['grad/plan.php',L('檢視近期行動','Review your next actions')];
    $('#graduate-dashboard').replaceChildren(el('h2',{},L('我的進度','Your progress')),el('p',{},goal?L(goal[1],goal[2]):L('從你的目標開始','Start with your goal')),el('a',{class:'btn btn-primary',href:BASE+next[0]},next[1]),el('p',{class:'hint'},L('已儲存機會：','Saved opportunities: ')+saved.length+L(' · 已完成面試：',' · Interviews completed: ')+rs.filter(r=>r.route==='grad').length),...(saved.length?[el('a',{href:BASE+'grad/opportunities.php?saved=1'},L('查看已儲存機會','View saved opportunities'))]:[]),el('div',{class:'row'},[['grad/cv.php','CV','CV'],['grad/opportunities.php','機會','Opportunities'],['grad/plan.php','規劃','Plan'],['reports.php','報告','Reports']].map(([href,zh,en])=>el('a',{class:'btn btn-sm',href:BASE+href},L(zh,en)))),el('button',{type:'button',class:'btn btn-sm',onclick:V32.exportData},L('匯出我的資料備份','Export my data backup')));
    V32.renderActions($('#graduate-actions'));
  }
  $('#profile-form').addEventListener('submit',e=>{e.preventDefault();const error=validate();$('#form-error').textContent=error;if(error)return;if(step<2){step++;persist();render();}else commit();});
  $('#profile-back').addEventListener('click',()=>{step=Math.max(0,step-1);persist();render();});
  $('#load-demo').addEventListener('click',()=>TP.demo.active?toast(L('你已在示範模式。','You are already in demo mode.')):TP.demo.start());
  document.addEventListener('tp:actionschange',dashboard);
  document.addEventListener('tp:languagechange',()=>{render();V32.translate();});
  window.addEventListener('beforeunload',()=>{if(store.get('profileDraft'))persist();});
  render();if(savedDraft)persist();
})();
