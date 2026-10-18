<?php
declare(strict_types=1);
require __DIR__ . '/includes/bootstrap.php';
require __DIR__ . '/includes/layout.php';

$routes = [
    [
        'name' => '畢業生路線', 'who' => '應屆畢業生、想轉行的人', 'cls' => 'route-grad', 'href' => 'grad/index.php', 'cta' => '進入畢業生路線',
        'stops' => [
            ['建立資料', '主修、興趣、技能和專業資格，大約 2 分鐘。'],
            ['性格與強項', '可選的 18 題問卷，只作自我反思。'],
            ['職涯方向', 'AI 助理根據你的資料提出 2 至 3 條路徑。'],
            ['CV Builder', '把經歷改寫成成果句，匯出 PDF。'],
            ['工作與活動', '按主修和興趣推薦，包括政府青年就業計劃。'],
            ['AI 面試教練', '語音模擬面試，完結後出報告。'],
            ['我的五年規劃', '自訂起始年份，把路徑變成五年規劃與近期行動。'],
        ],
    ],
    [
        'name' => '創業者路線', 'who' => '初創創辦人、團隊', 'cls' => 'route-startup', 'href' => 'startup/index.php', 'cta' => '進入創業者路線',
        'stops' => [
            ['公司設定', '現金、收入、人手，或直接用示範公司。'],
            ['運營成本計算器', '比較 12 個月現金、損益、招聘與資金缺口。'],
            ['FitCheck', '檢查提案、整理市場證據，修改後重新驗證。'],
            ['Term Sheet', '與投資者談條款，看退出時實得多少。'],
            ['B2B 電郵練習', '回覆企業採購經理的各種異議。'],
            ['Hostile VC', '用客戶證據、財務取捨及下一步測試回應投資者。'],
        ],
    ],
];

