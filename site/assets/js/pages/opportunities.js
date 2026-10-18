/**
 * 工作與活動推薦：由程式計分，不用 AI。
 * 按用戶的四項資料配對：主修相符 ×3、興趣相符 ×2、技能相符 ×1、專業資格相符 +1；過期項目自動隱藏。
 * 每張卡列出相符的是哪一項資料（主修／興趣／技能／專業資格），並附官方網站或求職網站的連結和核實日期。
 * 政府青年就業及培訓計劃另列一區，全部連到官方網頁；頁底有免責聲明。
 */
(function () {
  'use strict';
  const { $, $$, el, svg, store, profile, readJson, BASE, language } = TP;
  const Policy = window.TPPolicy;
  const items = readJson('opps') || [];
  const tagMap = readJson('tag-map') || {};
  const p = profile.get();
  const roleFilter = new URLSearchParams(location.search).get('role');
  const TOP = 9;
  const en = () => language() === 'en';
  const L = (zh, english) => (en() ? english : zh);
  const pick = (o, k) => (en() && o[k + 'En'] ? o[k + 'En'] : o[k]);
  const tr = (s) => (window.TPI18n ? window.TPI18n.t(s) : s);
  const KIND = { role: ['職位方向', 'Role direction'], intern: ['實習', 'Internship'], scheme: ['政府計劃', 'Government scheme'], course: ['課程與考證', 'Course & certification'], event: ['活動', 'Event'], contest: ['比賽', 'Contest'] };
  const LINK = { role: ['搜尋職位', 'Search jobs'], intern: ['搜尋實習', 'Search internships'], scheme: ['官方網頁', 'Official page'], course: ['課程／考試資料', 'Course / exam details'], event: ['活動網站', 'Event website'], contest: ['比賽網站', 'Contest website'] };
  const CAT = { major: ['主修', 'Major'], interest: ['興趣', 'Interest'], skill: ['技能', 'Skill'], cert: ['專業資格', 'Qualification'] };
  const STATUS = { earned: ['已取得', 'earned'], in_progress: ['進行中', 'in progress'], planned: ['計劃考取', 'planned'] };
  let savedOnly = new URLSearchParams(location.search).get('saved') === '1';
  let kind = 'all';
  let area = 'all';

  /* ---------- 用戶的四項資料 ---------- */
  const norm = (s) => String(s || '').trim().toLowerCase();
  const skillNorm = V32.skillId;
  const majors = p ? (p.education || []).filter((e) => e && e.educationStatus !== 'planned').map((e) => e.major).filter(Boolean) : [];
  const interests = p ? p.interests || [] : [];
  const skillList = p ? p.skills || [] : [];
  const certs = p ? (p.certifications || []).filter((c) => c && c.name && c.name.trim()) : [];
  const tagsOf = (labels) => new Set(labels.flatMap((l) => tagMap[l] || []));
  const majorTags = tagsOf(majors);
  const interestTags = tagsOf(interests);
  const mySkills = new Map(skillList.map((k) => [skillNorm(k), k]));
  const today = new Date().toISOString().slice(0, 10);

  function match(it) {
    const reasons = [];
    let s = 0;
    // 主修 ×3（每個相符的標籤）
    (it.majorTags || []).forEach((t) => { if (majorTags.has(t)) s += 3; });
    majors.filter((m) => (tagMap[m] || []).some((t) => (it.majorTags || []).includes(t))).forEach((m) => reasons.push(['major', m]));
    // 興趣 ×2
    (it.interestTags || []).forEach((t) => { if (interestTags.has(t)) s += 2; });
    interests.filter((i) => (tagMap[i] || []).some((t) => (it.interestTags || []).includes(t))).forEach((i) => reasons.push(['interest', i]));
    // 技能 ×1
    (it.skills || []).forEach((k) => { const hit = mySkills.get(skillNorm(k)); if (hit) { s += 1; reasons.push(['skill', hit]); } });
    // 專業資格 +1：課程與考證、持續進修基金等看所有狀態；職位和實習只看已取得
    const anyStatus = it.kind === 'course' || it.certAny;
    const certHits = certs.filter((c) => (anyStatus || c.status === 'earned') && (it.certAny ? c.status !== 'earned' : (it.certs || []).some((n) => norm(n) === norm(c.name))));
    if (certHits.length) { s += 1; certHits.slice(0, 2).forEach((c) => reasons.push(['cert', c.name, c.status])); }
    if (roleFilter && it.roleId === roleFilter) s += 10;
    return { ...it, score: s, reasons };
  }

  const areasOf = (it) => {
    const set = new Set((it.policyIds || []).map((id) => Policy.get(id)).filter(Boolean).map((c) => c.area));
    if (it.roleId) Policy.forRole(it.roleId).forEach((c) => set.add(c.area));
    return set;
  };
  const visible = (it) => (!savedOnly || store.get('savedOpportunities', []).includes(it.id)) && (!it.deadline || it.deadline >= today) && (area === 'all' || areasOf(it).has(area));
  const ranked = (list) => list.map((it, i) => ({ ...match(it), order: i })).sort((a, b) => b.score - a.score || a.order - b.order);

  /* ---------- 卡片 ---------- */
  function thumb(color, seed) {
    const cx = 200 + (seed % 3) * 30;
    return svg('svg', { viewBox: '0 0 320 96', width: '100%', height: '96', preserveAspectRatio: 'xMidYMid slice', fill: 'none', 'aria-hidden': 'true' }, [
      svg('circle', { cx, cy: 48, r: 70, stroke: color, opacity: '.35' }),
      svg('circle', { cx, cy: 48, r: 44, stroke: color, 'stroke-dasharray': '3 6', opacity: '.5' }),
      svg('path', { d: 'M0 64 H120 Q140 64 140 44 V30 H320', stroke: color, 'stroke-width': 2, opacity: '.8' }),
      svg('circle', { cx: 140, cy: 30, r: 5, fill: '#0F171A', stroke: color, 'stroke-width': 2 })
    ]);
  }

  function reasonChips(it) {
    if (!it.reasons.length) return el('span', { class: 'hint' }, p ? L('與你的資料沒有直接相符，可以作參考。', 'No direct match with your profile; shown for reference.') : '');
    return el('div', { class: 'row', style: { '--gap': '6px' } }, [el('span', { class: 'hint' }, L('相符：', 'Matches: '))].concat(it.reasons.map(([cat, value, status]) =>
      el('span', { class: 'tag match-tag match-' + cat }, [
        el('b', {}, L(CAT[cat][0], CAT[cat][1]) + ' '),
        cat === 'cert' ? value + (status ? L('（' + STATUS[status][0] + '）', ' (' + STATUS[status][1] + ')') : '') : tr(value)
      ]))));
  }

  function card(it, i, compact) {
    const color = it.kind === 'event' || it.kind === 'contest' ? '#FF8A66' : '#3FE0B5';
    const policies = (it.policyIds || []).map((id) => Policy.get(id)).filter(Boolean);
    const title = pick(it, 'title');
    const link = it.url
      ? el('a', { class: 'btn btn-sm' + (it.kind === 'scheme' ? ' btn-outline' : ''), href: it.url, target: '_blank', rel: 'noopener noreferrer',
        'aria-label': title + L('：' + LINK[it.kind][0] + '（外部網站，在新分頁開啟）', ': ' + LINK[it.kind][1] + ' (external website, opens in a new tab)') },
        [L(LINK[it.kind][0], LINK[it.kind][1]), el('span', { 'aria-hidden': 'true' }, ' ↗')])
      : el('span', { class: 'btn btn-sm', 'aria-disabled': 'true' }, L('連結待核實', 'Link pending verification'));
    const host = it.url ? new URL(it.url).hostname.replace(/^www\d?\./, '') : '';
    return el('article', { class: 'card opp-card' + (compact ? ' compact' : '') }, [
      compact ? null : el('div', { class: 'opp-thumb' }, [thumb(color, i), el('span', { class: 'tag opp-kind', style: { color, borderColor: color } }, L(KIND[it.kind][0], KIND[it.kind][1]))]),
      el('div', { class: 'stack opp-body', style: { '--gap': '10px' } }, [
        compact ? el('span', { class: 'tag opp-kind', style: { color, borderColor: color, alignSelf: 'flex-start' } }, L(KIND[it.kind][0], KIND[it.kind][1])) : null,
        el('h3', { class: 'opp-title' }, title),
        el('span', { class: 'hint' }, (it.source === 'search' ? L('來源：', 'Source: ') : L('主辦：', 'Run by: ')) + pick(it, 'org')),
        el('p', { class: 'opp-meta' }, pick(it, 'meta')),
        reasonChips(it),
        el('p', { class: 'hint', translate: 'no' }, it.kind === 'role' || it.kind === 'intern' ? L('相關性配對，不代表符合招聘要求。只有已取得資格計入資格配對。', 'Relevance match, not an eligibility assessment. Only earned qualifications count as credential matches.') : L('開放狀態與申請資格：請向主辦機構確認。', 'Confirm application status and eligibility with the organiser.')),
        el('span', { class: 'hint', translate: 'no' }, it.deadline ? L('截止：', 'Deadline: ') + it.deadline : L('未有已核實截止日期', 'No verified deadline')),
        el('button', { type: 'button', class: 'btn btn-sm', translate: 'no', onclick: () => { const ids = store.get('savedOpportunities', []); store.set('savedOpportunities', ids.includes(it.id) ? ids.filter(id => id !== it.id) : [...ids, it.id]); render(); } }, store.get('savedOpportunities', []).includes(it.id) ? L('已儲存 · 取消', 'Saved · remove') : L('儲存機會', 'Save opportunity')),
        ...policies.map((c) => Policy.sourceLine(c)),
        el('div', { class: 'grow' }),
        el('div', { class: 'spread opp-foot' }, [
          el('span', { class: 'mono faint', style: { fontSize: '11px' } }, L('舊版記錄（待重新核實）：', 'Historical record (recheck needed): ') + (it.verifiedAt || L('待核實', 'pending')) + (host ? ' · ' + host : '')),
          link
        ])
      ])
    ]);
  }

  /* ---------- 整頁 ---------- */
  function render() {
    const showRec = kind !== 'scheme';
    const showSchemes = kind === 'all' || kind === 'scheme';
    $('#recommended').hidden = !showRec;
    $('#schemes').hidden = !showSchemes;
    if (showRec) {
      const pool = items.filter((it) => it.kind !== 'scheme' && (kind === 'all' || it.kind === kind) && visible(it));
      const list = ranked(pool).slice(0, kind === 'all' ? TOP : 24);
      $('#rec-count').textContent = L(`顯示 ${list.length} 項（共 ${pool.length} 項）`, `Showing ${list.length} of ${pool.length}`);
      $('#cards').replaceChildren(...(list.length ? list.map((it, i) => card(it, i, false))
        : [el('div', { class: 'empty', style: { gridColumn: '1 / -1' } }, L('這個類型或範疇暫時沒有項目。', 'Nothing in this type or area yet.'))]));
    }
    if (showSchemes) {
      const list = ranked(items.filter((it) => it.kind === 'scheme' && visible(it)));
      $('#scheme-cards').replaceChildren(...(list.length ? list.map((it, i) => card(it, i, true))
        : [el('div', { class: 'empty', style: { gridColumn: '1 / -1' } }, L('這個範疇暫時沒有政府計劃。', 'No government schemes in this area yet.'))]));
    }
  }

  function renderBasis() {
    const box = $('#basis');
    if (!p) {
      box.replaceChildren(el('span', {}, [L('你還沒有建立資料，現在按預設次序顯示。', 'You have not created a profile yet, so items are shown in the default order. '),
        el('a', { href: BASE + 'grad/index.php' }, L('建立資料', 'Create your profile'))]));
      return;
    }
    const row = (cat, values) => el('div', { class: 'match-row' }, [
      el('span', { class: 'tag match-tag match-' + cat }, el('b', {}, L(CAT[cat][0], CAT[cat][1]))),
      el('span', {}, values.length ? values.join(L('、', ', ')) : L('（未填）', '(not set)'))
    ]);
    box.replaceChildren(
      row('major', majors.map(tr)),
      row('interest', interests.map(tr)),
      row('skill', skillList.map(tr)),
      row('cert', certs.map((c) => c.name + L('（' + STATUS[c.status][0] + '）', ' (' + STATUS[c.status][1] + ')')))
    );
  }

  /* 規劃重點範疇：只列出清單中有項目的範疇 */
  function renderAreas() {
    const present = new Set();
    items.forEach((it) => areasOf(it).forEach((a) => present.add(a)));
    present.delete('planning');
    const box = $('#areas');
    box.replaceChildren(el('span', { class: 'hint' }, L('規劃重點範疇', 'Five-Year Plan focus area')),
      ...['all'].concat(Array.from(present)).map((a) => el('button', {
        type: 'button', class: 'chip', 'aria-pressed': a === area ? 'true' : 'false',
        onclick: () => { area = a; renderAreas(); render(); }
      }, a === 'all' ? L('全部範疇', 'All areas') : Policy.areaLabel(a))));
  }

  $('#filters').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    kind = b.dataset.kind;
    $$('button', $('#filters')).forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    render();
  });
  document.addEventListener('tp:languagechange', () => { renderBasis(); renderAreas(); render(); });

  const savedToggle = el('button', { type: 'button', class: 'btn btn-sm', translate: 'no', 'aria-pressed': String(savedOnly), onclick: () => { savedOnly = !savedOnly; savedToggle.setAttribute('aria-pressed', String(savedOnly)); render(); } }, L('只看已儲存', 'Saved only'));
  $('#filters').after(savedToggle);
  document.addEventListener('tp:languagechange', () => { savedToggle.textContent = L('只看已儲存', 'Saved only'); });
  store.set('oppsViewed', true);
  renderBasis();
  renderAreas();
  render();
})();
