<?php
declare(strict_types=1);
require __DIR__ . '/../includes/bootstrap.php';
Http::requireMethod('POST');
if (function_exists('set_time_limit')) @set_time_limit(120);
if (!str_starts_with(strtolower($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json')) Http::error('Use application/json.', 415);
$body = Http::body();
$language = ($body['_lang'] ?? '') === 'en' ? 'en' : 'zh-HK';
$action = $body['action'] ?? 'analyze';
if (!in_array($action, ['extract','analyze'], true)) Http::error('Unknown action / 未知操作。', 400);
try {
    // Validate before consuming paid-provider quota.
    if ($action === 'analyze') {
        $p = FitCheck::proposal($body['proposal'] ?? null);
        $manual = FitCheck::evidence($body['evidence'] ?? []);
    } elseif (mb_strlen(FitCheck::text($body['text'] ?? '', 20000)) < 30) {
        throw new InvalidArgumentException('Add at least 30 characters / 請提供至少 30 個字元。');
    }
    if (!RateLimit::hit('fitcheck-' . Http::clientKey(), Config::int('RATE_LIMIT_FITCHECK_PER_HOUR', 20))) Http::error('Hourly limit reached. Try later / 已達每小時上限，請稍後再試。', 429);
    $llm = null; $aiStatus = 'not_configured';
    if (Config::llmMode() === 'live') {
        try { $llm = LlmClient::create('chat')->asCallable(true); }
        catch (Throwable $e) { $aiStatus = 'configuration_error'; }
    }
    if ($action === 'extract') {
        if (!$llm) Http::error('AI extraction is unavailable. Complete the guided form below / AI 擷取未連接，請使用下方表格。', 503);
        try { Http::json(['proposal'=>FitCheck::extract(FitCheck::text($body['text'] ?? '', 20000), $language, $llm)]); }
        catch (Throwable $e) { Http::error('AI could not extract this proposal. Your text is retained; use the guided form / AI 未能擷取提案。文字已保留，請使用表格。', 502); }
    }
    $collected = FitCheckSources::collect($p, ($body['fetchSources'] ?? false) === true);
    Http::json(FitCheck::analyze($p, array_merge($manual, $collected['evidence']), $collected['sources'], $language, $llm, $aiStatus));
} catch (InvalidArgumentException $e) { Http::error($e->getMessage(), 400); }
catch (Throwable $e) { Http::error('FitCheck is temporarily unavailable. Your draft is retained / FitCheck 暫時未能處理，草稿已保留。', 502); }