page_start('先練習，再上場');
topnav();
?>
<main id="main">
  <section class="hero">
    <div class="hero-copy">
      <h1>先練習，<br>再上場。</h1>
      <p class="lead">給應屆畢業生和初創創辦人的 AI 訓練場。找方向、寫 CV、練面試；或者用 FitCheck 驗證創業提案，在模擬中練談判。</p>
      <div class="row" style="--gap:16px">
        <a class="btn btn-primary btn-lg btn-glow" href="<?= e(u('grad/index.php')) ?>">我是畢業生</a>
        <a class="btn btn-lg" style="border:1.5px solid var(--coral);color:var(--coral)" href="<?= e(u('startup/index.php')) ?>">我是創辦人</a>
      </div>
      <div class="row faint" style="--gap:10px;font-size:14px"><?= icon('lock', 16) ?><span>不用登入，資料儲存在此瀏覽器；AI 功能會傳送所需內容。</span></div>
    </div>

    <svg class="hero-art" viewBox="0 0 760 700" fill="none" aria-hidden="true" font-family="'Noto Sans HK', sans-serif">
      <circle cx="400" cy="350" r="330" stroke="#18242A" stroke-dasharray="3 7"/>
      <circle cx="400" cy="350" r="272" stroke="#3FE0B5" stroke-width="10" stroke-dasharray="1.4 13" opacity=".35"/>
      <circle cx="400" cy="350" r="250" stroke="#22313A" stroke-width="1.5"/>
      <circle cx="400" cy="350" r="185" stroke="#3FE0B5" stroke-dasharray="6 8" opacity=".4"/>
      <circle cx="400" cy="350" r="118" stroke="#22313A" stroke-width="1.5"/>
      <path d="M150 350 H290" stroke="#2A3A42" stroke-width="1.5" stroke-dasharray="4 6"/>
      <path d="M400 460 V640" stroke="#2A3A42" stroke-width="1.5" stroke-dasharray="4 6"/>
      <path d="M120 520 H230 Q250 520 250 500 V440" stroke="#22313A" stroke-width="1.5"/><circle cx="120" cy="520" r="4" fill="#22313A"/>
      <path d="M620 120 H700" stroke="#22313A" stroke-width="1.5"/><circle cx="700" cy="120" r="4" fill="#22313A"/>
      <path d="M560 610 Q620 610 620 560 V540" stroke="#22313A" stroke-width="1.5"/><circle cx="620" cy="540" r="4" fill="#22313A"/>
      <path d="M400 316 V230 Q400 200 370 200 H270 Q240 200 240 170 V80" stroke="#3FE0B5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M434 350 H540 Q570 350 570 380 V470 Q570 500 600 500 H700" stroke="#FF8A66" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="400" cy="350" r="34" fill="#0E1316" stroke="#E9F0EE" stroke-width="2"/><circle cx="400" cy="350" r="9" fill="#3FE0B5"/>
      <text x="400" y="412" fill="#E9F0EE" font-size="15" font-weight="700" text-anchor="middle">你在這裡</text>
      <g stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="400" cy="250" r="24" fill="#0E1316" stroke="#3FE0B5" stroke-width="2"/>
        <g transform="translate(390 240)" stroke="#3FE0B5"><circle cx="10" cy="10" r="8"/><path d="M13 7 L11 11 L7 13 L9 9 Z"/></g>
        <circle cx="300" cy="200" r="24" fill="#0E1316" stroke="#3FE0B5" stroke-width="2"/>
        <g transform="translate(290 190)" stroke="#3FE0B5"><path d="M5 2 H12 L16 6 V18 H5 Z"/><path d="M8 10 H13"/><path d="M8 13 H13"/></g>
        <circle cx="240" cy="100" r="24" fill="#0E1316" stroke="#3FE0B5" stroke-width="2"/>
        <g transform="translate(230 90)" stroke="#3FE0B5"><rect x="7" y="2" width="6" height="10" rx="3"/><path d="M4 10 C4 13.3 6.7 16 10 16 C13.3 16 16 13.3 16 10"/><path d="M10 16 V19"/></g>
        <circle cx="500" cy="350" r="24" fill="#0E1316" stroke="#FF8A66" stroke-width="2"/>
        <g transform="translate(490 340)" stroke="#FF8A66"><path d="M10 3 V17"/><path d="M5 17 H15"/><path d="M4 6 H16"/><path d="M4 6 L2 11 H6 Z"/><path d="M16 6 L14 11 H18 Z"/></g>
        <circle cx="570" cy="430" r="24" fill="#0E1316" stroke="#FF8A66" stroke-width="2"/>
        <g transform="translate(560 420)" stroke="#FF8A66"><path d="M11 2 L5 11 H10 L9 18 L15 9 H10 Z"/></g>
        <circle cx="680" cy="500" r="24" fill="#0E1316" stroke="#FF8A66" stroke-width="2"/>
        <g transform="translate(670 490)" stroke="#FF8A66"><rect x="2" y="5" width="16" height="11" rx="1"/><path d="M2 6 L10 12 L18 6"/></g>
      </g>
      <g fill="#C9D3D1" font-size="14">
        <text x="438" y="255">找方向</text><text x="300" y="245" text-anchor="middle">寫 CV</text><text x="278" y="105">練面試</text>
        <text x="500" y="395" text-anchor="middle">練談判</text><text x="606" y="435">壓力測試</text><text x="680" y="545" text-anchor="middle">練銷售</text>
      </g>
    </svg>
  </section>

  <section class="section stack" style="--gap:40px">
    <div class="stack" style="--gap:12px">
      <h2>選一條路線，按站練習</h2>
      <p class="muted" style="font-size:17px;max-width:640px">從資料設定出發，按需要探索職涯或創業練習。你隨時可以跳到任何一站。</p>
    </div>
    <div class="grid-2" style="--gap:40px">
      <?php foreach ($routes as $r): ?>
      <div class="route-card bracket <?= e($r['cls']) ?>" style="--c:<?= $r['cls'] === 'route-grad' ? 'var(--teal)' : 'var(--coral)' ?>">
        <div class="spread">
          <h3 style="font-size:26px;font-weight:800;color:var(--c)"><?= e($r['name']) ?></h3>
          <span class="faint" style="font-size:14px"><?= e($r['who']) ?></span>
        </div>
        <div class="stops">
          <?php foreach ($r['stops'] as $i => [$name, $desc]): ?>
          <div><span class="mono" style="font-size:13px;color:var(--c)">_0<?= $i + 1 ?></span><b style="font-size:16px"><?= e($name) ?></b><span class="muted" style="font-size:14px"><?= e($desc) ?></span></div>
          <?php endforeach; ?>
        </div>
        <a class="btn" style="align-self:flex-start;border:1.5px solid var(--c);color:var(--c)" href="<?= e(u($r['href'])) ?>"><?= e($r['cta']) ?></a>
      </div>
      <?php endforeach; ?>
    </div>
  </section>

  <section id="trust" class="section grid-2" style="--gap:64px;padding-top:120px;align-items:center">
    <div class="stack" style="--gap:32px">
      <div class="stack" style="--gap:12px">
        <h2>每次練習，都有一份報告</h2>
        <p class="muted" style="font-size:17px;max-width:540px">報告逐項評分，並引用你自己寫過或講過的句子，告訴你下一次可以怎樣做。</p>
      </div>
      <div class="stack" style="--gap:22px">
        <div class="trust"><span class="icon-box accent"><?= icon('calc') ?></span><span class="stack" style="--gap:4px"><b style="font-size:17px">數字由程式計算</b><span class="muted">股權、退出分配和現金流都由計算器算出，AI 不會自行估算數字。</span></span></div>
        <div class="trust"><span class="icon-box accent"><?= icon('check') ?></span><span class="stack" style="--gap:4px"><b style="font-size:17px">按評分準則評分</b><span class="muted">每個分數都有清楚的級別描述，並引用你的原句作證據。</span></span></div>
        <div class="trust"><span class="icon-box accent"><?= icon('doc') ?></span><span class="stack" style="--gap:4px"><b style="font-size:17px">政策資料有出處</b><span class="muted">政策卡附有原始出處及核實狀態；申請前請查閱官方最新規則。</span></span></div>
        <div class="trust"><span class="icon-box accent"><?= icon('lock') ?></span><span class="stack" style="--gap:4px"><b style="font-size:17px">本機儲存與 AI 處理</b><span class="muted">資料和報告儲存在此瀏覽器。AI 功能會把所需文字傳送至供應商；啟用雲端語音轉錄時亦會傳送回答音頻。你可以清除本機資料。</span></span></div>
        <button type="button" class="btn btn-sm" data-action="clear-data" style="align-self:flex-start">清除我的資料</button>
      </div>
    </div>
    <div class="card stack" style="--gap:22px;padding:32px">
      <div class="spread"><b style="font-size:18px">報告：B2B 電郵練習</b><span class="badge">示範</span></div>
      <p style="font-size:16px">能回應合規疑慮，但未量化 ROI。</p>
      <div class="stack" style="--gap:14px">
        <?php foreach ([['回應異議', 4, 'var(--teal)'], ['以 ROI 說服', 2, 'var(--coral)'], ['行動呼籲', 3, 'var(--text)']] as [$label, $score, $c]): ?>
        <div class="score" style="--c:<?= $c ?>">
          <span style="font-size:14px"><?= e($label) ?></span>
          <span class="score-track"><span class="fill" style="width:calc((100% - 12px) * <?= ($score - 1) / 4 ?>)"></span>
            <?php for ($n = 1; $n <= 5; $n++): ?><i class="<?= $n < $score ? 'on' : ($n === $score ? 'at' : '') ?>"></i><?php endfor; ?>
          </span>
          <span class="score-num"><?= $score ?></span>
        </div>
        <?php endforeach; ?>
      </div>
      <div class="stack" style="--gap:8px;border-radius:10px;background:var(--bg);padding:16px 18px;font-size:14px">
        <span style="color:var(--text-2)">「我們的系統功能很多……」</span>
        <span class="accent">把節省的人手時數換算成金額，再寫進第一段。</span>
      </div>
    </div>
  </section>

  <footer class="site-foot">
    <span><?= e(SITE_NAME) ?> 比賽示範版本</span>
    <span>內容只作教育用途，並非法律、投資或職業意見。</span>
  </footer>
</main>
<?php page_end(); ?>
