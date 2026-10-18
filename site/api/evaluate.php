<?php
declare(strict_types=1);

/**
 * POST /api/evaluate.php
 * body: { "log": SessionLog }
 * 回傳：EvaluationReport。未設定 AI 時使用示範評分（metrics.mock = 1）。
 */
require __DIR__ . '/../includes/bootstrap.php';

Http::requireMethod('POST');
$body = Http::body();

try {
    $log = Validator::sessionLog($body['log'] ?? null);
    $vcContext = $log['scenarioId'] === VcPanel::ID ? VcPanel::context($body['vcContext'] ?? null) : null;
    if ($vcContext !== null) $log = VcPanel::scoringLog($log, $vcContext);
    $interviewContext = InterviewScoring::context($body['interviewContext'] ?? null, $log);
    if ($interviewContext !== null) $log = InterviewScoring::scoringLog($log, $interviewContext);
} catch (InvalidArgumentException $e) {
    Http::error($e->getMessage(), 400);
}

try {
    $scenario = Content::scenario($log['scenarioId']);
    $rubric = Evaluator::applicableRubric(Content::rubric($interviewContext !== null ? InterviewScoring::rubricId($interviewContext) : $scenario['rubric']), $log);
} catch (InvalidArgumentException | DomainException $e) {
    Http::error($e->getMessage(), 404);
}

$mode = Config::evaluationMode($log['scenarioId']);
$lang = ($body['_lang'] ?? '') === 'en' ? 'en' : 'zh-HK';
if ($mode === 'live' && !RateLimit::hit('eval-' . Http::clientKey(), Config::int('RATE_LIMIT_EVAL_PER_HOUR', 30))) {
    Http::error('評分次數已達上限，請一小時後再試。', 429);
}

try {
    $llm = $mode === 'live' ? LlmClient::create('eval')->asCallable(true) : MockLlm::evaluation($rubric, $log, $lang);
    $report = Evaluator::evaluate($rubric, $log, $llm, 1, $lang, $vcContext ?? $interviewContext);
    if ($mode === 'mock') {
        $report['metrics'] = ($report['metrics'] ?? []) + ['mock' => 1];
    }
} catch (Throwable $e) {
    error_log('evaluate: ' . $e->getMessage());
    Http::error('暫時未能產生報告。請按「重新評分」再試一次。', 502);
}
Http::json($report);
