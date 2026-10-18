<?php
declare(strict_types=1);
require __DIR__ . '/../includes/bootstrap.php';
require __DIR__ . '/../includes/layout.php';

page_start('Term Sheet 談判', ['route' => 'startup', 'theme' => 'war']);
?>
<div class="sim">
  <header class="sim-top">
    <div class="title">
      <a class="btn btn-sm" href="<?= e(u('startup/index.php')) ?>" aria-label="返回創業者路線"><?= icon('back', 16) ?></a>
      <span class="tag tag-coral">TERM SHEET</span><span>種子輪談判</span>
    </div>
    <div class="row"><span class="mono faint" id="round-text"></span><?php language_switch(); ?></div>
  </header>
  <main class="sim-body" id="main">
    <div class="grid-2" style="--cols:minmax(0,1.15fr) minmax(0,1fr);--gap:24px;align-items:start">
      <section class="stack" style="--gap:18px" aria-label="談判">
        <div class="field investor-pick">
          <span class="label" id="investor-label">投資者類型（轉換會重新開始談判）</span>
          <div class="seg" id="investor-type" role="group" aria-labelledby="investor-label"></div>
          <p class="fund-note" id="investor-note" hidden></p>
        </div>
        <div class="card card-war row" style="flex-wrap:nowrap;align-items:flex-start;--gap:16px">
          <span class="icon-box" style="border-radius:50%;width:56px;height:56px;border:2px solid var(--coral);font-size:10px;color:var(--text-4)">投資者</span>
          <div class="stack" style="--gap:6px"><span class="hint">投資者（角色）</span><p id="investor-line" style="font-size:17px;line-height:1.8" aria-live="polite"></p></div>
        </div>
        <div class="card card-war" id="terms"></div>
        <div class="field">
          <label for="message">給投資者的回覆（可選，一兩句說明你的考慮）</label>
          <textarea id="message" class="textarea" rows="3" maxlength="400" placeholder="例如：我們接受 600 萬估值，但期權池希望在投後設立，因為……"></textarea>
        </div>
        <div class="banner" id="walk-banner" hidden>投資者表示會退出談判。你可以改變選擇，或者接受沒有交易的結果並完成練習。</div>
        <div class="row">
          <button type="button" class="btn" id="prev">上一輪</button>
          <button type="button" class="btn btn-coral" id="next">下一輪</button>
          <span id="status"></span>
        </div>
      </section>

      <aside class="stack" style="--gap:18px" aria-label="計算結果">
        <div class="card card-war stack" style="--gap:14px">
          <div class="spread"><b>持股比例</b><span class="badge">由計算器計算</span></div>
          <div id="ownership"></div>
        </div>
        <div class="card card-war stack" style="--gap:14px">
          <div class="spread"><b>退出時創辦人實得</b><span class="hint">A 輪、B 輪後</span></div>
          <div id="exits"></div>
          <p class="hint" id="assumptions"></p>
        </div>
        <section class="card card-war stack" style="--gap:14px" id="stress-card" aria-labelledby="stress-title" hidden>
          <div class="spread"><b id="stress-title">下跌輪壓力測試</b><span class="badge">由計算器計算</span></div>
          <p class="hint" id="stress-desc"></p>
          <div id="stress"></div>
        </section>
        <section class="card card-war stack" style="--gap:14px" id="prorata-card" aria-labelledby="prorata-title" hidden>
          <div class="spread"><b id="prorata-title">跟投權的影響</b><span class="badge">由計算器計算</span></div>
          <div id="prorata"></div>
        </section>
        <p class="legal-note">教育用途，並非法律或投資意見。</p>
      </aside>
    </div>
  </main>
</div>
<?php page_end(['pages/term-sheet.js']); ?>
