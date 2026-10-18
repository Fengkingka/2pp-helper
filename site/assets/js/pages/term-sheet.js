/**
 * Term Sheet 談判：選項來自劇本 JSON；股權、退出分配、反攤薄和跟投權全部由 Engine.calc 計算（AI 不計數）。
 * 第 2 版：6 輪條款；投資者類型（天使／種子投資者、政府引導基金（虛構示範））各有一個劇本，共用 term_sheet_v1 評分準則。
 * 種子輪之後假設有 A 輪、B 輪（LATER_ROUNDS），讓用戶看到條款在退出時的真正影響；
 * 另有一個 A 輪估值下跌的壓力測試（DOWN_ROUND），比較三種反攤薄條款。
 */
(function () {
  'use strict';
  const { $, el, api, profile, reports, fmt, loading, t } = TP;
  const INVESTORS = [
    { key: 'angel', id: 'term_sheet_seed_v1' },
    { key: 'fund', id: 'term_sheet_guidance_fund_v1' }
  ];
  const DEFAULT_INVESTMENT = 2000000;
  const EXITS = [30000000, 60000000, 200000000];
  const SEED = '種子輪';
  const FOLLOW = '種子輪（A 輪跟投）';
  const LATER_ROUNDS = [
    { name: 'A 輪', preMoney: 24000000, investment: 6000000, poolTargetPct: 0.1, poolTiming: 'pre', liqMultiple: 1, participating: false },
    { name: 'B 輪', preMoney: 80000000, investment: 20000000, poolTargetPct: 0, poolTiming: 'pre', liqMultiple: 1, participating: false }
  ];
  // 壓力測試：A 輪估值下跌，每股價格低於種子輪（種子輪每股 HK$0.48 至 0.80，這一輪約 HK$0.27 至 0.36）
  const DOWN_ROUND = { name: 'A 輪', preMoney: 5000000, investment: 5000000, poolTargetPct: 0.1, poolTiming: 'pre', liqMultiple: 1, participating: false };
  const AD_KINDS = [['none', '不設反攤薄條款'], ['broad_based', 'Broad-based weighted average'], ['full_ratchet', 'Full ratchet']];
  const company = profile.startup();
  const loaded = {};   // investor key → 劇本
  let investor = 'angel', scenario = null, steps = [], at = 0, furthest = 0;
  const choice = {};   // term key → 選項 index
  const messages = {}; // step id → 回覆

  const allTerms = () => steps.flatMap((s) => s.terms);
  const stepIndexOf = (key) => steps.findIndex((s) => s.terms.some((t) => t.key === key));
  /** 只有談到該輪之後，反攤薄和跟投權才計入結果（未談到的輪次不假設已接受） */
  const reached = (key) => { const i = stepIndexOf(key); return i >= 0 && i <= furthest; };
  const investment = () => (scenario && scenario.investor && scenario.investor.investment) || DEFAULT_INVESTMENT;
  const chosen = (key) => {
    const term = allTerms().find((t) => t.key === key);
    return term ? term.options[choice[key] ?? 0] : null;
  };

  function parse() {
    const v = (k) => (chosen(k) || {}).value;
    const walked = allTerms().some((t) => (t.options[choice[t.key] ?? 0] || {}).outcome === 'investor_walks');
    const pool = String(v('pool') || 'none');
    const liq = String(v('liqPref') || '1x_non_participating');
    const pm = pool.match(/^(pre|post)_([\d.]+)$/);
    const lm = liq.match(/^(\d+(?:\.\d+)?)x_(participating|non_participating)$/);
    const ad = reached('antiDilution') ? String(v('antiDilution') || 'none') : 'none';
    const pr = reached('proRata') ? String(v('proRata') || 'none') : 'none';
    const sm = pr.match(/^super_(\d+(?:\.\d+)?)x$/);
    return {
      walked,
      seed: {
        name: SEED, preMoney: Number(v('preMoney')) || 0, investment: investment(),
        poolTargetPct: pm ? Number(pm[2]) : 0, poolTiming: pm ? pm[1] : 'pre',
        liqMultiple: lm ? Number(lm[1]) : 1, participating: lm ? lm[2] === 'participating' : false
      },
      boardSeats: Number(v('boardSeats')) || 0,
      antiDilution: AD_KINDS.some(([k]) => k === ad) ? ad : 'none',
      proRataMultiple: pr === 'standard' ? 1 : sm ? Number(sm[1]) : 0
    };
  }

  function compute(terms) {
    if (terms.walked || terms.seed.preMoney <= 0) return null;
    const c = Engine.calc;
    const initial = [{ id: 'founders', shares: company.founderShares }];
    const seed = c.applyRound(initial, terms.seed);
    const a = c.applyRoundWithProRata(seed.table, LATER_ROUNDS[0], SEED, terms.proRataMultiple, FOLLOW);
    const b = c.applyRound(a.table, LATER_ROUNDS[1]);
    const seedTotal = (o) => (o[SEED] || 0) + (o[FOLLOW] || 0);
    const exits = c.exitScenarios(b.table, EXITS, 'founders').map((x) => ({
      ...x, seedInvestor: seedTotal(c.computeWaterfall(b.table, x.exitValue).payouts)
    }));
    const afterA = c.ownership(a.table);
    const noProRata = terms.proRataMultiple > 0 ? c.ownership(c.applyRound(seed.table, LATER_ROUNDS[0]).table) : afterA;
    const stress = AD_KINDS.map(([kind, label]) => {
      const r = c.applyRoundWithAntiDilution(seed.table, DOWN_ROUND, SEED, kind);
      const o = c.ownership(r.table);
      return { kind, label, founders: o.founders, seed: o[SEED] || 0, adjustedPrice: r.adjustedPrice, newPrice: r.pricePerShare, isDownRound: r.isDownRound };
    });
    return {
      afterSeed: c.ownership(seed.table), afterB: c.ownership(b.table), exits,
      seedPrice: seed.pricePerShare, aPrice: a.pricePerShare, stress,
      proRata: {
        multiple: terms.proRataMultiple, amount: a.proRataAmount, lead: a.leadInvestment, round: LATER_ROUNDS[0].investment,
        seedPctAfterA: seedTotal(afterA), seedPctNoProRata: noProRata[SEED] || 0,
        foundersAfterA: afterA.founders, foundersNoProRata: noProRata.founders
      }
    };
  }

  /* ---------- 投資者類型 ---------- */
  function renderInvestorPick() {
    const keys = INVESTORS.filter((x) => loaded[x.key]);
    $('#investor-type').replaceChildren(...keys.map((x) => el('button', {
      type: 'button', 'data-investor': x.key, 'aria-pressed': x.key === investor ? 'true' : 'false',
      onclick: () => switchInvestor(x.key)
    }, (loaded[x.key].investor && loaded[x.key].investor.label) || loaded[x.key].title)));
    $('.investor-pick').hidden = keys.length < 2;
    const note = scenario.investor && scenario.investor.disclaimer;
    $('#investor-note').hidden = !note;
    $('#investor-note').textContent = note || '';
  }

  function useInvestor(key) {
    investor = key;
    scenario = loaded[key];
    steps = scenario.steps.filter((s) => s.type === 'proposal');
    at = 0;
    furthest = 0;
    Object.keys(choice).forEach((k) => delete choice[k]);
    Object.keys(messages).forEach((k) => delete messages[k]);
    renderInvestorPick();
    renderStep();
  }

  function switchInvestor(key) {
    if (key === investor || !loaded[key]) return;
    const dirty = at > 0 || Object.keys(choice).length > 0 || Object.values(messages).some((m) => m.trim());
    if (dirty && !confirm(t('轉換投資者會清除目前的選擇和回覆，要繼續嗎？'))) return;
    useInvestor(key);
    try { history.replaceState(null, '', key === 'angel' ? location.pathname : '?investor=' + key); } catch (e) { /* 忽略 */ }
    const b = $('[data-investor="' + key + '"]');
    if (b) b.focus();
  }

  /* ---------- 談判區 ---------- */
  function renderStep(focus) {
    const step = steps[at];
    $('#round-text').textContent = '第 ' + (at + 1) + ' / ' + steps.length + ' 輪';
    $('#investor-line').textContent = '「' + step.investorLine + '」';
    $('#terms').replaceChildren(...step.terms.map((term) => {
      const picked = term.options[choice[term.key] ?? 0];
      const opts = el('div', { class: 'opts', role: 'group', 'aria-label': term.label }, term.options.map((o, i) => el('button', {
        type: 'button', class: 'opt' + (o.outcome === 'investor_walks' ? ' walk' : ''), 'aria-pressed': picked === o ? 'true' : 'false',
        'data-term': term.key, 'data-i': i,
        onclick: () => { choice[term.key] = i; renderStep({ key: term.key, i }); }
      }, [o.label, el('span', { class: 'act' }, { accept: '接受', counter: '還價', reject: '拒絕' }[o.action] || o.action)])));
      return el('div', { class: 'opt-row' }, [
        el('span', { class: 'k' }, term.label),
        el('div', { class: 'stack', style: { '--gap': '10px' } }, [opts, picked && picked.explain ? el('p', { class: 'term-explain' }, picked.explain) : null])
      ]);
    }));
    $('#message').value = messages[step.id] || '';
    $('#prev').disabled = at === 0;
    $('#next').textContent = at === steps.length - 1 ? '完成談判，產生報告' : '下一輪';
    renderResults();
    if (focus) {
      const b = $('#terms [data-term="' + focus.key + '"][data-i="' + focus.i + '"]');
      if (b) b.focus();
    }
  }

  /* ---------- 結果區 ---------- */
  const COLORS = { founders: '#FF8A66', pool: '#56656A', [SEED]: '#FFB199', [FOLLOW]: '#FFD9CC', 'A 輪': '#3FE0B5', 'B 輪': '#7CF0CF' };
  const holderLabel = (k) => (k === 'founders' ? '創辦人' : k === 'pool' ? '期權池' : k);

  function bar(own) {
    const entries = Object.entries(own);
    return el('div', { class: 'stack', style: { '--gap': '8px' } }, [
      el('div', { style: { display: 'flex', height: '14px', borderRadius: '7px', overflow: 'hidden', background: 'var(--surface-3)' } },
        entries.map(([k, v]) => el('span', { title: holderLabel(k), style: { width: (v * 100) + '%', background: COLORS[k] || '#8C9B98' } }))),
      el('div', { class: 'legend' }, entries.map(([k, v]) => el('span', {}, [
        el('i', { style: { width: '10px', height: '10px', borderRadius: '2px', background: COLORS[k] || '#8C9B98', display: 'inline-block' } }),
        el('span', {}, holderLabel(k)), el('span', { class: 'mono' }, fmt.pct(v))
      ])))
    ]);
  }

  const price = (p) => 'HK$ ' + p.toFixed(2);

  function renderStress(terms, mine) {
    const card = $('#stress-card');
    card.hidden = !mine || !reached('antiDilution');
    if (card.hidden) return;
    $('#stress-desc').textContent = '假設 A 輪估值下跌：投前 ' + fmt.wan(DOWN_ROUND.preMoney) + '、投資 ' + fmt.wan(DOWN_ROUND.investment) + '、期權池 10%，每股價格低於種子輪。下表比較三種反攤薄條款下，A 輪後的持股。';
    const head = el('tr', {}, [el('th', { scope: 'col' }, '反攤薄條款'), el('th', { scope: 'col' }, '創辦人'), el('th', { scope: 'col' }, SEED)]);
    const rows = mine.stress.map((r) => {
      const isMine = r.kind === terms.antiDilution;
      return el('tr', { class: isMine ? 'is-chosen' : null }, [
        el('th', { scope: 'row' }, el('div', { class: 'stress-cell' }, [
          el('span', { class: 'stress-name' }, [el('span', {}, r.label), isMine ? el('span', { class: 'tag tag-coral' }, '你的選擇') : null]),
          el('span', { class: 'hint' }, [el('span', {}, '換股價'), ' ', el('span', { class: 'mono' }, price(r.adjustedPrice))])
        ])),
        el('td', { class: 'mono' }, fmt.pct(r.founders)),
        el('td', { class: 'mono' }, fmt.pct(r.seed))
      ]);
    });
    $('#stress').replaceChildren(
      el('div', { class: 'stress-prices' }, [
        el('div', { class: 'stat' }, [el('span', { class: 'k' }, '種子輪每股價格'), el('span', { class: 'v' }, price(mine.seedPrice))]),
        el('div', { class: 'stat' }, [el('span', { class: 'k' }, '下跌輪每股價格'), el('span', { class: 'v' }, price(mine.stress[0].newPrice))])
      ]),
      el('table', { class: 'stress-table' }, [el('thead', {}, [head]), el('tbody', {}, rows)]),
      el('p', { class: 'hint' }, mine.aPrice >= mine.seedPrice
        ? '主要計算的 A 輪（投前 2,400 萬）每股價格高於種子輪，反攤薄條款不會觸發；只有估值下跌時才會影響持股。'
        : '主要計算的 A 輪每股價格低於種子輪，反攤薄條款會觸發。')
    );
  }

  function renderProRata(mine) {
    const card = $('#prorata-card');
    card.hidden = !mine || !reached('proRata');
    if (card.hidden) return;
    const p = mine.proRata;
    const row = (label, value, note) => el('div', { class: 'pr-row' }, [
      el('span', { class: 'k' }, label),
      el('span', { class: 'stack', style: { '--gap': '0', alignItems: 'flex-end' } }, [el('b', { class: 'mono' }, value), note])
    ]);
    const same = Math.abs(p.foundersAfterA - p.foundersNoProRata) < 1e-9;
    $('#prorata').replaceChildren(
      row('種子輪投資者 A 輪後持股', fmt.pct(p.seedPctAfterA), p.multiple > 0 ? el('span', { class: 'hint' }, [el('span', {}, '不跟投時'), ' ', el('span', { class: 'mono' }, fmt.pct(p.seedPctNoProRata))]) : null),
      row('種子輪投資者跟投金額', fmt.wan(p.amount), null),
      row('A 輪新投資者分到的額度', fmt.wan(p.lead), el('span', { class: 'hint' }, [el('span', {}, '全輪'), ' ', el('span', {}, fmt.wan(p.round))])),
      row('創辦人 A 輪後持股', fmt.pct(p.foundersAfterA), el('span', { class: 'hint' }, same ? '與不設跟投權相同' : [el('span', {}, '不跟投時'), ' ', el('span', { class: 'mono' }, fmt.pct(p.foundersNoProRata))])),
      el('p', { class: 'hint' }, '跟投只計算 A 輪，價格和條款與 A 輪新投資者相同；B 輪假設種子輪投資者不跟投。')
    );
  }

  function renderResults() {
    const terms = parse();
    const mine = compute(terms);
    $('#walk-banner').hidden = !terms.walked;
    renderStress(terms, mine);
    renderProRata(mine);
    if (!mine) {
      $('#ownership').replaceChildren(el('p', { class: 'muted' }, '沒有交易，股權維持不變：創辦人 100%。'));
      $('#exits').replaceChildren();
      return;
    }
    const baseline = acceptAll();
    $('#ownership').replaceChildren(
      el('span', { class: 'hint' }, '種子輪後'), bar(mine.afterSeed),
      el('span', { class: 'hint' }, 'B 輪後'), bar(mine.afterB)
    );
    const rows = mine.exits.map((x, i) => {
      const diff = baseline ? x.amount - baseline.exits[i].amount : 0;
      return el('div', { class: 'spread', style: { padding: '10px 0', borderTop: '1px solid var(--line)' } }, [
        el('span', { class: 'mono', style: { fontSize: '14px' } }, '退出 ' + fmt.wan(x.exitValue)),
        el('span', { class: 'stack', style: { '--gap': '0', alignItems: 'flex-end' } }, [
          el('b', { class: 'mono', style: { fontSize: '18px' } }, fmt.wan(x.amount) + '（' + fmt.pct(x.share, 0) + '）'),
          diff > 1 ? el('span', { class: 'hint', style: { color: 'var(--teal)' } }, '比全部接受多 ' + fmt.wan(diff)) : null
        ])
      ]);
    });
    $('#exits').replaceChildren(...rows);
    $('#assumptions').textContent = '假設：種子輪投資 ' + fmt.wan(investment()) + '；A 輪投前 2,400 萬、投資 600 萬、期權池 10%；B 輪投前 8,000 萬、投資 2,000 萬；後續輪次均為 1x non-participating。';
  }

  function acceptAll() {
    const saved = { ...choice };
    allTerms().forEach((t) => { choice[t.key] = 0; });
    const r = compute(parse());
    Object.keys(choice).forEach((k) => delete choice[k]);
    Object.assign(choice, saved);
    return r;
  }

  /* ---------- 完成 ---------- */
  const pct1 = (v) => Math.round(v * 1000) / 10;

  /** 每一輪的計算結果（給評分器引用；AI 不會自行計算） */
  function stepCalc(step, terms, result) {
    if (!result) return undefined;
    const keys = step.terms.map((t) => t.key);
    if (keys.includes('antiDilution')) {
      const pick = result.stress.find((r) => r.kind === terms.antiDilution);
      const none = result.stress.find((r) => r.kind === 'none');
      return {
        downRoundFounderPct: pct1(pick.founders),
        downRoundFounderPctWithoutAntiDilution: pct1(none.founders),
        downRoundSeedPct: pct1(pick.seed),
        downRoundSeedConversionPrice: Math.round(pick.adjustedPrice * 100) / 100,
        seedPricePerShare: Math.round(result.seedPrice * 100) / 100
      };
    }
    if (keys.includes('proRata')) {
      const p = result.proRata;
      return {
        seedPctAfterA: pct1(p.seedPctAfterA),
        seedPctAfterAWithoutProRata: pct1(p.seedPctNoProRata),
        seedProRataAmount: Math.round(p.amount),
        seriesALeadAmount: Math.round(p.lead),
        founderPctAfterA: pct1(p.foundersAfterA)
      };
    }
    return undefined;
  }

  async function finish() {
    const terms = parse();
    const result = compute(terms);
    const log = Engine.engine.newSession(scenario);
    steps.forEach((s) => {
      const inputs = {};
      s.terms.forEach((t) => {
        const o = t.options[choice[t.key] ?? 0];
        inputs[t.key] = o.value;
        inputs[t.key + '_choice'] = o.label;
        inputs[t.key + '_action'] = o.action;
      });
      const entry = { stepId: s.id, inputs, text: (messages[s.id] || '').trim() || undefined };
      const calc = stepCalc(s, terms, result);
      if (calc) entry.calc = calc;
      log.steps.push(entry);
    });
    log.outcome = terms.walked ? 'investor_walks' : 'deal';
    log.finalCalc = terms.walked ? { walked: 1 } : {
      walked: 0,
      founderPctAfterSeed: pct1(result.afterSeed.founders),
      founderPctAfterB: pct1(result.afterB.founders),
      founderPayoutExit30M: Math.round(result.exits[0].amount),
      founderPayoutExit60M: Math.round(result.exits[1].amount),
      founderPayoutExit200M: Math.round(result.exits[2].amount),
      seedInvestorPayoutExit60M: Math.round(result.exits[1].seedInvestor),
      investorBoardSeats: terms.boardSeats
    };
    const btn = $('#next');
    btn.disabled = true;
    $('#status').replaceChildren(loading('正在產生報告……'));
    const fund = investor === 'fund';
    try {
      await reports.evaluateAndOpen(log, {
        scenarioId: scenario.id, route: 'startup',
        title: (fund ? 'Term Sheet（政府引導基金）：' : 'Term Sheet：') + company.name,
        retry: 'startup/term-sheet.php' + (fund ? '?investor=fund' : ''), next: 'startup/b2b.php'
      });
    } catch (e) {
      $('#status').replaceChildren(el('span', { class: 'banner' }, e.message));
      btn.disabled = false;
      btn.textContent = '重新評分';
    }
  }

  function go(next) {
    at = next;
    furthest = Math.max(furthest, at);
    renderStep();
    const card = $('#investor-line').closest('.card');
    if (card && card.getBoundingClientRect().top < 0) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  $('#message').addEventListener('input', () => { messages[steps[at].id] = $('#message').value; });
  $('#prev').addEventListener('click', () => { if (at > 0) go(at - 1); });
  $('#next').addEventListener('click', () => { if (at < steps.length - 1) go(at + 1); else finish(); });

  (async function init() {
    $('#terms').replaceChildren(loading('正在載入劇本……'));
    const results = await Promise.allSettled(INVESTORS.map((x) => api('scenario.php?id=' + x.id)));
    results.forEach((r, i) => { if (r.status === 'fulfilled') loaded[INVESTORS[i].key] = r.value; });
    const want = new URLSearchParams(location.search).get('investor') === 'fund' ? 'fund' : 'angel';
    const first = loaded[want] ? want : INVESTORS.map((x) => x.key).find((k) => loaded[k]);
    if (!first) {
      const failed = results.find((r) => r.status === 'rejected');
      $('#terms').replaceChildren(el('div', { class: 'banner' }, failed ? failed.reason.message : '暫時未能載入劇本，請重新整理頁面。'));
      return;
    }
    useInvestor(first);
  })();
})();
