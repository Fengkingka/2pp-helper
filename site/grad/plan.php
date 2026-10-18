<?php
declare(strict_types=1);
require __DIR__ . '/../includes/bootstrap.php';
require __DIR__ . '/../includes/layout.php';

$roles = array_map(fn ($r) => ['id' => $r['id'], 'name' => $r['name'], 'nameEn' => $r['nameEn'] ?? '', 'policyIds' => $r['policyIds'] ?? []], Content::roles());
page_start('我的五年規劃', ['route' => 'grad']);
shell_start('grad', 'plan');
?>
<div class="page-head no-print">
  <div class="stack">
    <span class="eyebrow">畢業生路線 _07</span>
    <h1 class="page-title">我的五年規劃</h1>
    <p class="muted" style="max-width:760px">國家有「十五五」，香港有第一個五年規劃，你也可以有自己的五年規劃。這一頁借用規劃「五年統領、年度落實、年度檢討」的結構，把你選定的路徑變成可自訂起始年份的個人路線。</p>
    <span id="mechanism-source"></span>
  </div>
  <div class="row" id="plan-actions" hidden>
    <button type="button" class="btn" id="edit-toggle" aria-pressed="false">編輯規劃</button>
    <button type="button" class="btn" id="print">下載規劃（PDF）</button>
    <button type="button" class="link-btn" id="reset">重新開始</button>
  </div>
</div>

<section id="near-actions" class="card stack no-print" translate="no" style="margin-bottom:24px"></section>
<section id="setup" class="grid-2 no-print" style="--cols:minmax(0,1.4fr) minmax(0,1fr);--gap:32px;align-items:start" aria-labelledby="setup-title" hidden>
  <form class="card stack" id="setup-form" style="--gap:20px" novalidate>
    <h2 id="setup-title" style="font-size:22px">由一條路徑開始</h2>
    <fieldset class="field" style="border:0;margin:0;padding:0">
      <legend class="label" style="margin-bottom:8px">選一條職涯路徑</legend>
      <div class="row" id="path-choices" style="--gap:8px"></div>
      <p class="hint" id="no-paths" hidden>還沒有職涯路徑。可以先到<a href="<?= e(u('grad/advisor.php')) ?>">職涯方向 AI 助理</a>，或者直接輸入目標職位。</p>
    </fieldset>
    <div class="field">
      <label for="role-name">或者直接輸入目標職位</label>
      <input id="role-name" class="input" maxlength="80" placeholder="例如：Junior Data Analyst">
    </div>
    <div class="field"><label for="start-year" data-zh="個人規劃起始年份" data-en="Personal plan start year"></label><input class="input" id="start-year" type="number" min="2020" max="2100"></div>
    <p class="hint">AI 只會提出願景、目標和里程碑的初稿，內容只來自你的資料、所選路徑和政策資料卡。數字目標由你決定，報告分數等指標由程式計算。「計劃考取」的專業資格會自動變成里程碑草稿。</p>
    <p class="hint" id="setup-error" role="alert"></p>
    <div class="row">
      <button type="submit" class="btn btn-primary" id="create">建立初稿</button>
      <button type="button" class="btn" id="use-demo">使用示範規劃</button>
      <span id="setup-status"></span>
    </div>
  </form>
  <aside class="stack" style="--gap:14px">
    <div class="card stack" style="--gap:10px">
      <b>規劃怎樣運作</b>
      <ol class="plan-steps">
        <li>寫一句五年後的願景。</li>
        <li>定 3 至 5 個核心目標，每個目標可以連到一張政策資料卡。</li>
        <li>每年 1 至 3 個里程碑，每個都有可量度的指標。</li>
        <li>每年做一次檢討，再調整下一年的里程碑。</li>
      </ol>
    </div>
    <div id="setup-policy"></div>
  </aside>
</section>

<section id="plan" class="stack" style="--gap:28px" aria-label="我的五年規劃" hidden>
  <div class="card card-deep bracket plan-route-card">
    <div class="route plan-route" id="year-route" role="tablist" aria-label="年份"></div>
  </div>
  <div class="banner" id="cert-drafts" hidden></div>
  <div class="grid-2" style="--cols:minmax(0,1.45fr) minmax(0,1fr);--gap:28px;align-items:start">
    <div class="stack" style="--gap:22px;min-width:0">
      <div class="card stack" style="--gap:10px" id="vision-card"></div>
      <section class="stack" style="--gap:14px" aria-labelledby="ms-title">
        <div class="spread"><h2 id="ms-title" style="font-size:20px"></h2><span class="hint" id="ms-count"></span></div>
        <div id="milestones" class="stack" style="--gap:12px"></div>
        <button type="button" class="btn btn-sm no-print" id="add-milestone" style="align-self:flex-start" hidden>新增里程碑</button>
      </section>
      <section class="card stack" style="--gap:12px" id="review" aria-labelledby="review-title"></section>
    </div>
    <aside class="stack" style="--gap:14px" aria-labelledby="goals-title">
      <div class="spread"><h2 id="goals-title" style="font-size:20px">核心目標</h2><span class="hint" id="path-label"></span></div>
      <div id="goals" class="stack" style="--gap:12px"></div>
      <button type="button" class="btn btn-sm no-print" id="add-goal" style="align-self:flex-start" hidden>新增目標</button>
    </aside>
  </div>
</section>

<section id="plan-print" class="plan-print" aria-hidden="true"></section>
<?php
echo json_island('roles', $roles);
echo policy_island();
shell_end();
page_end(['pages/plan.js'], true);
