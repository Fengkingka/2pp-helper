<?php
declare(strict_types=1);

/**
 * POST /api/llm.php
 * body: { "task": "advisor_paths" | "advisor_chat" | "cv_rewrite" | "interview_questions" | "interview_followup" | "check", ... }
 * 每個任務都有後備做法，未連接 AI 時網站仍然可以運作。
 */
require __DIR__ . '/../includes/bootstrap.php';

Http::requireMethod('POST');
$body = Http::body();
$task = is_string($body['task'] ?? null) ? $body['task'] : '';
if (!in_array($task, Tasks::NAMES, true)) {
    Http::error('不支援這個任務。', 400);
}

$purpose = LlmClient::purposeForTask($task);
if (Config::llmMode($purpose) === 'live') {
    $limit = $purpose === 'advisor' ? 'RATE_LIMIT_ADVISOR_PER_HOUR' : 'RATE_LIMIT_CHAT_PER_HOUR';
    if (!RateLimit::hit($purpose . '-' . Http::clientKey(), Config::int($limit, 120))) {
        Http::error('使用次數已達上限，請一小時後再試。', 429);
    }
}

try {
    Http::json(Tasks::runConfigured($task, $body));
} catch (InvalidArgumentException | DomainException $e) {
    Http::error($e->getMessage(), 400);
} catch (Throwable $e) {
    error_log('llm task: ' . $e->getMessage());
    Http::error('暫時未能處理，請稍後再試。', 502);
}
