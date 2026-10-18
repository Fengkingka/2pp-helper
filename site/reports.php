<?php
declare(strict_types=1);
require __DIR__ . '/includes/bootstrap.php';
require __DIR__ . '/includes/layout.php';

page_start('我的報告');
topnav('reports', true);
?>
<main class="sim-body" id="main" style="max-width:1320px;margin:0 auto;width:100%">
  <div class="page-head">
    <div class="stack"><span class="eyebrow">我的報告</span><h1 class="page-title">每次練習的評分報告</h1>
      <p class="muted">報告只儲存在這個瀏覽器，最多保留 30 份。</p></div>
  </div>
  <section id="fitcheck-report-index" class="card stack no-print" translate="no" style="margin-bottom:24px"></section>
  <div class="grid-2" style="--cols:320px minmax(0,1fr);--gap:28px;align-items:start" id="layout">
    <nav class="stack no-print" id="list" style="--gap:10px" aria-label="報告列表"></nav>
    <article id="detail" class="stack" style="--gap:22px;min-width:0"></article>
  </div>
</main>
<?= policy_island() ?>
<?php page_end(['fitcheck-core.js', 'pages/reports.js', 'pages/fitcheck-reports.js'], true); ?>
