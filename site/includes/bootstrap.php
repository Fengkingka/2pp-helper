<?php
declare(strict_types=1);

define('SITE_ROOT', dirname(__DIR__));

spl_autoload_register(static function (string $class): void {
    $file = SITE_ROOT . '/lib/' . basename(str_replace('\\', '/', $class)) . '.php';
    if (is_file($file)) {
        require $file;
    }
});

mb_internal_encoding('UTF-8');
Config::load();

/* 頁面在子資料夾時，連結要加上 ../ ；用 u() 產生相對路徑，部署到任何路徑都可以用。 */
$script = realpath((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) ?: '';
$root = realpath(SITE_ROOT) ?: SITE_ROOT;
$relative = str_starts_with($script, $root) ? ltrim(str_replace('\\', '/', substr($script, strlen($root))), '/') : '';
define('BASE', str_repeat('../', substr_count($relative, '/')));

function u(string $path = ''): string
{
    return BASE . ltrim($path, '/');
}

function e(mixed $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** 把資料放進 <script type="application/json">，給頁面的 JS 讀取（不會被執行，符合 CSP）。 */
function json_island(string $id, mixed $data): string
{
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP);
    return '<script type="application/json" id="' . e($id) . '">' . $json . '</script>';
}
