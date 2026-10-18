<?php
declare(strict_types=1);
require __DIR__ . '/../includes/bootstrap.php';
require __DIR__ . '/../includes/layout.php';
$scenario = VcPanel::scenario();
page_start('Hostile VC：三人融資練習', ['route'=>'startup','theme'=>'war']);
shell_start('startup','vc-voice');
?>
<link rel="stylesheet" href="<?= e(asset_url('assets/css/vc-panel.css')) ?>">
<?= json_island('vc-content', $scenario) ?>
<div class="page-head"><div class="stack"><span class="eyebrow">創業者路線 · Voice interview</span><h1 class="page-title">Hostile VC</h1><p class="muted" data-vc-label="intro">三位投資者，六輪問題。練習用證據、假設與下一步回應質疑。</p></div></div>
<div class="vc-roster" aria-label="Investor panel">
<?php foreach ($scenario['panel']['roles'] as $role): ?>
  <article class="vc-investor" data-role="<?= e($role['id']) ?>"><span class="mono faint"><?= e(strtoupper($role['id'])) ?></span><h2 data-vc-name="<?= e($role['id']) ?>"><?= e($role['nameYue']) ?></h2><p class="hint" data-vc-focus="<?= e($role['id']) ?>"><?= e($role['focusYue']) ?></p><span class="hint" data-vc-voice="<?= e($role['id']) ?>"></span></article>
<?php endforeach; ?>
</div>
<section class="card stack" id="vc-setup">
  <h2 data-vc-label="setup">公司與簡短 pitch</h2>
  <div class="grid-2"><div class="field"><label for="vc-name" data-vc-label="name">公司名稱</label><input id="vc-name" class="input" maxlength="60"></div><div class="field"><label for="vc-industry" data-vc-label="industry">行業</label><input id="vc-industry" class="input" maxlength="60"></div></div>
  <div class="field"><label for="vc-stage" data-vc-label="stage">階段</label><select id="vc-stage" class="input"><option value="pre_seed">Pre-seed</option><option value="seed">Seed</option><option value="series_a">Series A</option></select></div>
  <div class="field"><label for="pitch" data-vc-label="pitch">簡短 pitch（必填，最多 1,200 字）</label><textarea id="pitch" class="input" maxlength="1200" rows="3" required></textarea></div>
  <p class="hint" data-vc-label="finances">以下數字可留空，留空代表未知；自報資料只作練習，不視為已核實財務。</p>
  <div class="grid-2">
  <?php foreach ([['cac','CAC（HK$）'],['ltv','LTV（HK$）'],['monthlyBurn','每月現金消耗（HK$/月）'],['runway','現金可撐（月）']] as [$key,$label]): ?>
    <div class="field"><label for="vc-<?= e($key) ?>" data-vc-label="<?= e($key) ?>"><?= e($label) ?></label><input id="vc-<?= e($key) ?>" class="input" type="number" min="0" max="<?= $key==='runway' ? '1200' : '1000000000000' ?>" step="any"></div>
  <?php endforeach; ?>
  </div>
  <details><summary data-vc-label="deck">可選：本機 PDF 或貼上 deck 文字</summary><div class="stack vc-deck">
    <label for="vc-pdf" data-vc-label="pdf">PDF：最多 10 MB、30 頁；只在本機提取最多 12,000 字</label><input id="vc-pdf" class="input" type="file" accept="application/pdf,.pdf"><p id="vc-pdf-status" class="hint" role="status"></p>
    <label for="deck-text" data-vc-label="preview">提取文字預覽／貼上相關內容（可編輯；原始檔案不會上傳或儲存）</label><textarea id="deck-text" class="input" rows="5" maxlength="12000"></textarea>
  </div></details>
  <label class="vc-check"><input id="consent" type="checkbox"><span data-vc-label="consent">我同意開始後將以上相關文字及回答傳給 AI；若選 MiniMax，回答錄音片段亦會傳給 MiniMax 作識別。瀏覽器語音識別可能使用瀏覽器供應商的網絡服務。</span></label>
  <p class="hint" data-vc-label="notice">中文問答用粵語，英文問答用英語；開始時鎖定語言與設定。戴耳機可減少回音。錄音只包含本機麥克風，沒有承諾混合投資者聲音。請在離開前下載。</p>
  <div class="field"><label for="vc-speech-mode" data-vc-label="mode">語音識別方式</label><select id="vc-speech-mode" class="input"><option value="cloud" disabled data-vc-label="cloud">MiniMax 片段識別（最多 60 秒／段）</option><option value="browser" disabled data-vc-label="browser">瀏覽器即時識別（如可用）</option></select><span id="vc-provider-status" class="hint" role="status"></span></div>
  <div class="row"><button class="btn btn-primary" id="start-voice" type="button" disabled data-vc-label="startVoice">開始語音練習</button><button class="btn" id="start-text" type="button" disabled hidden data-vc-label="startText">開始文字練習</button></div>
