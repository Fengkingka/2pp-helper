<?php
declare(strict_types=1);

require_once __DIR__ . '/icons.php';

const SITE_NAME = '2PP Helper';

function asset_url(string $path): string
{
    $file = SITE_ROOT . '/' . $path;
    return u($path) . '?v=' . (is_file($file) ? (string) filemtime($file) : '0');
}

const ROUTES = [
    'grad' => [
        'title' => '畢業生路線',
        'stations' => [
            ['key' => 'hub', 'label' => '路線總覽', 'sub' => '建立資料與進度', 'href' => 'grad/index.php', 'icon' => 'profile'],
            ['key' => 'strengths', 'label' => '性格與強項', 'sub' => '可選問卷，約 3 分鐘', 'href' => 'grad/strengths.php', 'icon' => 'heart'],
            ['key' => 'advisor', 'label' => '職涯方向', 'sub' => 'AI 助理', 'href' => 'grad/advisor.php', 'icon' => 'compass'],
            ['key' => 'cv', 'label' => 'CV Builder', 'sub' => 'AI 改寫與匯出', 'href' => 'grad/cv.php', 'icon' => 'doc'],
            ['key' => 'opps', 'label' => '工作與活動', 'sub' => '按你的資料推薦', 'href' => 'grad/opportunities.php', 'icon' => 'search'],
            ['key' => 'interview', 'label' => 'AI 面試教練', 'sub' => '語音模擬面試', 'href' => 'grad/interview.php', 'icon' => 'mic'],
            ['key' => 'plan', 'label' => '我的五年規劃', 'sub' => '自訂五年與近期行動', 'href' => 'grad/plan.php', 'icon' => 'flag'],
        ],
    ],
    'startup' => [
        'title' => '創業者路線',
        'stations' => [
            ['key' => 'hub', 'label' => '路線總覽', 'sub' => '公司設定與成本計算', 'href' => 'startup/index.php', 'icon' => 'calc'],
            ['key' => 'fitcheck', 'label' => 'FitCheck', 'sub' => '提案與市場驗證', 'href' => 'startup/fitcheck.php', 'icon' => 'search'],
            ['key' => 'termsheet', 'label' => 'Term Sheet', 'sub' => '融資條款談判', 'href' => 'startup/term-sheet.php', 'icon' => 'scale'],
            ['key' => 'b2b', 'label' => 'B2B 電郵練習', 'sub' => '應對企業採購', 'href' => 'startup/b2b.php', 'icon' => 'mail'],
            ['key' => 'vc', 'label' => 'Hostile VC', 'sub' => '投資者問答練習', 'href' => 'startup/hostile-vc.php', 'icon' => 'mic'],
            ['key' => 'vc-voice', 'label' => '語音投資者面試', 'sub' => '三位投資者・六輪語音練習', 'href' => 'startup/vc-panel.php', 'icon' => 'mic'],
        ],
    ],
];

function send_security_headers(): void
{
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: same-origin');
    header('Permissions-Policy: microphone=(self), camera=()');
    header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        . "font-src https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; "
        . "frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
}

/**
 * @param array{route?:?string, theme?:string, bodyClass?:string, llmPurpose?:string} $opt
 */
function page_start(string $title, array $opt = []): void
{
    send_security_headers();
    $route = $opt['route'] ?? null;
    $classes = trim(($route ? 'route-' . $route : '') . ' ' . (($opt['theme'] ?? '') === 'war' ? 'theme-war' : '') . ' ' . ($opt['bodyClass'] ?? ''));
    ?><!doctype html>
<html lang="zh-HK">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e($title) ?>｜<?= e(SITE_NAME) ?></title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+HK:wght@400;500;700;900&amp;family=Sora:wght@400;600;700&amp;family=JetBrains+Mono:wght@400;500;700&amp;display=swap">
<link rel="stylesheet" href="<?= e(asset_url('assets/css/app.css')) ?>">
<link rel="stylesheet" href="<?= e(asset_url('assets/css/startup-v2.css')) ?>">
<link rel="stylesheet" href="<?= e(asset_url('assets/css/v32.css')) ?>">
</head>
<body class="<?= e($classes) ?>" data-base="<?= e(BASE) ?>" data-llm-mode="<?= e(Config::llmMode($opt['llmPurpose'] ?? 'chat')) ?>">
<?php
}

function language_switch(): void
{
    ?>
<div class="language-switch no-print" data-language-switch role="group" aria-label="語言">
  <button type="button" data-lang="zh-HK" aria-pressed="true">中文</button>
  <button type="button" data-lang="en" aria-pressed="false">English</button>
</div>
<?php
}

