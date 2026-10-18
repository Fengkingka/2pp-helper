/**
 * 全站共用：瀏覽器儲存、API 呼叫、建立 DOM、數字格式、報告。
 * 所有用戶資料都只存在 localStorage（前綴 tp:），不會送到伺服器儲存。
 * AI 產生的文字一律用 textContent 顯示，不使用 innerHTML，避免 XSS。
 */
(function () {
  'use strict';
  const BASE = document.body.dataset.base || '';
  let demoActive = false;
  try { demoActive = sessionStorage.getItem('tp:demoMode') === '1'; } catch (_) {}
  const PREFIX = demoActive ? 'tp:demo:' : 'tp:';
  const memory = {};

  const store = {
    persistent: true,
    get(key, fallback = null) {
      if (key in memory) return memory[key];
      try {
        const raw = localStorage.getItem(PREFIX + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) {
        return key in memory ? memory[key] : fallback;
      }
    },
    set(key, value) {
      memory[key] = value;
      try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); store.persistent = true; } catch (e) { store.persistent = false; }
      document.dispatchEvent(new CustomEvent('tp:storage', { detail: { persistent: store.persistent } }));
      return store.persistent;
    },
    remove(key) {
      delete memory[key];
      try { localStorage.removeItem(PREFIX + key); } catch (e) { /* 忽略 */ }
    },
    clearAll() {
      Object.keys(memory).forEach((k) => delete memory[k]);
      try {
        Object.keys(localStorage).filter((k) => k.startsWith(PREFIX) && (demoActive || !k.startsWith('tp:demo:'))).forEach((k) => localStorage.removeItem(k));
      } catch (e) { /* 忽略 */ }
    }
  };

  async function api(path, body, requestLanguage) {
    const lang = requestLanguage || (window.TPI18n ? window.TPI18n.language() : 'zh-HK');
    if (body !== undefined && body && typeof body === 'object') body = { ...body, _lang: lang };
    // 第 2 版：問卷結果預設不送出；用戶在問卷頁選擇「讓 AI 助理參考」後才會隨資料送出
    if (body && body.profile && body.profile.strengths && body.profile.strengths.shareWithAI !== true) {
      body = { ...body, profile: { ...body.profile, strengths: null } };
    }
    const opts = body === undefined
      ? { method: 'GET', headers: { Accept: 'application/json', 'Accept-Language': lang } }
      : { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Accept-Language': lang }, body: JSON.stringify(body) };
    let res;
    try {
      res = await fetch(BASE + 'api/' + path, opts);
    } catch (e) {
      throw new Error('無法連接伺服器。請檢查網絡，然後再試一次。');
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* 非 JSON */ }
    if (!res.ok) throw new Error((data && data.error) || '伺服器暫時未能處理，請稍後再試。');
    return data;
  }

  /** 建立元素：el('div', {class: 'card', onclick: fn}, ['文字', 子元素]) */
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'style' && typeof v === 'object') {
        for (const [prop, val] of Object.entries(v)) {
          if (prop.startsWith('--')) node.style.setProperty(prop, val);
          else node.style[prop] = val;
        }
      }
      else node.setAttribute(k, v === true ? '' : String(v));
    }
    for (const c of [].concat(children || [])) {
      if (c === null || c === undefined || c === false) continue;
      node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return node;
  }

  function svg(tag, attrs, children) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v !== null && v !== undefined) node.setAttribute(k, String(v));
    for (const c of [].concat(children || [])) if (c) node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    return node;
  }

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const fmt = {
    hk: (n) => (n < 0 ? '−' : '') + 'HK$ ' + Math.round(Math.abs(n)).toLocaleString('en-US'),
    hkK: (n) => (n < 0 ? '−' : '') + 'HK$ ' + Math.round(Math.abs(n) / 1000).toLocaleString('en-US') + 'k',
    wan: (n) => 'HK$ ' + Math.round(n / 1e4).toLocaleString('en-US') + ' 萬',
    pct: (v, d = 1) => (v * 100).toFixed(d) + '%',
    months: (m) => (m === Infinity || m > 99 ? '有盈利' : m.toFixed(1) + ' 個月')
  };

  const toHK = (s) => (window.OpenCCHK && typeof s === 'string' ? window.OpenCCHK.toHK(s) : s);

  let toastTimer = null;
  function toast(message, kind) {
    let t = $('.toast');
    if (!t) {
      t = el('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
      document.body.append(t);
    }
    t.className = 'toast' + (kind === 'error' ? ' error' : '');
    t.textContent = message;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, kind === 'error' ? 6000 : 3500);
  }

  function readJson(id) {
    const node = document.getElementById(id);
    return node ? JSON.parse(node.textContent) : null;
  }

  function loading(text) {
    return el('div', { class: 'loading', role: 'status' }, [el('span', { class: 'spinner' }), text || '處理中……']);
  }

  /* ---------- 用戶資料 ---------- */
  const profile = {
    get: () => store.get('profile'),
    set: (p) => store.set('profile', p),
    startup: () => store.get('startup') || Engine.demo.startup,
    setStartup: (s) => store.set('startup', s)
  };

  /* ---------- 報告 ---------- */
  const reports = {
    list: () => store.get('reports', []),
    get: (id) => reports.list().find((r) => r.id === id) || null,
    save(meta, report) {
      const id = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const entry = { id, createdAt: new Date().toISOString(), ...meta, report };
      store.set('reports', [entry, ...reports.list()].slice(0, 30));
      return id;
    },
    remove(id) { store.set('reports', reports.list().filter((r) => r.id !== id)); },
    /** 送出練習紀錄 → 伺服器評分 → 儲存 → 前往報告頁 */
    async evaluateAndOpen(log, meta) {
      const report = await api('evaluate.php', { log });
      const id = reports.save(meta, report);
      location.href = BASE + 'reports.php?id=' + encodeURIComponent(id);
      return id;
    }
  };

  /* ---------- 圖表工具 ---------- */
  function linePoints(values, { x0, x1, y0, y1, min, max, count }) {
    const n = count || values.length - 1 || 1;
    return values.map((v, i) => {
      const x = x0 + (i / n) * (x1 - x0);
      const y = y1 - ((v - min) / (max - min || 1)) * (y1 - y0);
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
  }

  /* ---------- 全站：清除資料 ---------- */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="clear-data"]');
    if (!btn) return;
    if (!confirm('確定要清除這個瀏覽器裡的所有資料和報告嗎？這個動作不能復原。')) return;
    store.clearAll();
    toast('已清除所有資料。');
    setTimeout(() => location.reload(), 800);
  });

  const t = (text) => (window.TPI18n ? window.TPI18n.t(text) : text);
  const language = () => (window.TPI18n ? window.TPI18n.language() : 'zh-HK');
  const demo = { active: demoActive,
    start() { try { sessionStorage.setItem('tp:demoMode', '1'); } catch (_) { toast('Cannot start a protected demo because session storage is unavailable.', 'error'); return; } location.reload(); },
    exit() { try { sessionStorage.removeItem('tp:demoMode'); } catch (_) {} location.reload(); }
  };
  window.TP = { demo, BASE, store, api, el, svg, $, $$, fmt, toHK, toast, readJson, loading, profile, reports, linePoints, t, language };
})();
