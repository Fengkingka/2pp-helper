<?php
declare(strict_types=1);

/**
 * 讀取設定：先讀環境變數，再讀 .env 檔。
 * .env 放在 site/ 的上一層（repo 根目錄），不會被網頁伺服器直接公開。
 */
final class Config
{
    private static array $values = [];
    private static bool $loaded = false;

    public static function load(?string $file = null): void
    {
        if (self::$loaded && $file === null) {
            return;
        }
        self::$values = [];
        $candidates = $file !== null ? [$file] : [dirname(SITE_ROOT) . '/.env', SITE_ROOT . '/.env'];
        foreach ($candidates as $path) {
            if (!is_readable($path)) {
                continue;
            }
            foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
                $line = trim($line);
                if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) {
                    continue;
                }
                [$k, $v] = array_map('trim', explode('=', $line, 2));
                self::$values[$k] = trim($v, "\"'");
            }
            break;
        }
        self::$loaded = true;
    }

    public static function get(string $key, ?string $default = null): ?string
    {
        $env = getenv($key);
        if ($env !== false && $env !== '') {
            return $env;
        }
        return self::$values[$key] ?? $default;
    }

    public static function int(string $key, int $default): int
    {
        $v = self::get($key);
        return is_numeric($v) ? (int) $v : $default;
    }

    public static function bool(string $key, bool $default = false): bool
    {
        $v = self::get($key);
        return $v === null ? $default : in_array(strtolower($v), ['1', 'true', 'yes', 'on'], true);
    }

    public static function evaluationMode(string $scenarioId): string
    {
        return self::llmMode();
    }

    /** live = 真的呼叫 AI；mock = 用示範邏輯（未設定 API key 時自動使用）。 */
    public static function llmMode(string $purpose = 'chat'): string
    {
        if ($purpose === 'advisor') {
            $mode = strtolower((string) self::get('ADVISOR_LLM_MODE', ''));
            if ($mode === 'mock' || $mode === 'live') {
                return $mode;
            }
            return ((self::get('ADVISOR_LLM_BASE_URL', self::get('LLM_BASE_URL'))
                && self::get('ADVISOR_LLM_API_KEY')) || self::llmMode() === 'live') ? 'live' : 'mock';
        }
        $mode = strtolower((string) self::get('LLM_MODE', ''));
        if ($mode === 'mock' || $mode === 'live') {
            return $mode;
        }
        return (self::get('LLM_BASE_URL') && self::get('LLM_API_KEY')) ? 'live' : 'mock';
    }
}
