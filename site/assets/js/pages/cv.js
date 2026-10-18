/** CV Builder：表單 → 即時預覽；AI 改寫成果句；列印成 PDF（文字可被 ATS 讀取）。 */
(function () {
  'use strict';
  const { $, $$, el, api, store, profile, toHK, toast } = TP;
  const p = profile.get() || {};
  const edu = (p.education || []).find((e) => e && e.educationStatus !== 'planned') || {};
  const MAX_EXP = 4;

  const blankExp = () => ({ title: '', org: '', period: '', bullets: [] });
  let cv = store.get('cv') || {
    name: '', email: '', phone: '', link: '',
    school: edu.school && !String(edu.school).startsWith('[') ? edu.school : '',
    degree: (edu.degree || [TP.t(({ secondary: '中學／DSE', associate: '副學士／高級文憑', bachelor: '學士', master: '碩士', doctorate: '博士', other: '其他學歷' })[edu.degreeLevel] || ''), TP.t(edu.major || '')].filter(Boolean).join(' · '))
      + (edu.educationStatus === 'in_progress' ? ' (' + TP.t('修讀中') + ')' : ''), gradYear: edu.gradYear ? String(edu.gradYear) : '',
    experiences: (p.experiences && p.experiences.length ? p.experiences : [blankExp()]).map((x) => ({ period: '', ...x, bullets: [...(x.bullets || [])] })),
    skills: (p.skills || []).join(', '),
    extraEducation: (p.education || []).filter(e => e !== edu && e.educationStatus !== 'planned').map(e => ({ ...e })),
    targetRole: (p.targetRoles || [])[0] || '',
    template: 'a'
  };

  const fields = ['name', 'email', 'phone', 'link', 'school', 'degree', 'gradYear', 'skills'];

  function save() {
    store.set('cv', cv);
    const versions = store.get('cvVersions', []);
    const currentId = store.get('cvVersionId');
    const v = versions.find(x => x.id === currentId);
    if (v) { v.cv = V32.clone(cv); v.updatedAt = new Date().toISOString(); store.set('cvVersions', versions); }
    renderPreview();
  }

  /* ---------- 經歷表單 ---------- */
  function renderExperiences() {
    const box = $('#experiences');
    box.replaceChildren();
    cv.experiences.forEach((x, i) => {
      const id = (k) => 'exp' + i + '-' + k;
      const suggestions = el('div', { class: 'stack', style: { '--gap': '10px' } });
      const bulletsArea = el('textarea', { id: id('bullets'), class: 'textarea', rows: '4', placeholder: '每行一項，例如：協助整理社交媒體數據，每週製作報告' });
      bulletsArea.value = x.bullets.join('\n');
      bulletsArea.addEventListener('input', () => { x.bullets = bulletsArea.value.split('\n').map((s) => s.trim()).filter(Boolean); save(); });

      const input = (k, label, extra) => {
        const inp = el('input', { id: id(k), class: 'input', ...extra });
        inp.value = x[k] || '';
        inp.addEventListener('input', () => { x[k] = inp.value; save(); });
        return el('div', { class: 'field' }, [el('label', { for: id(k) }, label), inp]);
      };

      const rewriteBtn = el('button', { type: 'button', class: 'btn btn-sm btn-outline' }, '用 AI 改寫成成果句');
      rewriteBtn.addEventListener('click', async () => {
        if (!x.bullets.length) { toast('先寫下你做過甚麼，每行一項。'); bulletsArea.focus(); return; }
        rewriteBtn.disabled = true;
        suggestions.replaceChildren(TP.loading('正在改寫……'));
        const rows = [];
        for (const [bi, bullet] of x.bullets.entries()) {
          try {
            const r = await api('llm.php', { task: 'cv_rewrite', bullet, title: x.title, targetRole: cv.targetRole || (p.targetRoles || [])[0] || '' });
            if (r.suggestion) rows.push({ bi, bullet, suggestion: toHK(r.suggestion) });
          } catch (e) { toast(e.message, 'error'); break; }
        }
        rewriteBtn.disabled = false;
        suggestions.replaceChildren(...rows.map((row) => suggestionRow(x, row, bulletsArea)));
        if (!rows.length) suggestions.replaceChildren();
      });

      const remove = cv.experiences.length > 1
        ? el('button', { type: 'button', class: 'btn btn-sm', onclick: () => { cv.experiences.splice(i, 1); save(); renderExperiences(); } }, '刪除')
        : null;

      box.append(el('fieldset', { class: 'card stack', style: { '--gap': '14px', margin: '0' } }, [
        el('legend', { class: 'sr-only' }, '經歷 ' + (i + 1)),
        el('div', { class: 'spread' }, [el('b', {}, '經歷 ' + (i + 1)), remove]),
        el('div', { class: 'grid-3', style: { '--gap': '12px' } }, [input('title', '職位／項目名稱'), input('org', '機構'), input('period', '時間', { placeholder: '例如：2025 年 6 至 8 月' })]),
        el('div', { class: 'field' }, [el('label', { for: id('bullets') }, '你做過甚麼（每行一項）'), bulletsArea]),
        el('div', { class: 'row' }, [rewriteBtn]),
        suggestions
      ]));
    });
    $('#add-exp').hidden = cv.experiences.length >= MAX_EXP;
  }

  function suggestionRow(x, row, area) {
    const status = el('span', { class: 'hint' });
    const wrap = el('div', { class: 'grid-2', style: { '--gap': '12px' } }, [
      el('div', { class: 'stack', style: { '--gap': '4px', background: 'var(--bg)', borderRadius: '12px', padding: '14px' } }, [el('span', { class: 'hint' }, '原句'), el('span', {}, row.bullet)]),
      el('div', { class: 'stack', style: { '--gap': '4px', background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', borderRadius: '12px', padding: '14px' } }, [el('span', { class: 'hint accent' }, '建議'), el('span', {}, row.suggestion)])
    ]);
    const accept = el('button', { type: 'button', class: 'btn btn-sm btn-primary' }, '採用建議');
    const keep = el('button', { type: 'button', class: 'btn btn-sm' }, '保留原句');
    accept.addEventListener('click', () => {
      const idx = x.bullets.indexOf(row.bullet);
      if (idx >= 0) x.bullets[idx] = row.suggestion;
      area.value = x.bullets.join('\n');
      save();
      status.textContent = '已採用建議';
      accept.disabled = keep.disabled = true;
    });
    keep.addEventListener('click', () => { status.textContent = '已保留原句'; accept.disabled = keep.disabled = true; });
    return el('div', { class: 'stack', style: { '--gap': '10px' } }, [wrap, el('div', { class: 'row' }, [accept, keep, status])]);
  }

  /* ---------- 預覽 ---------- */
  function text(value, placeholder) {
    return value ? document.createTextNode(value) : el('span', { class: 'placeholder' }, placeholder);
  }
  function highlight(line) {
    // 把「[填入數字]」之類的待填內容標示出來
    const parts = line.split(/(\[[^\]]+\])/g);
    return parts.map((s) => (/^\[[^\]]+\]$/.test(s) ? el('span', { class: 'placeholder' }, s) : s));
  }

  function renderPreview() {
    const paper = $('#cv-preview');
    paper.className = 'cv-paper' + (cv.template === 'b' ? ' tpl-b' : '');
    const contacts = [cv.email || '[電郵]', cv.phone || '[電話]', cv.link].filter(Boolean).join('｜');
    const extraEducation = cv.extraEducation || [];
    const exps = cv.experiences.filter((x) => x.title || x.org || x.bullets.length);
    const skills = cv.skills.split(/[,，、]/).map((s) => s.trim()).filter(Boolean);
    paper.replaceChildren(
      el('div', { class: 'cv-head stack', style: { '--gap': '6px' } }, [
        el('span', { style: { fontSize: '26px', fontWeight: '700' } }, [text(cv.name, '[你的名字]')]),
        el('span', { class: 'cv-sub' }, contacts)
      ]),
      el('section', { class: 'stack', style: { '--gap': '4px' } }, [
        el('h3', {}, '學歷'),
        el('div', { class: 'spread', style: { fontSize: '13px' } }, [el('b', {}, [text(cv.school, '[大學名稱]')]), el('span', { class: 'cv-sub' }, cv.gradYear || '[年份]')]),
        el('span', { class: 'cv-sub' }, [text(cv.degree, '[學位或主修]')]),
        ...extraEducation.map(e => el('div', { class: 'stack', style: { '--gap': '3px', marginTop: '8px' } }, [el('b', {}, [e.school || '', e.gradYear || ''].filter(Boolean).join(' · ')), el('span', { class: 'cv-sub' }, (e.degree || e.major || '') + (e.educationStatus === 'in_progress' ? ' (' + TP.t('修讀中') + ')' : ''))]))
      ]),
      el('section', { class: 'stack', style: { '--gap': '10px' } }, [el('h3', {}, '經歷')].concat(exps.length ? exps.map((x) =>
        el('div', {}, [
          el('div', { class: 'spread', style: { fontSize: '13px' } }, [el('b', {}, [text(x.title, '[職位]'), '，', text(x.org, '[機構]')]), el('span', { class: 'cv-sub' }, x.period || '')]),
          el('ul', {}, x.bullets.map((b) => el('li', {}, highlight(b))))
        ])) : [el('span', { class: 'placeholder', style: { fontSize: '12px' } }, '[在左邊加入經歷]')])),
      el('section', { class: 'stack', style: { '--gap': '4px' } }, [el('h3', {}, '技能'), el('span', { style: { fontSize: '12.5px' } }, skills.join('、') || '[技能]')]),
        ...(cvCerts().length ? [certSection()] : []),
      el('div', { class: 'no-print', style: { marginTop: 'auto', fontSize: '11px', color: '#6B7A76' } }, '即時預覽。下載時請在列印視窗選「另存為 PDF」，匯出的文字可被複製，適合 ATS 系統讀取。')
    );
  }

  /* ---------- 第 2 版：證書（來自路線總覽的專業資格；只顯示已取得和進行中） ---------- */
  function cvCerts() {
    const prof = profile.get() || {};
    return (prof.certifications || []).filter((c) => c.status === 'earned' || c.status === 'in_progress');
  }
  function certLine(c) {
    const issuer = c.issuer ? '，' + c.issuer : '';
    if (c.status === 'in_progress') return c.name + issuer + '（進行中' + (c.year ? '，預計 ' + c.year + ' 年完成' : '') + '）';
    return c.name + issuer + (c.year ? '（' + c.year + '）' : '');
  }
  function certSection() {
    const list = cvCerts();
    if (!list.length) return null;
    return el('section', { class: 'stack', style: { '--gap': '4px' } }, [el('h3', {}, '證書'),
      el('ul', {}, list.map((c) => el('li', { style: { fontSize: '12.5px' } }, certLine(c))))]);
  }
  function renderCertNote() {
    const prof = profile.get() || {};
    const all = prof.certifications || [];
    const shown = cvCerts().length;
    $('#cert-note').replaceChildren(
      el('b', {}, '證書'),
      el('span', { class: 'hint' }, all.length
        ? '已加入 ' + all.length + ' 項專業資格，其中 ' + shown + ' 項（已取得或進行中）會顯示在 CV；「計劃考取」不會顯示。'
        : '還沒有加入專業資格。'),
      el('a', { class: 'btn btn-sm', href: TP.BASE + 'grad/index.php#certs', style: { alignSelf: 'flex-start' } }, all.length ? '在路線總覽修改' : '在路線總覽加入')
    );
  }

  /* ---------- 事件 ---------- */
  fields.forEach((k) => {
    const inp = $('#' + k);
    inp.value = cv[k] || '';
    inp.addEventListener('input', () => { cv[k] = inp.value; save(); });
  });
  $('#add-exp').addEventListener('click', () => { cv.experiences.push(blankExp()); save(); renderExperiences(); });
  $('#template').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    cv.template = b.dataset.value;
    $$('button', $('#template')).forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    save();
  });
  $$('button', $('#template')).forEach((x) => x.setAttribute('aria-pressed', x.dataset.value === cv.template ? 'true' : 'false'));
  $('#download').addEventListener('click', () => {
    if ((!cv.name.trim() || !cv.email.trim() || cv.experiences.some(x => x.bullets.some(b => /\[[^\]]+\]/.test(b)))) && !confirm(V32.L('CV 仍有空白或待填內容。仍然列印？', 'Your CV still has missing details or placeholders. Print anyway?'))) return;
    document.body.classList.add('print-cv');
    window.print();
    setTimeout(() => document.body.classList.remove('print-cv'), 500);
  });


  // Explicit synchronization preserves edited CV wording and role-specific variants.
  const tools = el('section', { class: 'card stack no-print', translate: 'no' });
  $('#cv-form').prepend(tools);
  let syncBox = null;
  function refreshFields() {
    fields.forEach(k => { $('#' + k).value = cv[k] || ''; });
    $$('button', $('#template')).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.value === cv.template))); 
    renderExperiences(); renderPreview(); renderTools();
  }
  function syncFromProfile() {
    const current = profile.get() || {};
    const ed = (current.education || []).filter(e => e.educationStatus !== 'planned');
    const first = ed[0] || {};
    const values = {
      school: first.school || '', degree: (first.degree || first.major || '') + (first.educationStatus === 'in_progress' ? ' (' + TP.t('修讀中') + ')' : ''),
      gradYear: first.gradYear ? String(first.gradYear) : '', skills: (current.skills || []).join(', '),
      experiences: (current.experiences || []).map(x => ({period:'', ...x, bullets:[...(x.bullets || [])]})), extraEducation: ed.slice(1)
    };
    syncBox = el('div', { class:'stack assumption-note' }, el('b', {}, V32.L('選擇要更新的欄位；未選的改寫內容會保留。', 'Select fields to update. Unselected CV wording stays unchanged.')));
    const chosen = new Set();
    Object.entries(values).forEach(([key,value]) => {
      const labels = {school:['學校','School'],degree:['課程','Programme'],gradYear:['畢業年份','Graduation year'],skills:['技能','Skills'],experiences:['全部經歷','All experiences'],extraEducation:['其他學歷','Additional education']};
      const check = el('input', {type:'checkbox'});
      check.addEventListener('change',()=>check.checked?chosen.add(key):chosen.delete(key));
      const preview = typeof value === 'string' ? value : value.map(x => x.title || x.degree || x.major || '').join('; ');
      syncBox.append(el('label',{class:'stack'},[el('span',{},[check,' '+V32.L(...labels[key])]),el('small',{},V32.L('資料中的值：','Profile value: ')+preview)]));
    });
    syncBox.append(el('button',{type:'button',class:'btn btn-primary',onclick:()=>{chosen.forEach(k=>cv[k]=V32.clone(values[k]));if(!cv.experiences.length)cv.experiences=[blankExp()];save();refreshFields();}},V32.L('更新所選欄位','Update selected fields')));
    tools.append(syncBox);
  }
  function renderTools() {
    const versions = store.get('cvVersions', []);
    const select = el('select',{class:'select','aria-label':V32.L('CV 版本','CV version')},[el('option',{value:''},V32.L('目前草稿','Current draft')), ...versions.map(v=>el('option',{value:v.id},v.name))]);
    select.value=store.get('cvVersionId','');
    select.addEventListener('change',()=>{const v=store.get('cvVersions',[]).find(x=>x.id===select.value);if(v){cv=V32.clone(v.cv);store.set('cvVersionId',v.id);store.set('cv',cv);refreshFields();}});
    const target=el('input',{class:'input',maxlength:80,'aria-label':V32.L('此版本目標職位','Target role for this version'),placeholder:V32.L('此版本的目標職位','Target role for this version')}); target.value=cv.targetRole||'';
    target.addEventListener('input',()=>{cv.targetRole=target.value;save();});
    const create=el('button',{type:'button',class:'btn btn-sm',onclick:()=>{const name=prompt(V32.L('新版本名稱（例如：數據分析實習）','New version name (e.g. Data analyst internship)'),cv.targetRole||'CV');if(!name?.trim())return;const versions=store.get('cvVersions',[]);if(versions.length>=10){toast(V32.L('最多 10 個版本。','Maximum 10 versions.'));return;}const id='cv'+Date.now();versions.push({id,name:name.trim().slice(0,80),cv:V32.clone(cv),updatedAt:new Date().toISOString()});store.set('cvVersions',versions);store.set('cvVersionId',id);renderTools();}},V32.L('另存新版本','Save as a new version'));
    tools.replaceChildren(el('b',{},V32.L('CV 版本與資料同步','CV versions and profile updates')),select,target,el('div',{class:'row'},[create,el('button',{type:'button',class:'btn btn-sm',onclick:syncFromProfile},V32.L('檢視資料更新','Review profile updates')),el('button',{type:'button',class:'btn btn-sm',onclick:()=>{if(!confirm(V32.L('以此 CV 的經歷和技能更新職涯資料？學歷不會更改。','Update your career profile with this CV’s experiences and skills? Education stays unchanged.')))return;const current=profile.get()||{};current.experiences=V32.clone(cv.experiences);current.skills=cv.skills.split(/[,，、]/).map(x=>x.trim()).filter(Boolean);profile.set(V32.normalizeProfile(current));store.set('advisorNeedsReview',true);toast(V32.L('職涯資料已更新。','Career profile updated.'));}},V32.L('同步經歷與技能至資料','Use these experiences and skills in profile'))]));
  }
  renderTools();

  renderExperiences();
  renderCertNote();
  renderPreview();
  document.addEventListener("tp:languagechange", renderTools);
})();
