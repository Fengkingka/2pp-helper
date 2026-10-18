/** 我的報告：列表＋詳情。AI 文字顯示前經 toHK 轉換；分數以「路線」顯示。 */
(function () {
  'use strict';
  const { $, el, reports, fmt, toHK, BASE, language, t } = TP;
  const locale = () => language() === 'en' ? 'en-HK' : 'zh-HK';
  const hkd = (v) => fmt.hk(v);
  const METRICS = {
    totalRevenue: ['全年收入', hkd], deliveryLoss: ['交付限制損失收入', hkd], fundingGap: ['資金缺口', hkd],
    endingCash: ['最後現金', hkd],
    bankruptMonth: ['破產月份', (v) => (v ? '第 ' + v + ' 個月' : '沒有破產')],
    runwayMonths: ['現金可撐', (v) => (v >= 99 ? V32.L('舊報告：期末月現金流非負','Legacy report: final-month cash flow non-negative') : v + ' 個月')],
    cashCoverageMonths: ['模擬資金可撐', (v) => v >= 12 ? V32.L('12 個月內未耗盡','No depletion within 12 months') : v + V32.L(' 個月',' months')],
    cashDepletionMonth: ['現金耗盡月份', (v) => v < 0 ? V32.L('12 個月內未耗盡','No depletion within 12 months') : v === 0 ? V32.L('開辦時','At setup') : v + V32.L(' 月',' months')],
    founderPctAfterSeed: ['種子輪後創辦人持股', (v) => v + '%'],
    founderPctAfterB: ['B 輪後創辦人持股', (v) => v + '%'],
    founderPayoutExit30M: ['退出 3,000 萬時創辦人實得', hkd],
    founderPayoutExit60M: ['退出 6,000 萬時創辦人實得', hkd],
    founderPayoutExit200M: ['退出 2 億時創辦人實得', hkd],
    seedInvestorPayoutExit60M: ['退出 6,000 萬時種子投資者實得', hkd],
    investorBoardSeats: ['投資者董事席位', (v) => v + ' 席'],
    walked: ['投資者退出談判', (v) => (v ? '是' : '否')],
    replies: ['回覆電郵', (v) => v + ' 封'],
    avgChars: ['平均字數', (v) => v + ' 字'],
    repliesWithNextStep: ['有提出下一步的回覆', (v) => v + ' 封'],
    repliesWithNumbers: ['有具體數字的回覆', (v) => v + ' 封'],
    firstReplyQuantified: ['第一封回覆有量化 ROI', (v) => (v ? '有' : '沒有')],
    charsPerMin: ['語速（每分鐘字數）', (v) => v + ' 字'],
    fillerTotal: ['口頭禪（即係、跟住等）', (v) => v + ' 次'],
    answerWords: ['英文回答詞數', (v) => v + ' 個英文詞'],
    wordsPerMin: ['回答速度（詞/分鐘，含停頓）', (v) => v + ' 詞/分鐘'],
    fillerWordsEn: ['英文口頭禪（字幕估算）', (v) => v + ' 次'],
    answerChars: ['回答字數', (v) => v + ' 字'],
    answeredQuestions: ['完成題目', (v) => v + ' 條'],
    industryQuestions: ['行業認知題', (v) => v + ' 條'],
    durationSec: ['面試時間', (v) => Math.floor(v / 60) + ' 分 ' + (v % 60) + ' 秒']
  };
  const HIDDEN = new Set(['transcriptEdited', 'mock', 'unverifiedEvidence', 'cashAtEvent']);

  const list = reports.list();
  const params = new URLSearchParams(location.search);
  let current = params.get('id') || (list[0] && list[0].id);

  function color(score) { return score >= 4 ? 'var(--teal)' : score <= 2 ? 'var(--coral)' : 'var(--text)'; }

  function scoreRoute(d, assessed = true) {
    if (!assessed) return el('div', { class: 'spread' }, [el('span', {}, toHK(d.label)), el('span', { class: 'hint' }, t('證據不足／未有評分機會'))]);
    const track = el('span', { class: 'score-track', role: 'img', 'aria-label': d.label + '：' + d.score + ' / 5' }, [
      el('span', { class: 'fill', style: { width: 'calc((100% - 12px) * ' + (d.score - 1) / 4 + ')' } })
    ].concat([1, 2, 3, 4, 5].map((n) => el('i', { class: n < d.score ? 'on' : n === d.score ? 'at' : '' }))));
    return el('div', { class: 'score', style: { '--c': color(d.score) } }, [el('span', { style: { fontSize: '14px' } }, toHK(d.label)), track, el('span', { class: 'score-num' }, d.score)]);
  }

  function renderList() {
    const box = $('#list');
    box.replaceChildren(...list.map((r) => el('a', {
      href: '?id=' + encodeURIComponent(r.id), class: 'card', 'aria-current': r.id === current ? 'page' : null,
      style: { padding: '14px 16px', borderColor: r.id === current ? 'var(--accent)' : '', display: 'block', color: 'var(--text)' }
    }, [
      el('span', { class: 'mono', style: { fontSize: '11px', color: r.route === 'startup' ? 'var(--coral)' : 'var(--teal)', display: 'block' } }, (r.route === 'startup' ? '創業者' : '畢業生') + '・' + new Date(r.createdAt).toLocaleDateString(locale())),
      el('b', { style: { fontSize: '15px' } }, r.title)
    ])));
  }


  function nextSteps(r, dims) {
    const L = V32.L;
    const rated = dims.filter(d => d.key !== 'industry').sort((a,b)=>a.score-b.score);
    const previous = list.find(x => x.id !== r.id && x.createdAt < r.createdAt && V32.comparable(r,x));
    const section = el('section',{class:'card stack',translate:'no'},el('h3',{},L('進步與下一步','Progress and next steps')));
    if (previous) {
      const shared = rated.filter(d => previous.report.dimensions.some(x => x.key === d.key) && (!r.report.metrics?.rubricVersion || r.report.metrics['assessed_'+d.key] === previous.report.metrics['assessed_'+d.key]));
      shared.forEach(d=>{const before=previous.report.dimensions.find(x=>x.key===d.key);section.append(el('p',{},d.label+': '+before.score+' → '+d.score));});
      section.append(el('p',{class:'hint'},L('只比較相同職位、路線、評分版本及練習長度；分數變動不等於已驗證能力進步。','Compared only within the same role, track, rubric and practice length. Score changes are not validated measures of skill improvement.')));
    } else section.append(el('p',{class:'hint'},L('尚未有可直接比較的較早報告。','No earlier report with matching assessment settings.')));
    rated.slice(0,2).forEach(d=>{const text=d.suggestion.split('\n').slice(1).join('\n')||d.suggestion;section.append(el('p',{},text),V32.actionButton(text,'report:'+r.id));});
    return section;
  }

  function renderDetail(r) {
    const rep = r.report;
    const accent = r.route === 'startup' ? 'var(--coral)' : 'var(--teal)';
    document.body.classList.toggle('route-startup', r.route === 'startup');
    const metrics = rep.metrics || {};
    const v2 = r.scenarioId === 'interview_general_v1' && metrics.rubricVersion === 2;
    const vc = r.scenarioId === 'hostile_vc_v1' && metrics.vcScoringVersion === 1;
    const strict = v2 || vc;
    const en = language() === 'en';
    const assessed = (d) => !strict || metrics['assessed_' + d.key] === 1;
    const labels = { relevance: ['職位相關性', 'Role relevance'], ownership: ['個人責任與行動', 'Personal responsibility and action'], judgement: ['分析與判斷', 'Analysis and judgement'], outcomes: ['結果、驗證與反思', 'Outcomes, validation and reflection'], clarity: ['內容表達清晰度', 'Content clarity'], industry: ['行業認知（選用）', 'Industry awareness (optional)'] };
    const vcLabels = { relevance: ['回答相關性', 'Answer relevance'], evidence: ['證據與假設', 'Evidence and assumptions'], financial: ['財務理解', 'Financial reasoning'], risk: ['風險與對策', 'Risk and mitigation'], clarity: ['內容清晰度', 'Content clarity'] };
    const dims = rep.dimensions.map((d) => vc && vcLabels[d.key] ? { ...d, label: vcLabels[d.key][en ? 1 : 0] } : v2 && labels[d.key] ? { ...d, label: labels[d.key][en ? 1 : 0] } : d);
    const metricItems = Object.entries(metrics).filter(([k]) => !HIDDEN.has(k) && !(strict && (k.startsWith('assessed_') || ['vcScoringVersion', 'rubricVersion', 'interviewTrack', 'coreRated', 'coreAverage', 'roleContextMatched'].includes(k)))).map(([k, v]) => {
      const vcMetrics = { answeredRounds: [en ? 'Answered main rounds' : '已回答主回合', String], challengeCount: [en ? 'Rule clarifications' : '規則澄清次數', String], durationSec: [en ? 'Practice duration' : '練習時間', (v) => Math.floor(v / 60) + (en ? ' min ' : ' 分 ') + (v % 60) + (en ? ' sec' : ' 秒')], ltvCacRatio: [en ? 'LTV / CAC (self-reported inputs)' : 'LTV / CAC（自報輸入）', (v) => v.toLocaleString(en ? 'en-HK' : 'zh-HK', { maximumFractionDigits: 2 }) + '×'] };
      const [label, f] = (vc && vcMetrics[k]) || METRICS[k] || [k, String];
      return el('div', { class: 'stat card', style: { padding: '16px' } }, [el('span', { class: 'k' }, label), el('span', { class: 'v', style: { fontSize: '20px' } }, f(v))]);
    });

    /* 第 2 版：報告分數與五年規劃連結；下一步可參考的政策資料卡 */
    const avg = Engine.plan.reportScore(r);
    const plan = TP.store.get('plan');
    const linked = plan && avg !== null ? plan.milestones.filter((m) => m.metric.type === 'reports' && m.metric.scenarioId === r.scenarioId && new Date(r.createdAt).getFullYear() === m.year) : [];
    const ctx = { reports: reports.list(), certifications: ((TP.profile.get() || {}).certifications) || [] };
    const planBox = linked.length ? el('section', { class: 'card stack no-print', style: { '--gap': '10px', borderColor: 'var(--accent-line)' } }, [
      el('b', {}, '這份報告計入你的五年規劃'),
      ...linked.map((m) => {
        const pr = Engine.plan.milestoneProgress(m, ctx);
        const en = language() === 'en';
        return el('span', { class: 'hint' }, [m.year + (en ? ': ' : '：'), el('span', {}, m.text),
          (en ? ' | Progress ' : '｜進度 ') + pr.current + '／' + pr.target + (en ? ' sessions' : ' 次') + (pr.avg !== null ? (en ? ', average ' : '，平均 ') + pr.avg.toFixed(1) : '') + (pr.done ? (en ? ' | Done' : '｜已完成') : '')]);
      }),
      el('a', { class: 'btn btn-sm', href: BASE + 'grad/plan.php', style: { alignSelf: 'flex-start' } }, '查看我的五年規劃')
    ]) : null;
    const NEXT_POLICY = r.route === 'startup' ? ['innotech_rnd_target', 'nm_university_town'] : ['youth_30k_jobs', 'ai_upskilling'];
    const policyCards = window.TPPolicy ? NEXT_POLICY.map((id) => window.TPPolicy.get(id)).filter(Boolean) : [];
    const policyBox = policyCards.length ? el('section', { class: 'stack no-print', style: { '--gap': '10px' } }, [
      el('div', { class: 'spread' }, [el('b', {}, '下一步可以參考的政策資料'), el('span', { class: 'hint' }, '只列事實和出處，不評價政策')]),
      el('div', { class: 'grid-2', style: { '--gap': '12px' } }, policyCards.map((c) => window.TPPolicy.card(c)))
    ]) : null;

    const actions = el('div', { class: 'row no-print' }, [
      r.retry ? el('a', { class: 'btn btn-primary', href: BASE + r.retry }, '再試一次') : null,
      r.next ? el('a', { class: 'btn', href: BASE + r.next }, '前往下一站') : null,
      el('button', { type: 'button', class: 'btn', onclick: () => window.print() }, '下載報告（PDF）'),
      el('button', { type: 'button', class: 'btn', onclick: () => { if (confirm('確定刪除這份報告？')) { reports.remove(r.id); location.href = BASE + 'reports.php'; } } }, '刪除')
    ]);

    $('#detail').replaceChildren(...[
      el('div', { class: 'card stack', style: { '--gap': '14px', padding: '28px', borderTop: '3px solid ' + accent } }, [
        el('div', { class: 'spread' }, [
          el('h2', { style: { fontSize: '26px' } }, r.title),
          metrics.mock ? el('span', { class: 'badge', title: strict ? t('流程示範，未進行能力評分') : '此報告使用示範評分，分數按簡單規則估算' }, strict ? t('流程示範，未進行能力評分') : '示範評分（未連接 AI）')
            : el('span', { class: 'badge' }, 'AI 評分')
        ]),
        el('span', { class: 'hint' }, new Date(r.createdAt).toLocaleString(locale()) + (avg !== null ? (en ? strict ? ' | Core average ' : ' | Average ' : strict ? '｜核心平均分 ' : '｜平均分 ') + avg.toFixed(1) + ' / 5' : (en ? ' | No core average available' : '｜未有核心平均分'))),
        vc ? el('p', { class: 'hint', 'data-vc-scoring': 'v1' }, (en ? 'Investor panel: Numbers, Vision, Legal | Core coverage: ' : '投資者小組：數字派、願景派、風險派｜核心評分覆蓋：') + metrics.coreRated + ' / 5') : null,
        vc ? el('p', { class: 'hint' }, en ? 'Five core dimensions have equal weight among assessed dimensions. Only founder answers are evidence; setup and deck text provide context only. Figures are self-reported; missing optional financial data is not automatically poor performance. These are coaching ratings with incomplete user calibration, not professional investment assessments or legal/financial advice. Transcripts cannot assess pronunciation or accent, or infer personality, confidence or demographic characteristics.' : '五個核心維度在已評項目中等權；證據只取創辦人回答，設定及 deck 文字只作背景。數字為自報資料，選填財務留空不會自動評為差。此評級只作練習指導，尚未完成用戶校準，不是專業投資評估或法律／財務建議。字幕不能評估發音、口音，亦不能推斷性格、信心或人口特徵。') : null,
        v2 ? el('p', { class: 'hint', 'data-interview-scoring': 'v2' }, (en ? 'Scoring v2 | ' : '評分 v2｜') + (metrics.interviewTrack === 2 ? (en ? 'Experienced' : '已有工作經驗') : (en ? 'Graduate / new entrant' : '畢業生／初入職場')) + (en ? ' | Core coverage: ' : '｜核心評分覆蓋：') + metrics.coreRated + ' / 5') : null,
        v2 ? el('p', { class: 'hint' }, (en ? 'Target role: ' : '目標職位：') + (r.interviewContext?.role || t('未有記錄'))
          + (r.interviewContext?.jobDescription ? (en ? '. Includes your unverified job description.' : '。包括你提供、未經核實的職位描述。') : '')
          + (metrics.roleContextMatched === 1
            ? (en ? '. An existing role card matched this target role; its description bounds the role context.' : '。此目標職位已配對到現有職位卡，評估以該卡片描述作職位背景。')
            : metrics.roleContextMatched === 0
              ? (en ? '. No existing role card matched this target role; role relevance uses your job title, answers and any supplied description, without verified role duties.' : '。此目標職位未配對到現有職位卡；相關性評估使用職位名稱、回答及你提供的描述，沒有已核實的職責背景。')
              : (en ? '. Role-card matching was not recorded; relevance is limited to the job title and your answers.' : '。未有職位卡配對記錄；相關性評估只限於職位名稱及你的回答。'))
          + (en ? ' CV is used only to recommend a track; performance evidence comes from answers.' : 'CV 只用於路線建議，表現證據只來自回答。')) : null,
        v2 && r.classification ? el('p', { class: 'hint' }, (en ? 'Track recommendation source: ' : '路線建議來源：') + (r.classification.source === 'ai' ? 'AI' : t('後備建議')) + ' · ' + r.classification.reason) : null,
        v2 ? el('p', { class: 'hint' }, en ? 'Five core dimensions have equal weight among assessed dimensions; industry is separate. These are coaching scores, not a validated hiring ranking. Text and voice use the same content criteria; transcripts cannot assess pronunciation or accent, or infer personality, confidence or demographic characteristics such as age, gender or ethnicity.' : '五個核心維度在已評項目中等權；行業認知另列。此報告只作練習指導，不是經驗證的招聘排名。文字與語音使用相同內容準則；字幕不能評估發音或口音，亦不能推斷性格、信心或人口特徵，例如年齡、性別或族裔。') : null,
        el('p', { style: { fontSize: '18px', lineHeight: '1.7' } }, toHK(rep.summary))
      ]),
      el('section', { class: 'card stack', style: { '--gap': '16px' }, 'aria-label': '分數' }, dims.filter((d) => !v2 || d.key !== 'industry').map((d) => scoreRoute(d, assessed(d)))),
      v2 && dims.some((d) => d.key === 'industry') ? el('section', { class: 'card stack', 'data-industry-score': '', style: { '--gap': '16px' } }, [el('b', {}, en ? 'Optional industry awareness — excluded from the core average' : '選用行業認知：不計入核心平均分'), ...dims.filter((d) => d.key === 'industry').map((d) => scoreRoute(d, assessed(d)))]) : null,
      el('section', { class: 'stack', style: { '--gap': '14px' }, 'aria-label': '逐項回饋' }, dims.map((d) => el('div', { class: 'card stack', style: { '--gap': '10px' } }, [
        el('div', { class: 'spread' }, [el('b', {}, toHK(d.label)), el('span', { class: 'mono', style: { color: color(d.score) } }, assessed(d) ? d.score + ' / 5' : t('證據不足／未有評分機會'))]),
        d.evidence
          ? el('blockquote', { translate: strict ? 'no' : null, style: { margin: '0', padding: '12px 16px', borderLeft: '3px solid var(--line-3)', background: 'var(--bg)', borderRadius: '8px', color: 'var(--text-2)' } }, '「' + (strict ? d.evidence : toHK(d.evidence)) + '」')
          : el('p', { class: 'hint' }, strict && !assessed(d) ? t('未有可評分的回答證據') : '（這一項的引文無法在你的原文中核實，已經移除。）'),
        strict ? el('p', { class: 'hint' }, (en ? 'Rating rationale: ' : '評級理由：') + toHK(d.suggestion.split('\n')[0])) : null,
        el('p', { class: 'accent' }, strict ? (en ? 'Next action: ' : '改善行動：') + toHK(d.suggestion.split('\n').slice(1).join('\n') || d.suggestion) : toHK(d.suggestion))
      ]))),
      rep.rewriteExample ? el('section', { class: 'card stack', style: { '--gap': '10px' } }, [
        el('b', {}, '改寫示範'), el('p', { style: { whiteSpace: 'pre-wrap', color: 'var(--text-2)' } }, toHK(rep.rewriteExample)),
        el('p', { class: 'hint' }, '方括號內的數字需要換成真實資料。')
      ]) : null,
      metricItems.length ? el('section', { class: 'stack', style: { '--gap': '12px' } }, [el('b', {}, '計算結果與指標'), el('div', { class: 'grid-3', style: { '--gap': '12px' } }, metricItems), el('p', { class: 'hint' }, '這些數字由程式計算，不是 AI 估算。'),
        r.route === 'grad' && ('wordsPerMin' in metrics || 'fillerWordsEn' in metrics)
          ? el('p', { class: 'hint' }, '語音指標只計語音提交的回答。速度從首次出現字幕至提交計時，包含停頓；口頭禪按字幕中的 um、uh、you know、I mean 計數。識別可能省略語氣詞，這是字幕估算，不是專業語音評估。') : null,
        'answerChars' in metrics
          ? el('p', { class: 'hint' }, '中文按字數計算，不套用英文詞數。語速及口頭禪只屬字幕估算，不能評估發音或語調。') : null]) : null,
      metrics.unverifiedEvidence ? el('p', { class: 'hint' }, '注意：有 ' + metrics.unverifiedEvidence + ' 項引文無法核實，已經移除。') : null,
      planBox,
      metrics.transcriptEdited ? el('p', { class: 'hint', translate: 'no' }, V32.L('此報告使用你確認或修正的字幕；不顯示語音估算指標。', 'This report uses your reviewed/edited transcript; speech estimates are omitted.')) : null,
      nextSteps(r, dims.filter(assessed)),
      policyBox,
      actions
    ].filter(Boolean));
    document.title = language() === 'en' ? t(r.title) + ' | ' + t('我的報告') : r.title + '｜我的報告';
  }

  if (!list.length) {
    $('#layout').replaceChildren(el('div', { class: 'empty', style: { gridColumn: '1 / -1' } }, [
      '還沒有報告。完成任何一個練習後，報告會出現在這裡。', el('br'),
      el('div', { class: 'row', style: { justifyContent: 'center', marginTop: '16px' } }, [
        el('a', { class: 'btn btn-primary', href: BASE + 'grad/interview.php' }, '練習面試'),
        el('a', { class: 'btn', href: BASE + 'startup/black-swan.php' }, '玩 Black Swan')
      ])
    ]));
    return;
  }
  const r = reports.get(current) || list[0];
  current = r.id;
  renderList();
  renderDetail(r);
  document.addEventListener('tp:languagechange', () => renderDetail(r));
})();
