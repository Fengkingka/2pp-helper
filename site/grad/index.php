<?php
declare(strict_types=1);
require __DIR__ . '/../includes/bootstrap.php';
require __DIR__ . '/../includes/layout.php';
page_start('我的職涯起點', ['route' => 'grad']);
shell_start('grad', 'hub');
?>
<div class="page-head"><div class="stack"><span class="eyebrow">2PP Helper · 3.2</span><h1 data-zh="我的職涯起點" data-en="Your career starting point">我的職涯起點</h1><p class="muted" data-zh="先填簡單資料，其他內容可以稍後補充。" data-en="Start with the essentials. Add more detail whenever you are ready."></p></div><button type="button" class="btn" id="load-demo" data-zh="試用示範模式" data-en="Try demo mode"></button></div>
<div class="wizard-layout">
<section class="card stack" translate="no"><nav class="wizard-nav" id="wizard-nav" aria-label="Profile steps"></nav><form id="profile-form" novalidate><div id="wizard-pages"></div><p id="form-error" class="field-error" role="alert"></p><p id="save-status" class="hint save-status" role="status" aria-live="polite"></p><div class="spread"><button type="button" class="btn" id="profile-back"></button><button type="submit" class="btn btn-primary" id="profile-next"></button></div></form></section>
<aside class="stack" style="--gap:20px"><section class="card stack" id="graduate-dashboard" translate="no"></section><section class="card stack" id="graduate-actions" translate="no"></section></aside>
</div>
<?php
echo json_island('tag-map', Content::tags());
echo json_island('roles-list', Content::roles());
shell_end();
page_end(['pages/grad-hub.js']);
