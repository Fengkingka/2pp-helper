/**
 * B2B 電郵練習：對方的電郵來自劇本；有 branches 的步驟會按上一封回覆決定顯示哪個版本。
 * 第 2 版：主線 4 輪（預算凍結 → 資料合規 → 免費試用 → 減價要求），後 3 輪各有一個分支版本。
 * 字數、有沒有下一步和數字由程式檢查；內容質素由評分器最後評分。
 */
(function () {
  'use strict';
  const { $, el, api, profile, reports, toast, loading } = TP;
  const company = profile.startup();
  const NEXT_STEP = /星期|禮拜|週[一二三四五六日]|\d+\s*[月號日]|\d{1,2}\s*[:：]\s*\d{2}|上午|下午|明天|下週|下星期|本週|今個星期|monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next\s+week|this\s+week|a\.?m\.?|p\.?m\.?/i;
  let scenario = null, main = [], byId = {}, pos = 0, current = null, log = null;
  const sent = []; // { stepId, subject }
  const branchResults = []; // 第 2 版：4 輪電郵有 3 個分支，按次序記錄每次判斷的結果

  const chars = (s) => s.replace(/\s/g, '').length;

  function checks(text) {
    const n = chars(text);
    const items = [
      [n >= 80 && n <= 400, n + ' 字（建議 80 至 400）'],
      [/\d/.test(text), '有具體數字'],
      [NEXT_STEP.test(text), '提出下一步和時間']
    ];
    $('#checks').replaceChildren(...items.map(([ok, label]) => el('span', { class: 'tag' + (ok ? ' tag-accent' : '') }, (ok ? '✓ ' : '○ ') + label)));
  }

  function renderThread() {
    const items = main.map((s, i) => {
      const shown = i < sent.length ? byId[sent[i].stepId] : i === pos ? current : s;
      const cls = i < pos ? 'done' : i === pos ? 'now' : 'todo';
      return el('div', { class: 'thread-item ' + cls }, [el('span', { class: 'node' }), el('span', { class: 'stack', style: { '--gap': '0' } }, [
        el('span', { style: { fontSize: '13px' } }, shown.subject), el('span', { class: 'hint' }, i < pos ? '已回覆' : i === pos ? '待回覆' : '未收到')
      ])]);
    });
    $('#thread').replaceChildren(...items);
    $('#step-text').textContent = pos < main.length ? '第 ' + (pos + 1) + ' / ' + main.length + ' 封' : '已完成';
  }

  function renderMail() {
    $('#time-skip').hidden = !current.timeSkip;
    $('#time-skip').textContent = current.timeSkip || '';
    $('#mail').replaceChildren(
      el('div', { class: 'mail-head' }, [el('b', {}, current.subject), el('span', { class: 'hint' }, '寄件人：' + current.from + '　收件人：你（' + company.name + '）')]),
      el('div', { class: 'mail-body' }, current.body)
    );
    const spec = (current.inputs || []).find((i) => i.kind === 'text') || { maxChars: 1200 };
    $('#reply').maxLength = spec.maxChars || 1200;
    $('#reply').value = '';
    checks('');
    renderThread();
  }

  /** 決定下一封電郵：有 branches 就按上一封回覆判斷 */
  async function resolve(step) {
    if (!step.branches) return step;
    const prev = log.steps[log.steps.length - 1];
    let pass = false;
    try {
      pass = (await api('llm.php', { task: 'check', check: step.branches.check, text: prev ? prev.text : '' })).pass === true;
    } catch (e) { pass = false; }
    branchResults.push(pass);
    return byId[pass ? step.branches.ifPass : step.branches.ifFail] || step;
  }

  async function send() {
    const text = $('#reply').value.trim();
    if (chars(text) < 20) { toast('回覆太短了，最少寫 20 字。'); $('#reply').focus(); return; }
    $('#send').disabled = true;
    log = Engine.engine.recordStep(log, { stepId: current.id, inputs: {}, text });
    sent.push({ stepId: current.id, subject: current.subject });
    pos++;
    if (pos >= main.length) return finish();
    $('#status').replaceChildren(loading('等待對方回覆……'));
    current = await resolve(main[pos]);
    $('#status').replaceChildren();
    $('#send').disabled = false;
    renderMail();
    $('#reply').focus();
  }

  function finish() {
    renderThread();
    $('#work').hidden = true;
    const texts = log.steps.map((s) => s.text || '');
    log.finalCalc = {
      replies: texts.length,
      avgChars: Math.round(texts.reduce((a, t) => a + chars(t), 0) / Math.max(1, texts.length)),
      repliesWithNextStep: texts.filter((t) => NEXT_STEP.test(t)).length,
      repliesWithNumbers: texts.filter((t) => /\d/.test(t)).length
    };
    // 第一個分支判斷的是第一封回覆有沒有量化 ROI；之後的分支只影響對方下一封電郵的版本（stepId 已記錄）
    if (branchResults.length) log.finalCalc.firstReplyQuantified = branchResults[0] ? 1 : 0;
    const btn = el('button', { type: 'button', class: 'btn btn-coral' }, '產生報告');
    const status = el('div');
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      status.replaceChildren(loading('正在產生報告……'));
      try {
        await reports.evaluateAndOpen(log, { scenarioId: scenario.id, route: 'startup', title: 'B2B 電郵：' + company.name, retry: 'startup/b2b.php', next: 'startup/index.php' });
      } catch (e) {
        status.replaceChildren(el('div', { class: 'banner' }, e.message));
        btn.disabled = false;
        btn.textContent = '重新評分';
      }
    });
    $('#result').replaceChildren(
      el('h2', { style: { fontSize: '26px' } }, '電郵往來完成'),
      el('p', { class: 'muted' }, '你回覆了 ' + texts.length + ' 封電郵，平均 ' + log.finalCalc.avgChars + ' 字。報告會評估你怎樣回應異議、說明 ROI、語氣和下一步。'),
      el('div', { class: 'row' }, [btn, el('a', { class: 'btn', href: location.pathname }, '重新開始')]),
      status
    );
    $('#result').hidden = false;
  }

  $('#reply').addEventListener('input', () => checks($('#reply').value));
  $('#send').addEventListener('click', send);

  (async function init() {
    $('#mail').replaceChildren(loading('正在載入劇本……'));
    try {
      scenario = await api('scenario.php?id=b2b_procurement_v1');
    } catch (e) {
      $('#mail').replaceChildren(el('div', { class: 'banner' }, e.message));
      return;
    }
    $('#scenario-title').textContent = scenario.title;
    const emails = scenario.steps.filter((s) => s.type === 'email');
    emails.forEach((s) => { byId[s.id] = s; });
    // 只作為分支版本出現的電郵，不放在主線
    const alternatives = new Set();
    emails.forEach((s) => { if (s.branches) [s.branches.ifPass, s.branches.ifFail].forEach((id) => { if (id !== s.id) alternatives.add(id); }); });
    main = emails.filter((s) => !alternatives.has(s.id));
    log = Engine.engine.newSession(scenario);
    current = await resolve(main[0]);
    renderMail();
  })();
})();
