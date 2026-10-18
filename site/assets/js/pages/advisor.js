/** 職涯方向 AI 助理：路徑建議（只來自職位卡片）＋對話。 */
(function () {
  'use strict';
  const { $, el, api, store, profile, toHK, toast, loading, BASE, language } = TP;
  const Policy = window.TPPolicy;
  const p = profile.get();
  const chat = $('#chat');
  const pathsBox = $('#paths');
  let paths = [];
  let active = 0;
  let history = store.get('advisorChat', []);
  let requestVersion = 0;
  let chatBusy = false;
  let currentSource;
  const sendButton = $('#chat-form button[type="submit"]');
  function showSource(source) {
    currentSource = source;
    const status = $('#advisor-source');
    const basic = source === 'fallback';
    status.hidden = !basic;
    status.textContent = basic
      ? (language() === 'en' ? 'Basic guidance is available for now. Please try again later.' : '目前提供基本建議，稍後可再試。')
      : '';
  }

  function bubble(role, text) {
    const b = el('div', { class: 'bubble ' + (role === 'user' ? 'me' : 'ai'), translate: 'no' }, toHK(text));
    chat.append(b);
    chat.scrollTop = chat.scrollHeight;
    return b;
  }

  function renderPaths() {
    pathsBox.replaceChildren();
    if (!paths.length) return;
    const tabs = el('div', { class: 'grid-3', role: 'tablist', 'aria-label': '路徑', style: { '--gap': '12px' } });
    paths.forEach((path, i) => {
      tabs.append(el('button', {
        type: 'button', role: 'tab', id: 'tab-' + i, 'aria-selected': i === active ? 'true' : 'false', 'aria-controls': 'path-panel',
        class: 'card', style: { padding: '12px 16px', textAlign: 'left', cursor: 'pointer', borderColor: i === active ? 'var(--accent)' : '', background: i === active ? 'var(--accent-soft)' : 'var(--deep)' },
        onclick: () => { active = i; const cached = store.get('advisor'); if (cached) store.set('advisor', { ...cached, active }); renderPaths(); }
      }, [el('span', { class: 'mono', style: { fontSize: '12px', color: i === active ? 'var(--accent)' : 'var(--text-4)', display: 'block' } }, '路徑 ' + 'ABC'[i]), el('b', { style: { fontSize: '16px' } }, language() === 'en' ? (path.nameEn || path.name) : path.name)]));
    });

    const cur = paths[active];
    const explanation = cur.localized?.[language()] || cur;
    const whens = ['現在的你', '補足技能', '第一份工作', '18 個月後'];
    const route = el('div', { class: 'route' }, cur.stations.map((what, i) => el('div', { class: 'stop' + (i === 0 ? ' done' : '') + (i < 1 ? ' line-on' : '') }, [
      el('span', { class: 'dot' }), el('span', { class: 'when' }, whens[i]), el('span', { class: 'what' }, toHK(what))
    ])));
    const box = (title, text, color) => el('div', { class: 'stack', style: { '--gap': '6px', borderRadius: '12px', background: 'var(--surface)', padding: '18px' } }, [
      el('b', { style: { fontSize: '13px', color: color || 'var(--accent)' } }, title), el('span', { style: { fontSize: '14px', color: 'var(--text-2)' } }, toHK(text))
    ]);
    const panel = el('div', { class: 'card card-deep stack', id: 'path-panel', role: 'tabpanel', 'aria-labelledby': 'tab-' + active, style: { '--gap': '26px', padding: '30px' } }, [
      route,
      el('div', { class: 'grid-2', style: { '--gap': '16px' } }, [
        box('為甚麼適合你', explanation.why), box('技能差距', cur.gap), box('第一個 30 日', explanation.plan), box('要留意', cur.risk, 'var(--coral)')
      ]),
      V32.actionButton(explanation.plan, 'career:' + cur.id),
      certBox(cur),
      policyBox(cur),
      el('div', { class: 'row' }, [
        el('a', { class: 'btn btn-primary', href: BASE + 'grad/interview.php', onclick: () => store.set('interviewRole', cur.nameEn || cur.name) }, '練這個職位的面試'),
        el('a', { class: 'btn', href: BASE + 'grad/opportunities.php?role=' + encodeURIComponent(cur.id) }, '看相關機會'),
        el('a', { class: 'btn btn-outline', href: BASE + 'grad/plan.php?path=' + encodeURIComponent(cur.id) }, '把這條路徑變成我的五年規劃')
      ])
    ]);
    const comparison = el('div', { class: 'table-scroll', translate: 'no' }, el('table', {}, [el('thead', {}, el('tr', {}, [V32.L('路徑', 'Path'), V32.L('技能差距', 'Skills to develop'), V32.L('要留意', 'Considerations')].map(x => el('th', { scope: 'col' }, x)))), el('tbody', {}, paths.map(x => el('tr', {}, [language() === 'en' ? x.nameEn : x.name, TP.t(x.gap), TP.t(x.risk)].map(v => el('td', {}, v)))))]));
    pathsBox.append(comparison);
    pathsBox.append(el('div', { class: 'stack', style: { '--gap': '16px' } }, [tabs, panel]));
  }

  /* ---------- 第 2 版：建議證書、與香港五年規劃的關係 ---------- */
  function certBox(cur) {
    const names = cur.certs || [];
    if (!names.length) return null;
    const mine = new Map(((p && p.certifications) || []).map((c) => [c.name.trim().toLowerCase(), c.status]));
    const STATUS = { earned: '已取得', in_progress: '進行中', planned: '計劃考取' };
    return el('div', { class: 'stack', style: { '--gap': '8px', borderRadius: '12px', background: 'var(--surface)', padding: '18px' } }, [
      el('b', { style: { fontSize: '13px', color: 'var(--accent)' } }, '建議證書（來自職位卡，可選）'),
      el('div', { class: 'row', style: { '--gap': '8px' } }, names.map((n) => {
        const st = mine.get(n.trim().toLowerCase());
        return el('span', { class: 'tag' + (st ? ' tag-accent' : ''), style: { whiteSpace: 'normal' } }, [n, st ? el('span', { style: { marginLeft: '2px' } }, '（' + STATUS[st] + '）') : null]);
      })),
      el('span', { class: 'hint' }, '證書不是入行的必要條件。想考取的話，可以在路線總覽加入「計劃考取」，它會成為五年規劃的里程碑。')
    ]);
  }

  function policyBox(cur) {
    const ids = cur.policyIds && cur.policyIds.length ? cur.policyIds : Policy.forRole(cur.id).map((c) => c.id);
    const cards = ids.map((id) => Policy.get(id)).filter(Boolean);
    if (!cards.length) return null;
    return el('section', { class: 'stack', 'aria-label': '與香港五年規劃的關係', style: { '--gap': '10px', borderRadius: '12px', border: '1px solid var(--line-2)', padding: '18px' } }, [
      el('div', { class: 'spread' }, [el('b', { style: { fontSize: '13px', color: 'var(--accent)' } }, '與香港五年規劃的關係'), el('span', { class: 'hint' }, '只列事實和出處，不評價政策')]),
      el('div', { class: 'grid-2', style: { '--gap': '10px' } }, cards.slice(0, 4).map((c) => Policy.card(c, { compact: false })))
    ]);
  }

  async function loadPaths(force) {
    const version = ++requestVersion;
    const requestLanguage = language();
    const key = JSON.stringify({ advisorVersion: 6, profile: V32.fingerprint(p), mode: document.body.dataset.llmMode });
    const cached = store.get('advisor');
    chat.replaceChildren();
    showSource();
    chatBusy = false;
    if (!force && cached && cached.paths?.length && (cached.source === 'ai' || document.body.dataset.llmMode === 'mock')) {
      sendButton.disabled = false;
      paths = cached.paths;
      active = Math.max(0, Math.min(cached.active || 0, paths.length - 1));
      showSource(history.filter((m) => m.role === 'assistant').at(-1)?.source || cached.source);
      renderPaths();
      if (store.get('advisorNeedsReview')) pathsBox.prepend(el('p', { class: 'banner', translate: 'no' }, V32.L('資料已更新；下列路徑來自先前資料。可按「重新建議」更新，對話會保留。', 'Your profile changed. These paths use your earlier profile. Refresh suggestions to update them; chat history is preserved.')));
      if (!history.length) { history = [{ role: 'assistant', text: cached.intro, source: cached.source }]; }
      history.forEach((m) => bubble(m.role, m.text));
      return;
    }
    sendButton.disabled = true;
    pathsBox.replaceChildren(loading('正在按你的資料整理路徑……'));
    try {
      const data = await api('llm.php', { task: 'advisor_paths', profile: p }, requestLanguage);
      if (version !== requestVersion) return;
      showSource(data.source);
      paths = data.paths || [];
      active = 0;
      store.set('advisor', { key, paths, active, intro: data.intro, source: data.source });
      store.set('advisorNeedsReview', false);
      history.push({ role: 'assistant', text: data.intro, source: data.source });
      store.set('advisorChat', history);
      chat.replaceChildren();
      history.forEach(m => bubble(m.role, m.text));
      renderPaths();
    } catch (e) {
      if (version !== requestVersion) return;
      pathsBox.replaceChildren(el('div', { class: 'banner' }, e.message));
    } finally {
      if (version === requestVersion) sendButton.disabled = false;
    }
  }

  $('#chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('#msg');
    const text = input.value.trim();
    if (!text || !p || chatBusy || sendButton.disabled) return;
    chatBusy = true;
    sendButton.disabled = true;
    const version = requestVersion;
    const requestLanguage = language();
    input.value = '';
    history.push({ role: 'user', text });
    bubble('user', text);
    const typing = el('div', { class: 'typing', 'aria-label': 'AI 助理正在回覆' }, [el('span'), el('span'), el('span')]);
    chat.append(typing);
    try {
      const data = await api('llm.php', { task: 'advisor_chat', profile: p, history: history.slice(), paths: paths.map((x) => ({ roleId: x.id })) }, requestLanguage);
      if (version !== requestVersion) { typing.remove(); return; }
      showSource(data.source);
      history.push({ role: 'assistant', text: data.reply, source: data.source });
      store.set('advisorChat', history.slice(-20));
      typing.remove();
      bubble('assistant', data.reply);
    } catch (err) {
      typing.remove();
      if (version !== requestVersion) return;
      toast(err.message, 'error');
    } finally {
      if (version === requestVersion) { chatBusy = false; sendButton.disabled = false; }
    }
  });

  $('#refresh').addEventListener('click', () => loadPaths(true));

  if (!p) {
    const empty = () => el('div', { class: 'empty' }, ['先建立你的資料，AI 助理才能建議路徑。', el('br'), el('a', { class: 'btn btn-primary', href: BASE + 'grad/index.php' }, '建立資料')]);
    pathsBox.append(empty());
    $('#msg').disabled = true;
    $('#refresh').hidden = true;
    return;
  }
  loadPaths(false);
  document.addEventListener('tp:languagechange', () => { renderPaths(); showSource(currentSource); });
})();