</section>
<section class="card stack" id="vc-session" data-phase="idle" hidden>
  <div class="spread"><h2 id="vc-round"></h2><span id="vc-phase" class="badge" role="status"></span></div>
  <p id="vc-language" class="hint"></p><p id="vc-source" class="hint"></p>
  <figure id="vc-avatar" class="vc-avatar"><img src="<?= e(asset_url('assets/img/vc-investor.png')) ?>" width="1254" height="1254" alt="虛擬投資者 / Virtual investor" decoding="async"></figure>
  <div id="vc-question" class="vc-question" translate="no"></div>
  <div id="vc-log" class="vc-log" aria-label="Conversation transcript" translate="no"></div>
  <p id="vc-message" class="hint" role="status" aria-live="polite"></p>
  <p id="vc-countdown" class="vc-countdown" role="status" aria-live="assertive" aria-atomic="true" hidden></p>
  <button class="btn" id="vc-replay" type="button" hidden data-vc-label="replay">重新播放問題</button>
  <div id="vc-answer-controls" class="stack" hidden>
    <p id="vc-recording-status" class="hint" role="status" aria-live="polite"></p>
    <div class="row"><button class="btn btn-primary" id="vc-answer-start" type="button" data-vc-label="answerStart">開始回答</button><button class="btn" id="vc-answer-pause" type="button">暫停</button><button class="btn" id="vc-answer-end" type="button" data-vc-label="answerEnd">結束回答</button></div>
  </div>
  <div class="field" id="vc-answer-box"><label for="vc-answer" data-vc-label="answer">你的回答／可修改的字幕</label><textarea id="vc-answer" class="input" maxlength="3000" rows="4" translate="no"></textarea></div>
  <label id="vc-recovery" class="vc-check" hidden><input id="vc-recovery-confirm" type="checkbox"><span data-vc-label="recovery">錄音未能轉錄。請在上方重建回答並確認內容；未確認前不會評分。原錄音可在下方下載。</span></label>
  <div class="row"><button class="btn btn-primary" id="vc-submit" type="button" data-vc-label="submit">提交回答</button><button class="btn" id="vc-text-switch" type="button" hidden data-vc-label="switch">改用文字</button><button class="btn" id="vc-finish" type="button" data-vc-label="finish">結束面試</button></div>
  <div class="row" id="vc-done"><button class="btn" id="vc-retry" type="button" hidden data-vc-label="retry">重新評分</button><a class="btn btn-primary" id="vc-report-link" hidden data-vc-label="report">查看報告</a><a class="btn" href="<?= e(u('startup/vc-panel.php')) ?>" id="vc-restart" hidden data-vc-label="restart">再練一次</a></div>
  <section id="vc-audio-box" class="stack" hidden><h3 data-vc-label="recording">本機麥克風錄音</h3><audio id="vc-audio" controls></audio><a class="btn" id="vc-download" data-vc-label="download">下載錄音</a><p class="hint" data-vc-label="downloadNote">錄音未儲存至報告；離開或重新整理後將失去，請先下載。</p></section>
</section>
<p class="hint vc-disclaimer" data-vc-label="disclaimer">只作內容練習；五個核心維度等權，未完成用戶校準。不是專業投資評估，也不提供法律或財務建議。不評發音、口音、性格、信心或人口特徵。</p>
<?php shell_end(); page_end(['interview-demo.js','interview-conversation.js','vc-panel.js','vc-voice.js','vc-pdf.js','pages/vc-panel.js'],true); ?>
