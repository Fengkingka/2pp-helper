<?php
declare(strict_types=1);

final class Http
{
    public const MAX_BODY = 262144; // 256 kB

    public static function json(mixed $data, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        header('X-Content-Type-Options: nosniff');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function error(string $message, int $status): never
    {
        self::json(['error' => $message], $status);
    }

    public static function requireMethod(string $method): void
    {
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== $method) {
            header('Allow: ' . $method);
            self::error('不支援這個請求方法。', 405);
        }
    }

    /** 讀取 JSON body；太大或格式錯誤會直接回傳 400。 */
    public static function body(): array
    {
        $raw = file_get_contents('php://input', false, null, 0, self::MAX_BODY + 1);
        if ($raw === false || strlen($raw) > self::MAX_BODY) {
            self::error('資料太大。', 413);
        }
        $data = json_decode($raw, true);
        if (!is_array($data)) {
            self::error('資料格式不正確。', 400);
        }
        return $data;
    }

    public static function clientKey(): string
    {
        return hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? 'cli') . '|tp');
    }
}
