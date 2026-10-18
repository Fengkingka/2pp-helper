<?php
declare(strict_types=1);
putenv('LLM_MODE=mock');
require __DIR__ . '/../includes/bootstrap.php';
$failed = 0;
function check(string $name, callable $fn): void {
    global $failed;
    try { $fn(); echo "PASS {$name}\n"; }
    catch (Throwable $e) { $failed++; echo "FAIL {$name}: {$e->getMessage()}\n"; }
}
function expect(bool $value): void { if (!$value) throw new RuntimeException('Unexpected result'); }
check('English follow-ups use answer, role and dialogue history', function () {
    $messages = [];
    $out = Tasks::run('interview_conversation', ['_lang' => 'en', 'question' => 'What did you do?', 'answer' => 'I built a dashboard.', 'role' => 'Analyst', 'history' => [['role' => 'user', 'text' => 'Reporting project']]], function ($input) use (&$messages) {
        $messages = $input;
        return '{"followUp":"How did your dashboard change the reporting process?"}';
    });
    expect($out['source'] === 'ai');
    expect(str_contains($messages[1]['content'], 'Reporting project'));
    expect(str_contains($messages[1]['content'], 'Analyst'));
    expect(str_contains($messages[1]['content'], 'dashboard'));
});
check('Chinese sessions request spoken Cantonese, not Mandarin', function () {
    $system = '';
    $out = Tasks::run('interview_conversation', ['_lang' => 'zh-HK', 'answer' => '我幫手整報表。'], function ($messages) use (&$system) {
        $system = $messages[0]['content'];
        return '{"followUp":"你整咗報表之後，團隊嘅工作有咩改善？"}';
    });
    expect($out['source'] === 'ai');
    expect(str_contains($system, '粵語'));
    expect(str_contains($out['followUp'], '咩'));
});
check('Complete answers can proceed without a follow-up', function () {
    $out = Tasks::run('interview_conversation', ['_lang' => 'en'], fn () => '{"followUp":null}');
    expect($out['source'] === 'ai' && $out['followUp'] === null);
});
check('Malformed or wrong-language AI output uses labelled fallback', function () {
    foreach (['{}', '{"followUp":42}', '{"followUp":"可唔可以再講清楚？"}'] as $reply) {
        $out = Tasks::run('interview_conversation', ['_lang' => 'en', 'answer' => 'Short'], fn () => $reply);
        expect($out['source'] === 'fallback');
        expect(is_string($out['followUp']) && !preg_match('/\p{Han}/u', $out['followUp']));
    }
});
check('Unavailable model has Cantonese and English fallback questions', function () {
    foreach (['en', 'zh-HK'] as $lang) {
        $out = Tasks::run('interview_conversation', ['_lang' => $lang, 'answer' => 'Short']);
        expect($out['source'] === 'fallback');
        expect(is_string($out['followUp']));
        expect((bool) preg_match('/\p{Han}/u', $out['followUp']) === ($lang === 'zh-HK'));
    }
});
exit($failed ? 1 : 0);
