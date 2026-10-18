<?php
declare(strict_types=1);
require __DIR__ . '/../includes/bootstrap.php';
require __DIR__ . '/../includes/layout.php';
page_start('FitCheck · 產品市場驗證', ['route'=>'startup', 'bodyClass'=>'fitcheck-page']);
shell_start('startup', 'fitcheck');
?>
<link rel="stylesheet" href="<?= e(asset_url('assets/css/fitcheck.css')) ?>">
<div id="fitcheck" translate="no">
  <header class="fc-hero no-print">
    <div><span class="eyebrow">FITCHECK / 01</span><h1 data-zh="先驗證，再投入。" data-en="Validate before you build.">先驗證，再投入。</h1>
    <p class="muted" data-zh="把創業構想變成可測試的假設，用證據找出下一步。" data-en="Turn your startup idea into testable assumptions. Let evidence shape your next move.">把創業構想變成可測試的假設，用證據找出下一步。</p></div>
    <span class="fc-mark" aria-hidden="true">Fit<span>Check</span><i>IDEA → EVIDENCE → NEXT STEP</i></span>
  </header>
  <nav id="fc-tabs" class="fc-tabs no-print" aria-label="FitCheck"></nav>
  <p id="fc-status" class="hint no-print" role="status" aria-live="polite"></p>
  <section id="fc-editor" class="no-print"></section>
  <article id="fc-report" hidden></article>
  <section id="fc-history" class="no-print" hidden></section>
</div>
<?= json_island('fitcheck-config', ['sources'=>FitCheckSources::configuration(), 'aiConfigured'=>Config::llmMode() === 'live' && (bool) Config::get('LLM_MODEL_CHAT') && (bool) Config::get('LLM_API_KEY')]) ?>
<?php shell_end(); page_end(['fitcheck-core.js', 'pages/fitcheck.js']); ?>
