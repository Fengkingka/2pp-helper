<?php
declare(strict_types=1);

// HTTP integration tests use local fake credentials and never call an external provider.
if (PHP_SAPI !== 'cli') {
    if (getenv('TP_ADVISOR_ROUTING_PROVIDER') === '1') {
        $state = json_decode((string) file_get_contents((string) getenv('TP_ADVISOR_ROUTING_STATE')), true);
        $payload = json_decode((string) file_get_contents('php://input'), true);
        $authorization = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        file_put_contents((string) getenv('TP_ADVISOR_ROUTING_LOG'), json_encode([
            'authorization' => $authorization, 'model' => $payload['model'] ?? '',
        ]) . "\n", FILE_APPEND);
        $advisor = $authorization === 'Bearer advisor-routing-test';
        $rejected = $state[$advisor ? 'rejectAdvisor' : 'rejectTeam'] ?? false;
        header('Content-Type: application/json');
        if ($rejected) {
            http_response_code(401);
            echo '{"error":{"message":"Invalid fixture credential"}}';
            exit;
        }
        $roles = json_decode((string) file_get_contents(__DIR__ . '/../data/roles.json'), true)['roles'];
        $output = [
            'reply' => 'Compare the paths and build one small project.', 'intro' => 'Three paths to explore.',
            'paths' => array_map(fn ($r) => ['roleId' => $r['id'], 'why' => 'Relevant skills.', 'plan' => 'Build a project.'], array_slice($roles, 0, 3)),
            'suggestion' => 'Built a reporting dashboard.',
            'questions' => ['What action did you take?', 'What changed after your project?'],
            'followUp' => null, 'pass' => true, 'track' => 'unknown', 'reason' => 'More evidence needed.', 'evidence' => [],
            'vision' => 'Develop a useful data career by 2030.', 'goals' => [['text' => 'Develop skills.', 'policyIds' => []]],
            'milestones' => array_map(fn ($year) => ['year' => $year, 'goalIndex' => 0, 'text' => 'Complete a practical project.'], range(2026, 2030)),
        ];
        $content = $advisor && ($state['invalidAdvisorJson'] ?? false) ? 'invalid JSON' : json_encode($output);
        echo json_encode(['choices' => [['message' => ['content' => $content]]]]);
        exit;
    }
    if (getenv('TP_ADVISOR_ROUTING_APP') === '1') {
        require __DIR__ . '/../lib/Config.php';
        Config::load(__DIR__ . '/missing-routing-test-config.env');
        return;
    }
    http_response_code(404);
    exit;
}

require __DIR__ . '/../lib/Config.php';
require __DIR__ . '/../lib/LlmClient.php';
Config::load(__DIR__ . '/missing-routing-test-config.env');
define('SITE_ROOT', dirname(__DIR__));

$passed = 0;
$processes = [];
$stateFile = tempnam(sys_get_temp_dir(), 'tp-advisor-state-');
$logFile = tempnam(sys_get_temp_dir(), 'tp-advisor-log-');
putenv('TP_ADVISOR_ROUTING_STATE=' . $stateFile);
putenv('TP_ADVISOR_ROUTING_LOG=' . $logFile);

function routingCheck(bool $condition, string $label): void
{
    global $passed;
    if (!$condition) throw new RuntimeException($label);
    $passed++;
    echo "PASS {$label}\n";
}

function routingServer(bool $provider): string
{
    global $processes;
    $socket = stream_socket_server('tcp://127.0.0.1:0', $errno, $error);
    if ($socket === false) throw new RuntimeException('Unable to allocate a test port.');
    $address = stream_socket_get_name($socket, false);
    fclose($socket);
    putenv('TP_ADVISOR_ROUTING_PROVIDER=' . ($provider ? '1' : '0'));
    putenv('TP_ADVISOR_ROUTING_APP=' . ($provider ? '0' : '1'));
    $command = $provider ? [PHP_BINARY, '-S', $address, __FILE__]
        : [PHP_BINARY, '-d', 'auto_prepend_file=' . __FILE__, '-S', $address, '-t', SITE_ROOT];
    $process = proc_open($command, [['pipe', 'r'], ['pipe', 'w'], ['pipe', 'w']], $pipes, dirname(SITE_ROOT));
    if (!is_resource($process)) throw new RuntimeException('Unable to launch the test server.');
    fclose($pipes[0]);
    stream_set_blocking($pipes[1], false);
    stream_set_blocking($pipes[2], false);
    $processes[] = [$process, $pipes];
    $deadline = microtime(true) + 5;
    for ($attempt = 0; $attempt < 150 && microtime(true) < $deadline; $attempt++) {
        $connection = @stream_socket_client('tcp://' . $address, $errno, $error, 0.1);
        if ($connection !== false) {
            fclose($connection);
            return 'http://' . $address;
        }
        usleep(20000);
    }
    throw new RuntimeException('The test server did not start: ' . trim(stream_get_contents($pipes[2])));
}

function routingFixture(array $state = []): void
{
    global $stateFile, $logFile;
    file_put_contents($stateFile, json_encode($state));
    file_put_contents($logFile, '');
}

