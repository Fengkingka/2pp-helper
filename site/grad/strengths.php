<?php
declare(strict_types=1);
require __DIR__ . '/../includes/bootstrap.php';
require __DIR__ . '/../includes/layout.php';

$q = Content::questionnaire('ipip_core_strengths_v1');
page_start('性格與強項問卷', ['route' => 'grad']);
shell_start('grad', 'strengths');
?>
<div class="page-head">
  <div class="stack">
    <span class="eyebrow">畢業生路線 _02</span>
    <h1 class="page-title">性格與強項</h1>
    <p class="muted" style="max-width:720px">18 題，約 3 分鐘，可以略過。這是自我反思的工具，不是診斷，也不會用來篩選或排序職位。</p>
  </div>
  <a class="btn" id="skip" href="<?= e(u('grad/advisor.php')) ?>">略過問卷</a>
</div>

<div class="grid-2" style="--cols:minmax(0,1.6fr) minmax(0,1fr);--gap:32px;align-items:start">
  <div class="stack" style="--gap:20px;min-width:0">
    <section id="quiz" class="stack" style="--gap:18px" aria-labelledby="quiz-title" hidden>
      <h2 id="quiz-title" class="sr-only">問卷題目</h2>
      <div class="card card-deep stack" style="--gap:14px;padding:22px 26px">
        <div class="spread"><span class="mono faint" id="page-label" style="font-size:13px"></span><span class="mono faint" id="answered" style="font-size:13px"></span></div>
        <div class="route" id="quiz-route" aria-hidden="true"></div>
        <p class="hint">按你平時的樣子作答，不是理想中的自己。沒有對或錯的答案。</p>
        <p class="hint" id="draft-hint">作答會自動儲存在此瀏覽器，可以稍後繼續。</p>
      </div>
      <form id="quiz-form" class="stack" style="--gap:14px" novalidate>
        <div id="items" class="stack" style="--gap:14px"></div>
        <p class="hint" id="quiz-error" role="alert"></p>
        <div class="spread">
          <button type="button" class="btn" id="prev">上一頁</button>
          <button type="button" class="link-btn" id="clear-answers">清除本次作答</button>
          <button type="submit" class="btn btn-primary" id="next">下一頁</button>
        </div>
      </form>
    </section>

    <section id="result" class="stack" style="--gap:20px" aria-labelledby="result-title" hidden>
      <div class="card card-deep stack" style="--gap:20px;padding:28px">
        <div class="spread">
          <h2 id="result-title" style="font-size:22px">你的相對強項</h2>
          <span class="badge">只作反思，不是診斷</span>
        </div>
        <div id="bars" class="stack" style="--gap:14px"></div>
        <p class="hint" id="taken"></p>
      </div>
      <div id="explain" class="grid-2" style="--gap:16px"></div>
      <div class="card stack" style="--gap:12px">
        <b>讓 AI 助理參考你的強項？</b>
        <div class="seg" id="share" role="group" aria-label="是否讓 AI 助理參考">
          <button type="button" data-value="yes" aria-pressed="false">讓 AI 助理參考</button>
          <button type="button" data-value="no" aria-pressed="true">不分享</button>
        </div>
        <p class="hint">選擇分享時，只會把三個分數送給職涯方向 AI 助理，讓「為甚麼適合你」可以提到你的強項；強項不會用來排除任何路徑。預設不分享。</p>
      </div>
      <div class="row">
        <a class="btn btn-primary" href="<?= e(u('grad/advisor.php')) ?>">下一站：職涯方向</a>
        <button type="button" class="btn" id="retake">重新作答</button>
      </div>
    </section>

    <div id="need-profile" class="empty" hidden>先建立你的資料，再做問卷。結果會儲存在你的資料裡。<br><a class="btn btn-primary" href="<?= e(u('grad/index.php')) ?>">建立資料</a></div>
  </div>

  <aside class="card stack" style="--gap:12px;font-size:14px" aria-labelledby="about-title">
    <h2 id="about-title" style="font-size:17px">關於這份問卷</h2>
    <p class="muted" id="about-instrument"></p>
    <p class="muted" id="about-license"></p>
    <p class="muted" id="about-translation"></p>
    <p class="muted">我們沒有使用 MBTI 或官方 VIA Survey 等需要授權的問卷。</p>
    <p class="muted">結果只存在你的瀏覽器；按「清除我的資料」時會一併刪除。</p>
    <div class="row" style="--gap:12px">
      <a class="policy-link" id="about-items" target="_blank" rel="noopener noreferrer">題目來源（IPIP）<span aria-hidden="true"> ↗</span></a>
      <a class="policy-link" id="about-paper" target="_blank" rel="noopener noreferrer">驗證研究<span aria-hidden="true"> ↗</span></a>
    </div>
  </aside>
</div>
<?php
echo json_island('questionnaire', $q);
shell_end();
page_end(['pages/strengths.js']);
