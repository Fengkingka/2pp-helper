<?php
declare(strict_types=1);
require __DIR__ . '/../includes/bootstrap.php';
require __DIR__ . '/../includes/layout.php';

page_start('職涯方向 AI 助理', ['route' => 'grad', 'llmPurpose' => 'advisor']);
shell_start('grad', 'advisor');
?>
<div class="grid-2" style="--cols:400px minmax(0,1fr);--gap:32px;align-items:start">
  <section class="card" aria-label="與 AI 助理對話" style="padding:0;display:flex;flex-direction:column;overflow:hidden;position:sticky;top:24px">
    <div class="row" style="padding:18px 22px;border-bottom:1px solid var(--line);flex-wrap:nowrap">
      <span class="icon-box" style="border-radius:50%;border:2px solid var(--accent);font-size:10px;color:var(--text-4)">角色</span>
      <span class="stack" style="--gap:0"><b>職涯方向 AI 助理</b><span class="hint">根據你的資料探索方向與下一步</span><span class="hint" id="advisor-source" role="status" hidden></span><span class="hint">對話與職涯資料會送至 AI 服務；問卷只在你選擇分享後使用。</span></span>
    </div>
    <div id="chat" class="stack" aria-live="polite" style="--gap:14px;padding:22px;min-height:320px;max-height:56vh;overflow-y:auto"></div>
    <form id="chat-form" class="row" style="padding:16px;border-top:1px solid var(--line);flex-wrap:nowrap;--gap:10px">
      <label for="msg" class="sr-only">輸入訊息</label>
      <input id="msg" class="input" maxlength="500" autocomplete="off" placeholder="例如：哪條路徑最快入行？">
      <button type="submit" class="btn btn-primary" aria-label="傳送" style="padding:0 14px"><?= icon('send', 18) ?></button>
    </form>
  </section>

  <section class="stack" aria-labelledby="paths-title" style="--gap:22px;min-width:0">
    <div class="page-head">
      <div class="stack"><span class="eyebrow">畢業生路線 _03</span><h1 class="page-title" id="paths-title">可行的職涯路徑</h1></div>
      <button type="button" class="btn btn-sm" id="refresh">重新建議</button>
    </div>
    <div id="paths"></div>
  </section>
</div>
<?php
echo policy_island();
shell_end();
page_end(['pages/advisor.js'], true);
