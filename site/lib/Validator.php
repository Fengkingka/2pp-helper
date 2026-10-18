<?php
declare(strict_types=1);

/**
 * 伺服器端的資料檢查，對應 engine/lib/types.ts 的 zod 定義。
 * 瀏覽器送來的資料一律當作不可信：檢查格式、限制長度，才交給評分器。
 */
final class Validator
{
    public const MAX_TEXT = 6000;
    private const ID = '/^[a-z0-9_]{1,64}$/';
    private const STEP_TYPES = ['event', 'proposal', 'email', 'question'];

    public static function sessionLog(mixed $log): array
    {
        if (!is_array($log)) {
            self::fail('練習紀錄格式不正確。');
        }
        $id = $log['scenarioId'] ?? null;
        if (!is_string($id) || !preg_match(self::ID, $id)) {
            self::fail('練習紀錄缺少劇本名稱。');
        }
        $kind = $log['kind'] ?? null;
        if (!in_array($kind, ['exercise', 'voice'], true)) {
            self::fail('練習紀錄的類型不正確。');
        }

        $steps = [];
        foreach (self::list($log['steps'] ?? [], 50, '步驟') as $s) {
            if (!is_array($s) || !is_string($s['stepId'] ?? null) || strlen($s['stepId']) > 64) {
                self::fail('步驟格式不正確。');
            }
            $inputs = [];
            foreach (self::assoc($s['inputs'] ?? [], 40, '輸入') as $k => $v) {
                if (is_string($v)) {
                    $inputs[$k] = self::text($v);
                } elseif (is_bool($v) || self::isNumber($v)) {
                    $inputs[$k] = $v;
                } else {
                    self::fail('輸入內容格式不正確。');
                }
            }
            $step = ['stepId' => $s['stepId'], 'inputs' => $inputs];
            if (isset($s['text'])) {
                if (!is_string($s['text'])) {
                    self::fail('步驟文字格式不正確。');
                }
                $step['text'] = self::text($s['text']);
            }
            if (isset($s['calc'])) {
                $step['calc'] = self::numbers($s['calc'], '計算結果');
            }
            $steps[] = $step;
        }

        $turns = [];
        foreach (self::list($log['turns'] ?? [], 400, '對話') as $t) {
            if (!is_array($t) || !is_string($t['speaker'] ?? null) || !is_string($t['text'] ?? null)
                || !self::isNumber($t['start'] ?? null) || !self::isNumber($t['end'] ?? null)) {
                self::fail('對話紀錄格式不正確。');
            }
            $turns[] = [
                'speaker' => mb_substr($t['speaker'], 0, 32),
                'text' => self::text($t['text']),
                'start' => (float) $t['start'],
                'end' => (float) $t['end'],
            ];
        }

        $out = ['scenarioId' => $id, 'kind' => $kind, 'steps' => $steps, 'turns' => $turns];
        if (isset($log['outcome'])) {
            if (!is_string($log['outcome'])) {
                self::fail('結果格式不正確。');
            }
            $out['outcome'] = mb_substr($log['outcome'], 0, 64);
        }
        if (isset($log['finalCalc'])) {
            $out['finalCalc'] = self::numbers($log['finalCalc'], '最終結果');
        }
        if ($steps === [] && $turns === []) {
            self::fail('練習紀錄是空的。');
        }
        return $out;
    }

    public static function scenario(array $s): array
    {
        foreach (['id', 'title', 'mode', 'calculator', 'rubric'] as $k) {
            if (!is_string($s[$k] ?? null) || $s[$k] === '') {
                self::fail("劇本缺少欄位：{$k}", DomainException::class);
            }
        }
        if (!is_array($s['steps'] ?? null) || $s['steps'] === []) {
            self::fail('劇本沒有任何步驟。', DomainException::class);
        }
        foreach ($s['steps'] as $step) {
            if (!in_array($step['type'] ?? null, self::STEP_TYPES, true) || !is_string($step['id'] ?? null)) {
                self::fail('劇本步驟格式不正確。', DomainException::class);
            }
        }
        return $s;
    }

    public static function rubric(array $r): array
    {
        if (!is_string($r['id'] ?? null) || !is_array($r['dimensions'] ?? null) || $r['dimensions'] === []) {
            self::fail('評分準則格式不正確。', DomainException::class);
        }
        foreach ($r['dimensions'] as $d) {
            if (!is_string($d['key'] ?? null) || !is_string($d['label'] ?? null)) {
                self::fail('評分準則的維度格式不正確。', DomainException::class);
            }
            foreach (['1', '2', '3', '4', '5'] as $lvl) {
                if (!is_string($d['levels'][$lvl] ?? null)) {
                    self::fail("評分準則「{$d['label']}」缺少第 {$lvl} 級描述。", DomainException::class);
                }
            }
        }
        $r['wantsRewrite'] = (bool) ($r['wantsRewrite'] ?? false);
        return $r;
    }

    public static function report(array $r): array
    {
        if (!is_string($r['scenarioId'] ?? null) || !is_string($r['summary'] ?? null) || !is_array($r['dimensions'] ?? null)) {
            self::fail('評估報告格式不正確。', DomainException::class);
        }
        foreach ($r['dimensions'] as $d) {
            $score = $d['score'] ?? null;
            if (!is_int($score) || $score < 1 || $score > 5
                || !is_string($d['key'] ?? null) || !is_string($d['label'] ?? null)
                || !is_string($d['evidence'] ?? null) || !is_string($d['suggestion'] ?? null)) {
                self::fail('評估報告的維度格式不正確。', DomainException::class);
            }
        }
        if (isset($r['metrics'])) {
            $r['metrics'] = self::numbers($r['metrics'], '指標');
        }
        return $r;
    }

    public static function isNumber(mixed $v): bool
    {
        return (is_int($v) || is_float($v)) && is_finite((float) $v);
    }

    private static function numbers(mixed $v, string $what): array
    {
        $out = [];
        foreach (self::assoc($v, 40, $what) as $k => $n) {
            if (!self::isNumber($n)) {
                self::fail("{$what}只可以是數字。");
            }
            $out[$k] = $n;
        }
        return $out;
    }

    private static function list(mixed $v, int $max, string $what): array
    {
        if (!is_array($v) || !array_is_list($v)) {
            self::fail("{$what}格式不正確。");
        }
        if (count($v) > $max) {
            self::fail("{$what}數量太多。");
        }
        return $v;
    }

    private static function assoc(mixed $v, int $max, string $what): array
    {
        if ($v === [] || $v === null) {
            return [];
        }
        if (!is_array($v) || array_is_list($v)) {
            self::fail("{$what}格式不正確。");
        }
        if (count($v) > $max) {
            self::fail("{$what}項目太多。");
        }
        foreach (array_keys($v) as $k) {
            if (!is_string($k) || mb_strlen($k) > 64) {
                self::fail("{$what}的名稱格式不正確。");
            }
        }
        return $v;
    }

    private static function text(string $s): string
    {
        return mb_substr($s, 0, self::MAX_TEXT);
    }

    private static function fail(string $message, string $class = InvalidArgumentException::class): never
    {
        throw new $class($message);
    }
}
