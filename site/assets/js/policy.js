/**
 * 第 2 版：政策資料卡的共用顯示（TPPolicy）。
 * 規則：政策內容只來自 site/data/policy.json；一律寫「根據〔文件名稱〕」並附出處連結；只講事實，不評價政策。
 * 頁面要先用 PHP 的 policy_island() 放入資料。中英文切換時，頁面應重新呼叫這裡的函數重繪。
 */
(function () {
  'use strict';
  const { el, language } = TP;
  const STALE_DAYS = 60;
  let data = null;

  function load() {
    if (data) return data;
    const node = document.getElementById('policy-cards');
    try { data = node ? JSON.parse(node.textContent) : { areas: {}, cards: [] }; } catch (e) { data = { areas: {}, cards: [] }; }
    return data;
  }
  const en = () => language() === 'en';
  const all = () => load().cards || [];
  const get = (id) => all().find((c) => c.id === id) || null;
  const forRole = (roleId) => all().filter((c) => (c.roleIds || []).includes(roleId));
  const title = (c) => (en() && c.titleEn ? c.titleEn : c.title);
  const summary = (c) => (en() && c.summaryEn ? c.summaryEn : c.summary);
  const doc = (c) => (en() && c.source.docEn ? c.source.docEn : c.source.doc);
  const areaLabel = (a) => { const v = (load().areas || {})[a]; return v ? (en() ? v[1] : v[0]) : a; };

  /** 核實狀態：未核實（草稿）、已核實、超過 60 日要重新核實。 */
  function status(c) {
    if (!c.verifiedAt) return { kind: 'draft', text: en() ? 'Draft: to be checked against the official text' : '草稿：待對照官方全文核實' };
    if (c.reviewStatus !== 'human_reviewed') return { kind: 'draft', text: en() ? 'Preliminary source check; human review pending' : '初步資料核對；待人手覆核' };
    const days = (Date.now() - new Date(c.verifiedAt + 'T00:00:00').getTime()) / 86400000;
    if (days > STALE_DAYS) return { kind: 'stale', text: (en() ? 'Verified ' : '核實於 ') + c.verifiedAt + (en() ? ' – needs re-checking' : '，需要重新核實') };
    return { kind: 'ok', text: (en() ? 'Verified ' : '已核實 ') + c.verifiedAt };
  }

  const ext = (href, text, cls) => el('a', { href, target: '_blank', rel: 'noopener noreferrer', class: cls || 'policy-link' }, [text, el('span', { 'aria-hidden': 'true' }, ' ↗')]);

  /** 一行出處：根據〔文件〕· 出處 ↗ · 狀態 */
  function sourceLine(c) {
    const st = status(c);
    return el('span', { class: 'policy-source' }, [
      el('span', {}, (en() ? 'Based on ' : '根據') + '〔' + doc(c) + '〕'),
      ext(c.source.url, en() ? 'Source' : '出處'),
      el('span', { class: 'policy-status ' + st.kind, title: st.text + (c.verifiedBy ? '（' + c.verifiedBy + '）' : '') }, st.kind === 'ok' ? (en() ? '✓ checked ' : '✓ 已核實 ') + c.verifiedAt : st.text)
    ]);
  }

  /** 完整的政策卡（標題、摘要、出處、官方全文、核實狀態）。 */
  function card(c, opts = {}) {
    const st = status(c);
    return el('article', { class: 'policy-card' + (opts.compact ? ' compact' : ''), 'data-policy': c.id }, [
      el('div', { class: 'spread', style: { '--gap': '8px' } }, [
        el('span', { class: 'tag policy-area' }, areaLabel(c.area)),
        el('span', { class: 'policy-status ' + st.kind }, st.text)
      ]),
      el('b', { class: 'policy-title' }, title(c)),
      opts.compact ? null : el('p', { class: 'policy-summary' }, summary(c)),
      el('div', { class: 'row', style: { '--gap': '12px' } }, [
        el('span', { class: 'hint' }, (en() ? 'Based on ' : '根據') + '〔' + doc(c) + '〕'),
        ext(c.source.url, en() ? 'Source' : '出處'),
        ext(c.officialUrl, en() ? 'Official text' : '官方全文')
      ])
    ]);
  }

  window.TPPolicy = { all, get, forRole, title, summary, doc, areaLabel, status, sourceLine, card, areas: () => load().areas || {} };
})();
