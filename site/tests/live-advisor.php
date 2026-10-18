<?php
declare(strict_types=1);
// Optional, billable smoke check using a fictional profile. Run from CLI only.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/../includes/bootstrap.php';
try {
    $result = Tasks::runConfigured('advisor_chat', [
        '_lang' => 'en',
        'profile' => ['education' => [['major' => 'Computer Science', 'degreeLevel' => 'bachelor', 'gradYear' => 2026]], 'skills' => ['Python', 'Excel']],
        'paths' => ['Junior Data Analyst', 'AI Product Operations Associate'],
        'history' => [['role' => 'user', 'text' => 'I prefer business-facing AI product work. Give me one practical action to try this week.']],
    ]);
    if ($result['source'] !== 'ai') { fwrite(STDERR, "FAIL: the provider did not produce a valid live response.\n"); exit(1); }
    echo "PASS: DeepSeek returned a live career-advisor reply.\n";
    echo $result['reply'] . "\n";
} catch (Throwable $e) {
    fwrite(STDERR, "FAIL: " . $e->getMessage() . "\n");
    exit(1);
}
