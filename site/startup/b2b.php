<?php
declare(strict_types=1);
require __DIR__ . '/../includes/bootstrap.php';
require __DIR__ . '/../includes/layout.php';

page_start('B2B 電郵練習', ['route' => 'startup', 'theme' => 'war']);
?>
<div class="sim">
  <header class="sim-top">
    <div class="title">
      <a class="btn btn-sm" href="<?= e(u('startup/index.php')) ?>" aria-label="返回創業者路線"><?= icon('back', 16) ?></a>
      <span class="tag tag-coral">B2B</span><span id="scenario-title">電郵練習</span>
    </div>
    <div class="row"><span class="mono faint" id="step-text"></span><?php language_switch(); ?></div>
  </header>
  <main class="sim-body" id="main">
    <div class="grid-2" style="--cols:280px minmax(0,1fr);--gap:24px;align-items:start">
      <aside class="card card-war stack" style="--gap:12px" aria-label="電郵往來">
        <b>電郵往來</b>
        <div class="thread" id="thread"></div>
        <p class="hint">對方的下一封電郵，會按你的回覆內容而改變。</p>
      </aside>
      <section class="stack" style="--gap:18px" id="work">
        <p class="mono faint" id="time-skip" hidden></p>
        <article class="mail" id="mail" aria-live="polite"></article>
        <div class="field">
          <label for="reply">你的回覆</label>
          <textarea id="reply" class="textarea" rows="10" placeholder="Grace 你好，"></textarea>
        </div>
        <div class="spread">
          <div class="row" id="checks" style="--gap:8px" aria-label="檢查"></div>
          <button type="button" class="btn btn-coral" id="send"><?= icon('send', 16) ?>傳送回覆</button>
        </div>
        <div id="status"></div>
      </section>
    </div>
    <section id="result" class="card stack" style="--gap:16px;max-width:760px" hidden></section>
  </main>
</div>
<?php page_end(['pages/b2b.js']); ?>
