<?php
/**
 * 本機開發用：php -S localhost:8000 router.php
 * 阻擋 lib/、includes/、tests/ 和隱藏檔，其餘照常處理。
 */
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
if (preg_match('#(^|/)(lib|includes|tests)(/|$)|/\.#', $path) || basename($path) === 'router.php') {
    http_response_code(404);
    echo 'Not found';
    return true;
}
// PHP development server does not consistently infer the .mjs MIME type.
if (str_ends_with($path, '.mjs')) {
    $file = realpath(__DIR__ . $path);
    if ($file && str_starts_with($file, realpath(__DIR__ . '/assets') . DIRECTORY_SEPARATOR) && is_file($file)) {
        header('Content-Type: application/javascript');
        header('X-Content-Type-Options: nosniff');
        readfile($file);
        return true;
    }
    http_response_code(404);
    return true;
}
return false;