function topnav(string $current = '', bool $bordered = false): void
{
    ?>
<header class="topnav<?= $bordered ? ' bordered' : '' ?>">
  <a class="brand" href="<?= e(u('index.php')) ?>"><?= logo_mark() ?><span><?= e(SITE_NAME) ?></span></a>
  <nav aria-label="主要導航">
    <a href="<?= e(u('grad/index.php')) ?>"<?= $current === 'grad' ? ' aria-current="page"' : '' ?>>畢業生路線</a>
    <a href="<?= e(u('startup/index.php')) ?>"<?= $current === 'startup' ? ' aria-current="page"' : '' ?>>創業者路線</a>
    <a href="<?= e(u('reports.php')) ?>"<?= $current === 'reports' ? ' aria-current="page"' : '' ?>>我的報告</a>
    <a href="<?= e(u('index.php#trust')) ?>">私隱與資料</a>
  </nav>
  <?php language_switch(); ?>
</header>
<?php
}

/** 側欄：圖示欄＋路線站點（手機版變成頂部橫條）。 */
function shell_start(string $route, string $active): void
{
    $r = ROUTES[$route];
    ?>
<div class="app">
  <nav class="rail" aria-label="主要導航">
    <a class="logo" href="<?= e(u('index.php')) ?>" aria-label="返回首頁"><?= logo_mark() ?></a>
    <a class="rail-item<?= $route === 'grad' ? ' is-grad' : '' ?>" href="<?= e(u('grad/index.php')) ?>" title="畢業生路線"><?= icon('grad', 22) ?><span>畢業生</span></a>
    <a class="rail-item<?= $route === 'startup' ? ' is-startup' : '' ?>" href="<?= e(u('startup/index.php')) ?>" title="創業者路線"><?= icon('startup', 22) ?><span>創業者</span></a>
    <a class="rail-item" href="<?= e(u('reports.php')) ?>" title="我的報告"><?= icon('report', 22) ?><span>報告</span></a>
    <div class="spacer"></div>
    <a class="rail-item" href="<?= e(u('index.php#trust')) ?>" title="私隱與資料"><?= icon('lock', 22) ?><span>私隱</span></a>
  </nav>
  <aside class="panel" aria-label="<?= e($r['title']) ?>">
    <div class="stack" style="--gap:6px">
      <div class="panel-title"><?= e($r['title']) ?></div>
      <span class="hint">按順序走或隨時跳站都可以。</span>
    </div>
    <div class="vroute">
      <?php foreach ($r['stations'] as $i => $s):
          $num = '_0' . ($i + 1);
          if ($s['href'] === null): ?>
        <div class="vstop soon"><span class="node"></span><span class="txt"><b><?= e($s['label']) ?></b><span><?= e($s['sub']) ?></span></span><span class="num"><?= e($num) ?></span></div>
      <?php else: ?>
        <a class="vstop" href="<?= e(u($s['href'])) ?>"<?= $s['key'] === $active ? ' aria-current="page"' : '' ?>><span class="node"></span><span class="txt"><b><?= e($s['label']) ?></b><span><?= e($s['sub']) ?></span></span><span class="num"><?= e($num) ?></span></a>
      <?php endif; endforeach; ?>
    </div>
    <div class="panel-foot">
      <div class="row" style="--gap:8px;align-items:flex-start;flex-wrap:nowrap"><?= icon('lock', 16) ?><span>不用登入，資料儲存在你的瀏覽器。</span></div>
      <button type="button" class="btn btn-sm" data-action="clear-data" style="align-self:flex-start">清除我的資料</button>
    </div>
  </aside>
  <nav class="strip" aria-label="<?= e($r['title']) ?>站點">
    <?php foreach ($r['stations'] as $s): if ($s['href'] === null) continue; ?>
      <a href="<?= e(u($s['href'])) ?>"<?= $s['key'] === $active ? ' aria-current="page"' : '' ?>><?= e($s['label']) ?></a>
    <?php endforeach; ?>
  </nav>
  <main class="main" id="main">
    <div class="main-tools"><?php language_switch(); ?></div>
<?php
}

/** 第 2 版：把政策資料卡放進頁面（policy.js 讀取）。 */
function policy_island(): string
{
    return json_island('policy-cards', Content::policy());
}

function shell_end(): void
{
    echo "  </main>\n</div>\n";
}

/**
 * @param string[] $scripts 頁面腳本（相對 assets/js/）
 */
function page_end(array $scripts = [], bool $opencc = false): void
{
    // i18n-v2-*.js 在 i18n.js 之前載入，向 window.TPI18nExtra 加入第 2 版新增內容的英文翻譯
    $all = array_merge(['engine.js'], $opencc ? ['opencc-hk.js'] : [], ['i18n-v2-grad.js', 'i18n-v2-startup.js', 'i18n-j1.js', 'i18n-v32.js', 'i18n.js', 'app.js', 'policy.js', 'journey.js', 'v32.js'], $scripts);
    foreach ($all as $s) {
        echo '<script src="' . e(asset_url('assets/js/' . $s)) . '" defer></script>' . "\n";
    }
    echo "</body>\n</html>\n";
}
