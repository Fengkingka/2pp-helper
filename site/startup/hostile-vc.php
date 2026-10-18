<?php
declare(strict_types=1);
require __DIR__ . '/../includes/bootstrap.php';
require __DIR__ . '/../includes/layout.php';
page_start('投資者問答練習', ['route' => 'startup']);
shell_start('startup', 'vc');
?>
<div class="page-head"><div class="stack"><span class="eyebrow">Hostile VC · practice</span><h1 data-zh="投資者問答練習" data-en="Investor challenge"></h1><p class="muted" data-zh="三條挑戰問題，練習用證據解釋你的公司與取捨。" data-en="Three challenging questions to practise explaining your company and trade-offs with evidence."></p></div></div>
<div class="wizard-layout" translate="no"><section class="card stack" id="vc-session"></section><aside class="card stack" id="vc-context"></aside></div>
<?php shell_end(); page_end(['pages/hostile-vc.js']); ?>
