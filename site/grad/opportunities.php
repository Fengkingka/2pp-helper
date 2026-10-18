<?php
declare(strict_types=1);
require __DIR__ . '/../includes/bootstrap.php';
require __DIR__ . '/../includes/layout.php';

$tags = Content::tags();
page_start('工作與活動', ['route' => 'grad']);
shell_start('grad', 'opps');
?>
<div class="page-head">
  <div class="stack">
    <span class="eyebrow">畢業生路線 _05</span>
    <h1 class="page-title">工作與活動</h1>
    <p class="muted" style="max-width:760px">按你的主修、興趣、技能和專業資格配對職位方向、實習、政府青年就業計劃、課程與考證、活動和比賽。每項都附官方網站或求職網站的連結，並寫明核實日期。</p>
    <p class="hint">外部連結會在新分頁開啟；資料以主辦機構或政府最新公布為準，請看頁底的<a href="#disclaimer">免責聲明</a>。</p>
  </div>
</div>

<div class="stack" style="--gap:12px">
  <div class="row" id="filters" role="group" aria-label="篩選類型" style="--gap:10px">
    <button type="button" class="chip" data-kind="all" aria-pressed="true">全部</button>
    <button type="button" class="chip" data-kind="role" aria-pressed="false">職位方向</button>
    <button type="button" class="chip" data-kind="intern" aria-pressed="false">實習</button>
    <button type="button" class="chip" data-kind="scheme" aria-pressed="false">政府計劃</button>
    <button type="button" class="chip" data-kind="course" aria-pressed="false">課程與考證</button>
    <button type="button" class="chip" data-kind="event" aria-pressed="false">活動</button>
    <button type="button" class="chip" data-kind="contest" aria-pressed="false">比賽</button>
  </div>
  <div class="row" id="areas" role="group" aria-label="規劃重點範疇" style="--gap:10px"></div>
</div>

<section class="card card-deep stack match-basis" aria-labelledby="basis-title" style="--gap:10px">
  <div class="spread"><h2 id="basis-title" style="font-size:16px">配對根據</h2><a class="btn btn-sm" href="<?= e(u('grad/index.php')) ?>">修改資料</a></div>
  <div id="basis" class="match-grid"></div>
  <p class="hint">計分：主修相符 ×3、興趣相符 ×2、技能相符 ×1、專業資格相符 +1。不使用性別、年齡或性格問卷結果。</p>
</section>

<section class="stack" id="recommended" aria-labelledby="rec-title" style="--gap:16px">
  <div class="spread"><h2 id="rec-title" style="font-size:22px">推薦給你</h2><span class="hint" id="rec-count"></span></div>
  <div class="grid-3" id="cards" aria-live="polite"></div>
</section>

<section class="stack" id="schemes" aria-labelledby="scheme-title" style="--gap:16px">
  <div class="stack" style="--gap:4px">
    <h2 id="scheme-title" style="font-size:22px">政府青年就業及培訓計劃</h2>
    <p class="hint">按你的資料排序，全部連到官方網頁。新公布的計劃如果未有申請網頁，會連到施政報告原文。</p>
  </div>
  <div class="grid-2" id="scheme-cards" aria-live="polite"></div>
</section>

<section class="card stack disclaimer" id="disclaimer" aria-labelledby="disclaimer-title" style="--gap:10px">
  <h2 id="disclaimer-title" style="font-size:17px">免責聲明</h2>
  <ol class="disclaimer-list">
    <li>本頁資料由 2PP Helper 團隊根據官方網站和公開資料整理，只供參考，不構成就業、升學、財務或法律意見。</li>
    <li>計劃內容、申請資格、名額、資助金額和截止日期可能隨時改變，一切以主辦機構或政府部門的最新公布為準。每項資料都寫明核實日期。</li>
    <li>外部連結會在新分頁開啟其他網站。本平台與所列機構、公司和求職網站沒有從屬或合作關係，不負責其內容、私隱做法或服務，也不保證申請或錄取結果。</li>
    <li>職位方向和實習連到 JobsDB 的即時搜尋結果，職位由僱主刊登，本平台沒有審核個別職位。</li>
    <li>證書名稱和考試編號以頒發機構網站為準。</li>
    <li>推薦只按你自行填寫的主修、興趣、技能和專業資格計分。你的資料只留在你的瀏覽器，不會傳送給所列機構。</li>
  </ol>
</section>
<?php
echo json_island('opps', Content::opportunities());
echo json_island('tag-map', $tags['labels']);
echo policy_island();
shell_end();
page_end(['pages/opportunities.js']);
