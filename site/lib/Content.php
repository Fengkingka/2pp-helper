<?php
declare(strict_types=1);

/**
 * 讀取 site/data 的 JSON。劇本和評分準則由 engine 的 `npm run build:site` 複製過來，
 * 請在 engine/scenarios、engine/rubrics 修改，不要直接改這裡的副本。
 */
final class Content
{
    private static array $cache = [];

    public static function scenario(string $id): array
    {
        return Validator::scenario(self::load('scenarios/' . self::safeId($id) . '.json', "找不到劇本：{$id}"));
    }

    public static function rubric(string $id): array
    {
        return Validator::rubric(self::load('rubrics/' . self::safeId($id) . '.json', "找不到評分準則：{$id}"));
    }

    public static function roles(): array
    {
        return self::load('roles.json', '找不到職位資料')['roles'] ?? [];
    }

    public static function opportunities(): array
    {
        return self::load('opportunities.json', '找不到機會清單')['items'] ?? [];
    }

    /** 第 2 版：政策資料卡（K 維護）。回傳 ['areas' => …, 'cards' => […]]。 */
    public static function policy(): array
    {
        return self::load('policy.json', '找不到政策資料卡');
    }

    /** @return array<string, array> 以 id 為鍵的政策資料卡 */
    public static function policyCards(): array
    {
        $out = [];
        foreach (self::policy()['cards'] ?? [] as $c) {
            $out[$c['id']] = $c;
        }
        return $out;
    }

    /** 第 2 版：問卷（engine 的 `npm run build:site` 複製過來）。 */
    public static function questionnaire(string $id): array
    {
        return self::load('questionnaires/' . self::safeId($id) . '.json', "找不到問卷：{$id}");
    }

    public static function tags(): array
    {
        return self::load('tags.json', '找不到標籤對照表');
    }

    private static function safeId(string $id): string
    {
        if (!preg_match('/^[a-z0-9_]{1,64}$/', $id)) {
            throw new InvalidArgumentException('名稱格式不正確。');
        }
        return $id;
    }

    private static function load(string $relative, string $notFound): array
    {
        if (isset(self::$cache[$relative])) {
            return self::$cache[$relative];
        }
        $path = SITE_ROOT . '/data/' . $relative;
        if (!is_file($path)) {
            throw new DomainException($notFound);
        }
        $data = json_decode((string) file_get_contents($path), true);
        if (!is_array($data)) {
            throw new DomainException("資料檔格式錯誤：{$relative}");
        }
        return self::$cache[$relative] = $data;
    }
}
