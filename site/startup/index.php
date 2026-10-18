<?php
declare(strict_types=1);
require __DIR__ . '/../includes/bootstrap.php';
require __DIR__ . '/../includes/layout.php';
page_start('創業規劃與現金流', ['route' => 'startup']);
shell_start('startup', 'hub');
?>
<div class="page-head"><div class="stack"><span class="eyebrow">2PP Helper · 3.2</span><h1 data-zh="創業規劃與現金流" data-en="Startup planning and cash flow"></h1><p class="muted" data-zh="先了解假設，再比較決定。所有金額由同一計算器算出。" data-en="Understand the assumptions, then compare decisions. One calculator produces all amounts."></p></div><button class="btn" id="use-demo" data-zh="試用示範公司" data-en="Try demo company"></button></div>
<div id="startup-warning" class="assumption-note" translate="no"></div>
<div class="wizard-layout" style="margin-top:24px"><form class="card stack" id="company" novalidate translate="no"></form><div class="stack" style="--gap:20px" translate="no"><section id="financial-summary" class="card stack"></section><section id="financial-chart" class="card stack"></section><section id="financial-compare" class="card stack"></section></div></div>
<div class="stack" style="--gap:24px;margin-top:24px" translate="no"><section id="financial-roster" class="card stack"></section><section id="financial-table" class="card stack"></section><section id="financial-balance" class="card stack"></section><section id="financial-sources" class="card stack"></section><section id="startup-next" class="card stack"></section></div>
<?php shell_end(); page_end(['pages/startup-hub.js']); ?>
