<?php
declare(strict_types=1);
require __DIR__ . '/../includes/bootstrap.php';
require __DIR__ . '/../includes/layout.php';

$englishDemo = ($_GET['mode'] ?? '') === 'demo';
$conversationMode = !$englishDemo;
$liveEvaluation = Config::evaluationMode('interview_english_demo_v1') === 'live';
page_start($conversationMode ? '對話面試' : ($englishDemo ? '英文面試' : 'AI 面試教練'), ['route' => 'grad', 'theme' => 'war']);
?>
<?= json_island('interview-settings', ['conversation' => $conversationMode]) ?>
<main class="iv" id="main">
  <svg class="iv-bg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true">
    <circle cx="720" cy="470" r="200" stroke="#152026"/><circle cx="720" cy="470" r="300" stroke="#131D22"/>
    <circle cx="720" cy="470" r="410" stroke="#121B20" stroke-dasharray="2 8"/><circle cx="720" cy="470" r="530" stroke="#111A1E"/>
    <circle cx="720" cy="470" r="660" stroke="#10181C" stroke-dasharray="2 10"/>
  </svg>

  <div class="iv-top">
    <div class="row">
      <a class="btn btn-sm" href="<?= e(u('grad/index.php')) ?>"><?= icon('back', 16) ?>返回路線總覽</a>
      <div class="hint-box"><span class="ic"><?= icon('headphones') ?></span><span class="tx">戴上耳機效果最好<br>可避免回音被誤判為說話_</span></div>
    </div>
    <div class="row iv-actions">
      <a class="btn btn-sm" href="<?= e(u('grad/interview.php')) ?>"<?= $conversationMode ? ' aria-current="page"' : '' ?>>對話面試</a>
      <a class="btn btn-sm" href="<?= e(u('grad/interview.php?mode=demo')) ?>"<?= $englishDemo && !$conversationMode ? ' aria-current="page"' : '' ?>>英文示範</a>
      <span class="mono faint" id="timer" hidden>00:00</span>
      <?php language_switch(); ?>
    </div>
  </div>

  <section id="idle" class="iv-idle" aria-labelledby="iv-title">
    <span class="eyebrow">畢業生路線 _06</span>
    <h1 id="iv-title" class="iv-title bracket"><span class="us">_</span><?= $conversationMode ? 'AI 面試' : ($englishDemo ? '英文面試' : 'AI 面試') ?><br>練習室</h1>
    <p class="iv-sub"><?= $conversationMode ? '根據你的 CV 和目標職位練習：可選 3 題快速練習或 5 題完整練習，涵蓋經歷、行為及情境／行業認知。每題最多一次追問；完結後先檢查回答，再評分。問答及報告語言在開始時鎖定。' : ($englishDemo ? ($liveEvaluation ? '示範題庫：5 條固定英文問題，不按 CV 或職位生成。少於 30 個英文詞時，每題最多追加一次預設追問。完成後由 AI 按評分準則生成報告。' : '示範題庫：5 條固定英文問題，不按 CV 或職位生成。少於 30 個英文詞時，每題最多追加一次預設追問。示範評分，尚未連接 AI。') : '根據你的 CV 和目標職位，進行 5 條問題的模擬面試。每條最多追問一次。') ?></p>
    <div class="role-pill">
      <label for="role" class="muted"><?= $englishDemo && !$conversationMode ? '目標職位（只作報告標題）' : '目標職位' ?></label>
      <input id="role" class="input" maxlength="60">
    </div>
    <?php if ($conversationMode): ?>
    <div class="card stack" id="track-controls" style="--gap:10px;max-width:620px;margin:18px auto;text-align:left">
      <div translate="no" class="stack" style="--gap:10px"><label class="field"><span data-zh="練習長度" data-en="Practice length"></span><select id="practice-length" class="select"><option value="5" data-zh="完整練習：5 題" data-en="Full practice: 5 questions"></option><option value="3" data-zh="快速練習：3 題" data-en="Short practice: 3 questions"></option></select></label><label class="field"><span data-zh="職位描述（可選；由你提供，未經核實）" data-en="Job description (optional; supplied by you, unverified)"></span><textarea id="job-description" class="textarea" rows="3" maxlength="2000"></textarea></label></div>
      <label for="interview-track">評分路線（可自行更改）</label>
      <select id="interview-track" class="input">
        <option value="">請選擇並確認</option>
        <option value="graduate">畢業生／初入職場</option>
        <option value="experienced">已有工作經驗</option>
      </select>
      <p class="hint" id="track-recommendation" role="status">正在查看經歷證據……</p>
      <p class="hint">畢業生路線接受課程、實習及義工例子；工作經驗路線看獨立責任、取捨及職位相關影響，不要求管理職位。五個核心維度等權，行業認知另外顯示。</p>
      <label class="row" for="track-confirm"><input type="checkbox" id="track-confirm"> <span>我確認使用以上路線及目標職位開始練習</span></label>
    </div>
    <?php endif; ?>
    <button type="button" class="ring-btn" id="start-voice" aria-describedby="voice-note"<?= $conversationMode ? ' disabled' : '' ?>><?= $conversationMode ? '開始對話面試' : ($englishDemo ? '開始英文面試' : '開始') ?></button>
    <p class="hint" id="voice-note"></p>
    <button type="button" class="link-btn" id="start-text"<?= $conversationMode ? ' disabled' : '' ?>>[ 不用語音，改用文字作答 ]</button>

    <label class="row iv-option" for="industry-q" style="--gap:8px"<?= $englishDemo ? ' hidden' : '' ?>><input type="checkbox" id="industry-q" checked> <span>加入一條「行業認知」題（香港產業發展）</span></label>
    <p class="hint iv-strength" id="strength-tip" hidden></p>

    <div class="float-card fc-1"><b class="mono accent" style="font-size:26px"><?= $conversationMode ? '3 / 5 條' : '5 條' ?></b><span><?= $englishDemo ? '2 條經歷題、2 條行為題、1 條情境題；次序固定。' : '2 條根據你的 CV、2 條行為題、1 條情境題或行業認知題。' ?></span></div>
    <div class="float-card fc-2"><b><?= $conversationMode ? '上下文追問' : ($englishDemo ? '預設追問' : '會追問') ?></b><span><?= $conversationMode ? '根據你的回答追問，最多一次；服務不可用時用標示清楚的後備問題。' : ($englishDemo ? '少於 30 個英文詞會追問一次，不是 AI 分析。' : '回答欠缺行動或結果時，教練會追問一次。') ?></span></div>
    <div class="float-card fc-3"><b><?= $conversationMode ? '自動接話' : '即時字幕' ?></b><span><?= $conversationMode ? '說完停頓約 2.5 秒自動提交，也可以按「答完了」；暫不支援打斷。' : '你和教練說的每句話都會即時顯示。' ?></span></div>
    <div class="float-card fc-4"><b>評分報告</b><span><?= $conversationMode ? 'DeepSeek 分析回答；錄音保留在本頁，語音指標只屬字幕估算。' : ($englishDemo ? '評分報告與咪高峰錄音；語音指標由英文字幕估算。' : '評分、語速、口頭禪和錄音回放。') ?></span></div>
  </section>

  <section id="session" class="iv-session" hidden aria-label="面試進行中">
    <div class="iv-main">
      <div class="route compact" id="progress" style="align-self:stretch"></div>
      <div class="q-card" aria-live="polite"><span class="kind" id="q-kind"></span><span class="q" id="q-text"<?= $englishDemo ? ' lang="en"' : '' ?>></span><span id="q-policy" class="q-policy" hidden></span></div>
      <p class="hint" id="mode-note" role="status"><?= $conversationMode ? '問答語言會在開始時鎖定；只錄咪高峰，請戴耳機。' : '示範題庫 · 英文問答 · 只錄咪高峰，不包含教練聲音；請戴耳機。' ?></p>
      <div id="voice-ui" class="stack" style="align-items:center;--gap:14px">
        <div class="avatar" id="avatar" data-state="idle">
          <svg class="coach-svg" viewBox="0 0 180 180" fill="none" role="img" aria-label="原創面試教練：待機、聆聽、思考、說話四種狀態">
            <circle cx="90" cy="90" r="77" fill="#142A2B"/>
            <path d="M41 171V150C41 125 139 125 139 150V171" fill="#235451"/>
            <path d="M76 134L90 150L104 134" stroke="#69DEC2" stroke-width="4" stroke-linecap="round"/>
            <path d="M53 80C47 27 130 19 129 81L119 95H60Z" fill="#243438"/>
            <rect x="59" y="53" width="62" height="79" rx="29" fill="#EFC6A0"/>
            <path d="M58 78C61 42 90 32 121 58L121 77C101 75 87 62 83 55C77 67 68 75 58 78Z" fill="#243438"/>
            <g class="coach-eyes" stroke="#243438" stroke-width="4" stroke-linecap="round">
              <path d="M72 87H77M103 87H108"/>
            </g>
            <path class="coach-brow" d="M69 79L80 77M101 77L111 79" stroke="#243438" stroke-width="2" stroke-linecap="round"/>
            <path d="M86 98L84 103H90" stroke="#C4916E" stroke-width="2" stroke-linecap="round"/>
            <path class="coach-smile" d="M80 113Q90 120 101 113" stroke="#754C40" stroke-width="3" stroke-linecap="round"/>
            <ellipse class="coach-mouth" cx="90" cy="115" rx="9" ry="6" fill="#754C40"/>
            <path class="coach-headset" d="M47 94V78C47 22 134 22 134 78V95M133 94V109H120" stroke="#69DEC2" stroke-width="5" stroke-linecap="round"/>
            <rect x="42" y="78" width="12" height="27" rx="6" fill="#69DEC2"/>
            <rect x="129" y="78" width="12" height="27" rx="6" fill="#69DEC2"/>
            <circle class="coach-thought" cx="142" cy="39" r="8" fill="#F7977A"/>
          </svg>
          <span class="coach-label"><?= $conversationMode ? '面試教練 · 原創角色' : '英文面試教練 · 原創角色' ?></span>
        </div>
        <div class="iv-status" role="status"><span class="levels" id="levels"><span></span><span></span><span></span><span></span></span><span id="status-text">準備中</span></div>
      </div>
      <div id="text-ui" class="stack" style="align-self:stretch;--gap:10px" hidden>
        <label for="answer" class="muted"><?= $englishDemo && !$conversationMode ? '你的英文回答' : '你的回答' ?></label>
        <textarea id="answer" class="textarea" rows="7" maxlength="3000"<?= $englishDemo ? ' lang="en"' : '' ?> placeholder="<?= $englishDemo ? 'Please answer in English: Situation, Task, Action, Result.' : '用 STAR 方法作答：情況、任務、行動、結果。' ?>"></textarea>
        <span class="mono faint" style="font-size:12px" id="answer-count"><?= $englishDemo ? '0 個英文詞' : '0 字' ?></span>
      </div>
      <div class="grow"></div>
      <div class="row" style="justify-content:center">
        <button type="button" class="btn" id="to-text">改用文字作答</button>
        <button type="button" class="btn btn-outline" id="submit-answer">答完了</button>
        <button type="button" class="btn btn-coral" id="finish">結束面試</button>
      </div>
    </div>
    <aside class="transcript" id="transcript" aria-label="即時字幕" aria-live="polite"><b>即時字幕</b></aside>
  </section>

  <section id="done" class="iv-done" hidden>
    <div class="card stack" style="--gap:18px">
      <h2 style="font-size:26px">面試完結</h2>
      <div id="done-status"></div>
      <div id="recording" class="stack" style="--gap:8px" hidden>
        <span class="muted"><?= $conversationMode ? '下載錄音只留在本頁，不包含教練聲音。語音識別服務可能處理音頻；啟用 MiniMax 時會上傳每次回答片段轉錄。離開前請先下載。' : ($englishDemo ? '錄音只有咪高峰聲音，不包含教練朗讀，亦不會上傳。錄音只留在本頁，離開前請先下載。' : '錄音只在這個瀏覽器，離開頁面後就會消失。需要的話請先下載。') ?></span>
        <audio id="audio" controls style="width:100%"></audio>
        <a class="btn btn-sm" id="download-audio" download="interview.webm" style="align-self:flex-start">下載錄音</a>
      </div>
      <div class="row" id="done-actions"></div>
    </div>
  </section>
</main>
<?= policy_island() ?>
<?php page_end(['interview-demo.js', 'interview-conversation.js', 'pages/interview-english.js'], true); ?>
