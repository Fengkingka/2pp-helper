<?php
declare(strict_types=1);
require __DIR__ . '/../includes/bootstrap.php';
require __DIR__ . '/../includes/layout.php';

page_start('CV Builder', ['route' => 'grad']);
shell_start('grad', 'cv');
?>
<div class="page-head no-print">
  <div class="stack"><span class="eyebrow">畢業生路線 _04</span><h1 class="page-title">CV Builder</h1></div>
  <div class="row">
    <div class="seg" id="template" role="group" aria-label="模板" style="min-width:200px">
      <button type="button" data-value="a" aria-pressed="true">模板 A</button>
      <button type="button" data-value="b" aria-pressed="false">模板 B</button>
    </div>
    <button type="button" class="btn btn-primary" id="download">下載 CV（PDF）</button>
  </div>
</div>

<div class="grid-2 print-area" style="--cols:minmax(0,1fr) minmax(0,520px);--gap:32px;align-items:start">
  <form id="cv-form" class="stack no-print" style="--gap:18px" novalidate>
    <fieldset class="card stack" style="--gap:14px;margin:0">
      <legend class="sr-only">基本資料</legend>
      <b>基本資料</b>
      <div class="grid-2" style="--gap:12px">
        <div class="field"><label for="name">姓名</label><input id="name" class="input" autocomplete="name"></div>
        <div class="field"><label for="email">電郵</label><input id="email" class="input" type="email" autocomplete="email"></div>
        <div class="field"><label for="phone">電話</label><input id="phone" class="input" autocomplete="tel"></div>
        <div class="field"><label for="link">LinkedIn 或作品集（可選）</label><input id="link" class="input" type="url"></div>
      </div>
    </fieldset>
    <fieldset class="card stack" style="--gap:14px;margin:0">
      <legend class="sr-only">學歷</legend>
      <b>學歷</b>
      <div class="grid-3" style="--gap:12px">
        <div class="field"><label for="school">學校</label><input id="school" class="input"></div>
        <div class="field"><label for="degree">學位或主修</label><input id="degree" class="input"></div>
        <div class="field"><label for="gradYear">畢業年份</label><input id="gradYear" class="input num" inputmode="numeric" maxlength="4"></div>
      </div>
    </fieldset>
    <div id="experiences" class="stack" style="--gap:18px"></div>
    <button type="button" class="btn btn-sm" id="add-exp" style="align-self:flex-start">新增一段經歷</button>
    <div class="card field"><label for="skills">技能（用逗號分隔）</label><input id="skills" class="input"></div>
    <div class="card stack" id="cert-note" style="--gap:8px"></div>
    <p class="hint">資料會自動儲存在這個瀏覽器。AI 不會虛構數字，請把「[填入數字]」換成真實數字。</p>
  </form>

  <article class="cv-paper" id="cv-preview" aria-label="CV 預覽" style="position:sticky;top:24px"></article>
</div>
<?php
shell_end();
page_end(['pages/cv.js'], true);
