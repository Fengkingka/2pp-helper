<?php
declare(strict_types=1);

/**
 * 簡單的每小時用量上限（檔案儲存，不需要資料庫），避免 API 費用失控。
 */
final class RateLimit
{
    public static function hit(string $key, int $max, int $windowSeconds = 3600): bool
    {
        if ($max <= 0) {
            return true;
        }
        $dir = sys_get_temp_dir() . '/tp-rate';
        if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
            return true; // 無法寫入時不阻擋用戶
        }
        $file = $dir . '/' . preg_replace('/[^a-z0-9]/i', '', $key) . '.json';
        $fh = @fopen($file, 'c+');
        if ($fh === false) {
            return true;
        }
        flock($fh, LOCK_EX);
        $now = time();
        $hits = json_decode(stream_get_contents($fh) ?: '[]', true) ?: [];
        $hits = array_values(array_filter($hits, fn ($t) => is_int($t) && $t > $now - $windowSeconds));
        $allowed = count($hits) < $max;
        if ($allowed) {
            $hits[] = $now;
        }
        ftruncate($fh, 0);
        rewind($fh);
        fwrite($fh, json_encode($hits));
        flock($fh, LOCK_UN);
        fclose($fh);
        return $allowed;
    }
}