function routingCalls(): array
{
    global $logFile;
    return array_map(fn ($line) => json_decode($line, true), file($logFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: []);
}

function routingRequest(string $base, string $task): array
{
    $body = ['task' => $task, '_lang' => 'en', 'profile' => ['skills' => ['Python']],
        'pathId' => 'junior_data_analyst', 'bullet' => 'Built a reporting dashboard.',
        'history' => [['role' => 'user', 'text' => 'Which path should I explore?']]];
    $response = file_get_contents($base . '/api/llm.php', false, stream_context_create(['http' => [
        'method' => 'POST', 'header' => 'Content-Type: application/json', 'content' => json_encode($body),
        'ignore_errors' => true, 'timeout' => 10,
    ]]));
    if (!str_contains($http_response_header[0] ?? '', '200')) throw new RuntimeException('Unexpected HTTP status for ' . $task);
    return json_decode((string) $response, true, 512, JSON_THROW_ON_ERROR);
}

try {
    routingFixture();
    $provider = routingServer(true);
    foreach ([
        'LLM_MODE' => 'live', 'LLM_BASE_URL' => $provider, 'LLM_API_KEY' => 'team-routing-test',
        'LLM_MODEL_CHAT' => 'team-chat-test', 'LLM_MODEL_EVAL' => 'team-eval-test', 'LLM_JSON_MODE' => 'true',
        'LLM_TIMEOUT' => '5', 'LLM_CA_FILE' => '', 'RATE_LIMIT_CHAT_PER_HOUR' => '0', 'RATE_LIMIT_ADVISOR_PER_HOUR' => '0',
        'ADVISOR_LLM_MODE' => 'live', 'ADVISOR_LLM_BASE_URL' => $provider, 'ADVISOR_LLM_API_KEY' => 'advisor-routing-test',
        'ADVISOR_LLM_MODEL' => 'advisor-chat-test',
    ] as $name => $value) putenv($name . '=' . $value);
    $app = routingServer(false);

    foreach (['advisor_chat', 'advisor_paths'] as $task) {
        routingFixture();
        $result = routingRequest($app, $task);
        $calls = routingCalls();
        routingCheck($result['source'] === 'ai' && count($calls) === 1
            && $calls[0] === ['authorization' => 'Bearer advisor-routing-test', 'model' => 'advisor-chat-test'],
            $task . ' uses only the dedicated key and model when successful');
    }
    foreach (['cv_rewrite', 'interview_questions', 'interview_followup', 'interview_conversation', 'interview_assess_profile', 'check', 'plan_draft'] as $task) {
        routingFixture();
        $result = routingRequest($app, $task);
        $calls = routingCalls();
        routingCheck($result['source'] === 'ai' && count($calls) === 1
            && $calls[0] === ['authorization' => 'Bearer team-routing-test', 'model' => 'team-chat-test'],
            $task . ' retains the team key and model');
    }
    routingFixture();
    LlmClient::create('eval')->chat([['role' => 'user', 'content' => 'Fixture evaluation.']], true);
    routingCheck(routingCalls() === [['authorization' => 'Bearer team-routing-test', 'model' => 'team-eval-test']],
        'evaluation retains the team key and evaluation model');

    foreach (['advisor_chat', 'advisor_paths'] as $task) {
        routingFixture(['rejectAdvisor' => true]);
        $result = routingRequest($app, $task);
        routingCheck($result['source'] === 'ai'
            && array_column(routingCalls(), 'authorization') === ['Bearer advisor-routing-test', 'Bearer team-routing-test'],
            $task . ' retries the team key after primary authentication failure');
    }
    routingFixture(['rejectAdvisor' => true, 'rejectTeam' => true]);
    $result = routingRequest($app, 'advisor_chat');
    routingCheck($result['source'] === 'fallback'
        && array_column(routingCalls(), 'authorization') === ['Bearer advisor-routing-test', 'Bearer team-routing-test'],
        'rule reply is used only after both configured keys fail');
    routingFixture(['invalidAdvisorJson' => true]);
    $result = routingRequest($app, 'advisor_chat');
    routingCheck($result['source'] === 'ai'
        && array_column(routingCalls(), 'authorization') === ['Bearer advisor-routing-test', 'Bearer team-routing-test'],
        'unusable primary output also falls through to the team AI');
    routingFixture(['rejectTeam' => true]);
    $result = routingRequest($app, 'cv_rewrite');
    routingCheck($result['source'] === 'fallback'
        && array_column(routingCalls(), 'authorization') === ['Bearer team-routing-test'],
        'other modules never borrow the advisor key when their team key fails');

    putenv('ADVISOR_LLM_API_KEY');
    $missingKeyApp = routingServer(false);
    routingFixture();
    $result = routingRequest($missingKeyApp, 'advisor_chat');
    routingCheck($result['source'] === 'ai' && array_column(routingCalls(), 'authorization') === ['Bearer team-routing-test'],
        'a missing primary key skips directly to the team AI');
    putenv('ADVISOR_LLM_MODE=mock');
    $offlineApp = routingServer(false);
    routingFixture();
    $result = routingRequest($offlineApp, 'advisor_chat');
    routingCheck($result['source'] === 'fallback' && routingCalls() === [], 'explicit advisor demo mode calls neither key');

    echo "RESULT {$passed} passed\n";
} finally {
    foreach (array_reverse($processes) as [$process, $pipes]) {
        proc_terminate($process);
        fclose($pipes[1]);
        fclose($pipes[2]);
        proc_close($process);
    }
    unlink($stateFile);
    unlink($logFile);
}
