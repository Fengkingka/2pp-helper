/**
 * Black Swan：由劇本 JSON 抽 3 張事件卡（第 3、6、9 月），用戶逐張作決定。
 * 所有數字都由 Engine.engine.runBlackSwan（即 engine 的計算器）算出，AI 只在最後評分。
 * 輸入欄位按劇本的 InputSpec 自動產生，J2 加新事件卡不需要改這個檔案。
 */
(function () {
  'use strict';
  const { $, el, svg, api, profile, reports, fmt, linePoints, toast, loading, t } = TP;
  const MONTHS = [3, 6, 9];
  const DECISION_KEYS = ['headcount', 'avgSalary', 'marketing', 'price', 'otherCost', 'serverCost'];
  const MONEY = new Set(['marketing', 'price', 'otherCost', 'serverCost', 'avgSalary', 'bridgeRound']);

  const company = profile.startup();
  if (!company.finance) { company.finance = Engine.calc.migrateFinancial(company); profile.setStartup(company); }
  let scenario = null, drawn = [], log = null, idx = 0, pending = {}, pendingDefaults = {}, reasoning = '';

  const run = (l) => Engine.engine.runBlackSwan(company, drawn, l, 12);
  const pendingLog = () => ({ ...log, steps: log.steps.concat(idx < drawn.length ? [{ stepId: drawn[idx].id, inputs: numericInputs(pending) }] : []) });
  const numericInputs = (o) => Object.fromEntries(Object.entries(o).filter(([k, v]) => typeof v === 'number' && v !== pendingDefaults[k]));
  const valueText = (key, v) => (key === 'headcount' ? v + ' 人' : MONEY.has(key) ? fmt.hk(v) : String(v));

  /** 事件月初的狀態：公司設定 → 之前的事件和決定 → 今次事件的效果 */
  function defaultsFor(i) {
    if (company.finance) {
      const result = Engine.engine.runBlackSwan(company, drawn.slice(0, i+1), log, 12);
      const row = result.financial.rows[drawn[i].month-1];
      return { headcount:row.headcount, avgSalary:row.staffSalary, serverCost:row.serverCost, marketing:row.marketing, otherCost:row.otherCost, price:row.price, bridgeRound:0 };
    }
    const c = { ...Engine.engine.profileToRunway(company) };
    for (let j = 0; j <= i; j++) {
      const f = drawn[j].card.effects;
      if (f.headcountDelta) c.headcount = Math.max(0, c.headcount + f.headcountDelta);
      if (f.serverCostMultiplier) c.serverCost = Math.round(c.serverCost * f.serverCostMultiplier);
      if (j < i) {
        const st = log.steps.find((s) => s.stepId === drawn[j].id);
        if (st) DECISION_KEYS.forEach((k) => { if (typeof st.inputs[k] === 'number') c[k] = st.inputs[k]; });
      }
    }
    c.bridgeRound = 0;
    return c;
  }

  /* ---------- 時間線 ---------- */
  function renderMonths() {
    const eventMonths = new Map(drawn.map((d, i) => [d.month, i]));
    const box = $('#months');
    const cur = idx < drawn.length ? drawn[idx].month : 13;
    box.replaceChildren(...Array.from({ length: 13 }, (_, m) => {
      const isEvent = eventMonths.has(m);
      const cls = ['stop', isEvent ? 'event' : '', m < cur ? 'done line-on' : '', m === cur ? 'now' : '', m > cur ? 'off' : ''].join(' ');
      return el('div', { class: cls }, [el('span', { class: 'dot' }), el('span', { class: 'when' }, m === 0 ? '開始' : m + '月')]);
    }));
    $('#progress-text').textContent = idx < drawn.length ? '事件 ' + (idx + 1) + ' / ' + drawn.length : '已完成';
  }

  /* ---------- 事件卡與輸入 ---------- */
  function renderEvent() {
    const ev = drawn[idx];
    const defaults = defaultsFor(idx);
    pendingDefaults = {...defaults};
    pending = {};
    reasoning = '';
    const fields = ev.inputs.map((spec) => field(spec, defaults));
    const submit = el('button', { type: 'button', class: 'btn btn-coral' }, idx === drawn.length - 1 ? '確定，看 12 個月結果' : '確定，進入下一個事件');
    submit.addEventListener('click', commit);
    $('#event').replaceChildren(...[
      el('span', { class: 'event-kicker' }, '第 ' + ev.month + ' 個月・突發事件'),
      el('h1', { style: { fontSize: '26px', fontWeight: '800' } }, ev.card.title),
      el('p', { class: 'muted', style: { fontSize: '15px' } }, ev.card.body),
      policyBox(ev),
      el('div', { class: 'stack', style: { '--gap': '16px', paddingTop: '8px', borderTop: '1px solid var(--line-2)' } }, fields),
      el('div', { class: 'row', style: { justifyContent: 'flex-end' } }, [submit])
    ].filter(Boolean));
    update();
  }

  /**
   * 第 2 版：政策事件卡。事件本身是虛構情景（卡面已註明），這裡只附上相關政策的出處，
   * 標題用「相關政策背景」，避免令人以為事件是真實的政府措施。政策內容只來自 policy.json。
   */
  function policyBox(ev) {
    const card = ev.policyId && window.TPPolicy ? TPPolicy.get(ev.policyId) : null;
    if (!card) return null;
    return el('aside', { class: 'event-policy', 'data-policy-box': ev.policyId, 'aria-label': '相關政策背景' }, [
      el('span', { class: 'event-policy-label' }, '相關政策背景'),
      el('b', { class: 'event-policy-title' }, TPPolicy.title(card)),
      TPPolicy.sourceLine(card)
    ]);
  }

  // 政策資料的中英文由 policy.js 產生，切換語言時重繪
  document.addEventListener('tp:languagechange', () => {
    const box = $('[data-policy-box]');
    const ev = drawn[idx];
    if (box && ev && ev.policyId === box.dataset.policyBox) {
      const next = policyBox(ev);
      if (next) box.replaceWith(next);
    }
  });

  function field(spec, defaults) {
    const id = 'in-' + spec.key;
    // Existing event sliders must not silently change a user's custom scenario.
    if (company.finance && (spec.kind === 'slider' || spec.kind === 'number')) {
      const current = defaults[spec.key] ?? 0;
      spec = {...spec, min: Math.min(spec.min ?? current, current, spec.key==='headcount'?1:Infinity), max: Math.max(spec.max ?? current, current)};
      if (spec.key === 'avgSalary') spec.label = V32.L('員工平均月薪（創辦人月薪不變）','Average staff pay (founder pay unchanged)');
      if (spec.key === 'otherCost') spec.label = V32.L('其他營運支出（不包括租金）','Other operating costs (excluding rent)');
    }
    const clamp = (v) => Math.min(spec.max ?? Infinity, Math.max(spec.min ?? -Infinity, v));
    if (spec.kind === 'slider' || spec.kind === 'number') {
      const start = clamp(defaults[spec.key] ?? spec.min ?? 0);
      pending[spec.key] = start;
      const out = el('output', { for: id }, valueText(spec.key, start));
      const input = el('input', { id, type: spec.kind === 'slider' ? 'range' : 'number', class: spec.kind === 'number' ? 'input num' : null, min: spec.min, max: spec.max, step: spec.step || 1, value: start });
      input.addEventListener('input', () => {
        const v = Number(input.value);
        if (!Number.isFinite(v)) return;
        pending[spec.key] = clamp(v);
        out.textContent = valueText(spec.key, pending[spec.key]);
        update();
      });
      return el('div', { class: 'field range-field' }, [el('label', { for: id }, [spec.label, out]), input]);
    }
    if (spec.kind === 'choice') {
      const opts = spec.options || [];
      const initial = opts.find((o) => o.value === defaults[spec.key]) || opts[0];
      pending[spec.key] = initial.value;
      pending[spec.key + '_choice'] = initial.label;
      const seg = el('div', { class: 'seg', role: 'group', 'aria-label': spec.label }, opts.map((o) => el('button', {
        type: 'button', 'aria-pressed': o === initial ? 'true' : 'false',
        onclick: (e) => {
          pending[spec.key] = o.value;
          pending[spec.key + '_choice'] = o.label;
          Array.from(seg.children).forEach((b) => b.setAttribute('aria-pressed', b === e.currentTarget ? 'true' : 'false'));
          update();
        }
      }, o.label)));
      return el('div', { class: 'field' }, [el('span', { class: 'label' }, spec.label), seg]);
    }
    // text：理由
    const max = spec.maxChars || 200;
    const count = el('span', { class: 'mono faint', style: { fontSize: '12px' } }, '0 / ' + max);
    const ta = el('textarea', { id, class: 'textarea', rows: '3', maxlength: max, placeholder: '例如：先減市場預算，保留現金補聘工程師。' });
    ta.addEventListener('input', () => { reasoning = ta.value; count.textContent = ta.value.length + ' / ' + max; });
    return el('div', { class: 'field' }, [el('label', { for: id }, spec.label), ta, count]);
  }

  /* ---------- 預測 ---------- */
  function update() {
    const base = run({ ...log, steps: [] });
    const mine = run(pendingLog());
    drawChart(base, mine);
    $('#pv-cash').textContent = mine.bankruptMonth ? '—' : fmt.hk(mine.endingCash);
    const o = $('#pv-outcome');
    o.className = 'outcome ' + (mine.bankruptMonth ? 'bad' : 'good');
    o.textContent = mine.bankruptMonth ? '第 ' + mine.bankruptMonth + ' 個月現金耗盡' : '12 個月後仍然生存';
    const month = idx < drawn.length ? drawn[idx].month : 12;
    const prev = mine.rows[month - 2];
    const row = mine.rows[month - 1] || mine.rows[mine.rows.length - 1];
    $('#state-title').textContent = '公司狀態（第 ' + month + ' 個月）';
    $('#st-cash').textContent = fmt.hk(prev ? prev.cashEnd : company.cash);
    $('#st-rev').textContent = fmt.hk(row.revenue);
    $('#st-cost').textContent = fmt.hk(row.cost);
    $('#st-hc').textContent = row.headcount + ' 人';
    let impact = document.getElementById('business-impact');
    if (!impact) { impact = el('p', { id: 'business-impact', class: 'assumption-note', translate: 'no' }); $('#chart').after(impact); }
    if (mine.financial) impact.textContent = V32.L('全年收入：', 'Year revenue: ') + fmt.hk(mine.financial.totalRevenue) + V32.L(' · 交付不足而失去的收入：', ' · Revenue lost to delivery limits: ') + fmt.hk(mine.financial.totalLostRevenue) + V32.L('。現金耗盡後的結果需額外融資才能實現。', '. Results after cash depletion require additional financing.');
  }

  function drawChart(base, mine) {
    const W = 300, H = 180, x0 = 8, x1 = W - 8, y0 = 10, y1 = H - 24;
    const series = (r) => [company.cash].concat(r.rows.map((x) => x.cashEnd));
    const a = series(base), b = series(mine);
    const all = a.concat(b);
    const max = Math.max(...all, 1), min = Math.min(0, ...all);
    const zeroY = y1 - ((0 - min) / (max - min || 1)) * (y1 - y0);
    const opts = { x0, x1, y0, y1, min, max, count: 12 };
    const kids = [
      svg('line', { x1: x0, y1: zeroY, x2: x1, y2: zeroY, stroke: '#FF8A66', 'stroke-dasharray': '3 5', opacity: '.5' }),
      svg('polyline', { points: linePoints(a, opts), fill: 'none', stroke: '#8C9B98', 'stroke-width': 2, 'stroke-dasharray': '5 5' }),
      svg('polyline', { points: linePoints(b, opts), fill: 'none', stroke: '#FF8A66', 'stroke-width': 3, 'stroke-linejoin': 'round' })
    ];
    drawn.forEach((d) => {
      const x = x0 + (d.month / 12) * (x1 - x0);
      kids.push(svg('line', { x1: x, y1: y0, x2: x, y2: y1, stroke: '#2A363C', 'stroke-dasharray': '2 4' }));
      kids.push(svg('text', { x, y: H - 8, fill: '#8C9B98', 'font-size': 10, 'text-anchor': 'middle' }, d.month + '月'));
    });
    $('#chart').replaceChildren(svg('svg', { viewBox: `0 0 ${W} ${H}`, 'font-family': 'JetBrains Mono, monospace' }, kids));
  }

  /* ---------- 記錄決定 ---------- */
  function commit() {
    if (reasoning.trim().length < 4 && !confirm(t('你還未寫理由。報告會根據你的理由評分，要繼續嗎？'))) return;
    const ev = drawn[idx];
    const inputs = Object.fromEntries(Object.entries(pending).filter(([k,v]) => typeof v !== 'number' || v !== pendingDefaults[k]));
    log = Engine.engine.recordStep(log, { stepId: ev.id, inputs, text: reasoning.trim() || undefined });
    const r = run(log);
    const row = r.rows[ev.month - 1];
    log.steps[log.steps.length - 1].calc = {
      cashAtEvent: row ? Math.round(row.cashEnd) : Math.round(r.endingCash),
      projectedEndingCash: Math.round(r.endingCash),
      projectedBankruptMonth: r.bankruptMonth || 0
    };
    idx++;
    const next = drawn[idx];
    if (!next || (r.bankruptMonth && r.bankruptMonth < next.month)) return finish(r);
    renderMonths();
    renderEvent();
    $('#event').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function finish(r) {
    idx = drawn.length;
    renderMonths();
    update();
    $('#game').hidden = true;
    const runway = r.runwayMonths === Infinity ? 99 : Math.round(r.runwayMonths * 10) / 10;
    log.outcome = r.outcome;
    log.finalCalc = { endingCash: Math.round(r.endingCash), ...(r.financial ? { totalRevenue: Math.round(r.financial.totalRevenue), deliveryLoss: Math.round(r.financial.totalLostRevenue), fundingGap: Math.round(r.financial.fundingGap), cashCoverageMonths: Math.round((r.financial.runwayMonths ?? 12)*10)/10, cashDepletionMonth: r.financial.firstDepletion ?? -1 } : { bankruptMonth: r.bankruptMonth || 0, runwayMonths: runway }) };
    const good = r.outcome === 'survived';
    const btn = el('button', { type: 'button', class: 'btn btn-coral' }, '產生報告');
    const status = el('div');
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      status.replaceChildren(loading('正在產生報告……'));
      try {
        await reports.evaluateAndOpen(log, { scenarioId: scenario.id, route: 'startup', title: 'Black Swan：' + company.name, retry: 'startup/black-swan.php', next: 'startup/term-sheet.php' });
      } catch (e) {
        status.replaceChildren(el('div', { class: 'banner' }, e.message + '（你的決定已保留，可以再按一次。）'));
        btn.disabled = false;
        btn.textContent = '重新評分';
      }
    });
    $('#result').replaceChildren(
      el('span', { class: 'outcome ' + (good ? 'good' : 'bad') }, good ? '公司生存' : V32.L('模擬現金耗盡','Simulated cash depletion')),
      el('h2', { style: { fontSize: '28px' } }, good ? '12 個月後，' + company.name + ' 仍然營運' : company.name + ' 的現金在第 ' + r.bankruptMonth + ' 個月耗盡'),
      el('div', { class: 'grid-3', style: { '--gap': '14px' } }, [
        el('div', { class: 'stat' }, [el('span', { class: 'k' }, '最後現金'), el('span', { class: 'v' }, fmt.hk(r.endingCash))]),
        el('div', { class: 'stat' }, [el('span', { class: 'k' }, '現金可撐'), el('span', { class: 'v' }, r.financial ? (r.financial.runwayMonths===null ? V32.L('12 個月內未耗盡','No depletion within 12 months') : r.financial.runwayMonths.toFixed(1)+V32.L(' 個月',' months')) : good ? fmt.months(r.runwayMonths) : '—')]),
        el('div', { class: 'stat' }, [el('span', { class: 'k' }, '已作決定'), el('span', { class: 'v' }, log.steps.length + ' 個')])
      ]),
      el('p', { class: 'muted' }, '報告會根據你寫的理由，評估你的現金管理、優先次序和決定的一致性。'),
      el('div', { class: 'row' }, [btn, el('a', { class: 'btn', href: location.pathname }, '再玩一次')]),
      status
    );
    $('#result').hidden = false;
  }

  function start(seed) {
    drawn = Engine.engine.drawEvents(scenario, 3, MONTHS, seed);
    log = Engine.engine.newSession(scenario);
    idx = 0;
    $('#game').hidden = false;
    $('#result').hidden = true;
    renderMonths();
    renderEvent();
  }

  async function init() {
    $('#company-name').textContent = company.name + '（' + company.industry + '）';
    $('#event').replaceChildren(loading('正在載入劇本……'));
    try {
      scenario = await api('scenario.php?id=black_swan_saas_v1');
    } catch (e) {
      $('#event').replaceChildren(el('div', { class: 'banner' }, e.message));
      return;
    }
    start(scenario.seed);
    $('#reshuffle').addEventListener('click', () => {
      if (log.steps.length && !confirm(t('換一組事件會清除目前的決定，要繼續嗎？'))) return;
      start(Date.now());
      toast('已抽取一組新的事件。');
    });
  }
  init();
})();
