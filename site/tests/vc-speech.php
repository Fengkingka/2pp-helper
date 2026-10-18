<?php
declare(strict_types=1);

require __DIR__ . '/../lib/Config.php';
Config::load(__DIR__ . '/missing-test-config.env');
if (getenv('TP_SPEECH_TEST_SERVER') === '1') {
    $_SERVER['REMOTE_ADDR'] = (string) getenv('TP_SPEECH_TEST_CLIENT');
    return;
}
spl_autoload_register(static function (string $class): void {
    $file = __DIR__ . '/../lib/' . $class . '.php';
    if (is_file($file)) {
        require $file;
    }
});
define('SITE_ROOT', dirname(__DIR__));

$passed = 0;
$failed = 0;
function speechTest(string $name, callable $test): void
{
    global $passed, $failed;
    try {
        $test();
        $passed++;
        echo "PASS {$name}\n";
    } catch (Throwable $error) {
        $failed++;
        echo "FAIL {$name}: {$error->getMessage()}\n";
    }
}
function speechAssert(bool $condition, string $message = 'Assertion failed'): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}
function speechThrows(callable $call, string $class): Throwable
{
    try {
        $call();
    } catch (Throwable $error) {
        speechAssert($error instanceof $class, 'Unexpected exception: ' . get_class($error));
        return $error;
    }
    throw new RuntimeException('Expected ' . $class);
}
function speechResponse(array $data, int $status = 200): array
{
    return ['status' => $status, 'body' => json_encode($data)];
}
function speechWav(): string
{
    return 'RIFF' . pack('V', 38) . 'WAVEfmt ' . pack('VvvVVvv', 16, 1, 1, 16000, 32000, 2, 16)
        . 'data' . pack('V', 2) . "\0\0";
}

foreach (['MINIMAX_API_KEY', 'MINIMAX_BASE_URL', 'MINIMAX_TTS_MODEL', 'MINIMAX_ASR_MODEL',
    'MINIMAX_VOICE_EN', 'MINIMAX_VOICE_YUE'] as $name) {
    putenv($name);
}

speechTest('Missing key selects browser and refuses provider calls', function () {
    speechAssert(SpeechClient::status() === ['provider' => 'browser', 'ready' => false]);
    speechThrows(fn () => SpeechClient::create(), LogicException::class);
});

putenv('MINIMAX_API_KEY=test-only-secret');
speechTest('Key alone selects MiniMax without disclosing the key', function () {
    $status = SpeechClient::status();
    speechAssert($status === ['provider' => 'minimax', 'ready' => true]);
    speechAssert(!str_contains(json_encode($status), 'test-only-secret'));
});

speechTest('English speech uses official defaults and decodes MP3 hex', function () {
    $client = SpeechClient::create(function (string $url, array $headers, array $payload, bool $multipart): array {
        speechAssert($url === 'https://api.minimax.io/v1/t2a_v2');
        speechAssert(in_array('Authorization: Bearer test-only-secret', $headers, true));
        speechAssert($multipart === false);
        speechAssert($payload['model'] === 'speech-2.8-turbo');
        speechAssert($payload['text'] === 'Hello');
        speechAssert($payload['language_boost'] === 'English');
        speechAssert($payload['voice_setting']['voice_id'] === 'English_expressive_narrator');
        speechAssert($payload['stream'] === false && $payload['output_format'] === 'hex');
        speechAssert($payload['audio_setting'] === ['sample_rate' => 32000, 'bitrate' => 128000, 'format' => 'mp3', 'channel' => 1]);
        return speechResponse(['data' => ['audio' => bin2hex('ID3audio'), 'status' => 2],
            'extra_info' => ['audio_format' => 'mp3'], 'trace_id' => 'fixture', 'base_resp' => ['status_code' => 0, 'status_msg' => '']]);
    });
    speechAssert($client->speak('Hello', 'en') === 'ID3audio');
});

speechTest('Cantonese speech selects the Yue voice and language boost', function () {
    $client = SpeechClient::create(function ($url, $headers, $payload): array {
        speechAssert($payload['language_boost'] === 'Chinese,Yue');
        speechAssert($payload['voice_setting']['voice_id'] === 'Cantonese_GentleLady');
        return speechResponse(['data' => ['audio' => '494433'], 'base_resp' => ['status_code' => 0]]);
    });
    speechAssert($client->speak('你好', 'zh-HK') === 'ID3');
});

speechTest('Invalid language and empty or long text fail before transport', function () {
    $client = SpeechClient::create(function (): never { throw new RuntimeException('Transport must not run'); });
    foreach (['zh', 'yue', 'EN', ''] as $language) {
        speechThrows(fn () => $client->speak('hello', $language), InvalidArgumentException::class);
    }
    foreach (['', '   ', str_repeat('字', 2001)] as $text) {
        speechThrows(fn () => $client->speak($text, 'en'), InvalidArgumentException::class);
    }
});

speechTest('VC speakers are whitelisted before transport and preserve the language default', function () {
    $client = SpeechClient::create(function ($url, $headers, $payload): array {
        speechAssert($payload['voice_setting']['voice_id'] === 'Cantonese_GentleLady');
        speechAssert($payload['language_boost'] === 'Chinese,Yue');
        return speechResponse(['data' => ['audio' => '494433'], 'base_resp' => ['status_code' => 0]]);
    });
    speechAssert($client->speak('你好', 'zh-HK', 'numbers') === 'ID3');
    foreach (['evil', '', 'NUMBERS'] as $speaker) speechThrows(fn () => $client->speak('hello', 'en', $speaker), InvalidArgumentException::class);
});
speechTest('Server VC role voice is resolved by role and language without exposing IDs', function () {
    putenv('MINIMAX_VC_VOICE_LEGAL_EN=test-role-voice');
    try {
        $client=SpeechClient::create(function ($url, $headers, $payload): array {
            speechAssert($payload['voice_setting']['voice_id'] === 'test-role-voice');
            return speechResponse(['data'=>['audio'=>'494433'],'base_resp'=>['status_code'=>0]]);
        });
        speechAssert($client->speak('hello','en','legal') === 'ID3');
        $status=SpeechClient::vcStatus();
        speechAssert($status['shared']['en']['legal'] === false && $status['shared']['zh-HK']['legal'] === true);
        speechAssert(!str_contains(json_encode($status),'test-role-voice'));
    } finally { putenv('MINIMAX_VC_VOICE_LEGAL_EN'); }
});

speechTest('Provider HTTP errors and failures never expose provider bodies', function () {
    foreach ([speechResponse(['error' => 'test-only-secret'], 401),
        speechResponse(['base_resp' => ['status_code' => 1004, 'status_msg' => 'test-only-secret']]),
        ['status' => 200, 'body' => 'test-only-secret']] as $response) {
        $client = SpeechClient::create(fn () => $response);
        $error = speechThrows(fn () => $client->speak('hello', 'en'), RuntimeException::class);
        speechAssert(!str_contains($error->getMessage(), 'test-only-secret'));
    }
});
speechTest('Effective duplicate VC voices including the fallback are labelled shared', function () {
    $keys=['MINIMAX_VC_VOICE_NUMBERS_EN','MINIMAX_VC_VOICE_VISION_EN','MINIMAX_VC_VOICE_LEGAL_EN'];
    try {
        foreach ($keys as $key) putenv($key.'=same-test-voice');
        $status=SpeechClient::vcStatus();
        speechAssert($status['shared']['en']===['numbers'=>true,'vision'=>true,'legal'=>true]);
        putenv('MINIMAX_VC_VOICE_LEGAL_EN=unique-test-voice');
        $status=SpeechClient::vcStatus();
        speechAssert($status['shared']['en']===['numbers'=>true,'vision'=>true,'legal'=>false]);
        putenv('MINIMAX_VC_VOICE_NUMBERS_EN=English_expressive_narrator');
        putenv('MINIMAX_VC_VOICE_VISION_EN');
        $status=SpeechClient::vcStatus();
        speechAssert($status['shared']['en']['numbers'] && $status['shared']['en']['vision']);
        speechAssert(!str_contains(json_encode($status),'same-test-voice') && !str_contains(json_encode($status),'unique-test-voice'));
    } finally { foreach ($keys as $key) putenv($key); }
});

speechTest('Speech rejects malformed, odd, empty or missing audio hex', function () {
    foreach (['not-hex', '123', '', null] as $audio) {
        $client = SpeechClient::create(fn () => speechResponse(['data' => ['audio' => $audio], 'base_resp' => ['status_code' => 0]]));
        speechThrows(fn () => $client->speak('hello', 'en'), RuntimeException::class);
    }
});

$wav = tempnam(sys_get_temp_dir(), 'tp-speech-test-');
file_put_contents($wav, speechWav());
try {
    speechTest('ASR uploads WAV multipart and uses explicit English or Cantonese', function () use ($wav) {
        foreach (['en' => 'en', 'zh-HK' => 'yue'] as $language => $headerLanguage) {
            $client = SpeechClient::create(function ($url, $headers, $payload, $multipart) use ($wav, $headerLanguage): array {
                speechAssert($url === 'https://api.minimax.io/v1/speech_to_text');
                speechAssert(in_array('language: ' . $headerLanguage, $headers, true));
                speechAssert(!in_array('Content-Type: application/json', $headers, true));
                speechAssert($multipart === true && $payload['model'] === 'asr-1.0');
                speechAssert($payload['response_format'] === 'json' && $payload['stream'] === 'false');
                speechAssert($payload['file'] instanceof CURLFile && $payload['file']->getFilename() === $wav);
                return speechResponse(['text' => '  I delivered the project.  ']);
            });
            speechAssert($client->transcribe($wav, $language) === 'I delivered the project.');
        }
    });
    speechTest('ASR rejects missing, non-string or blank transcript', function () use ($wav) {
        foreach ([[], ['text' => 42], ['text' => '   '], ['text' => 'secret', 'base_resp' => ['status_code' => 1004]]] as $response) {
            $client = SpeechClient::create(fn () => speechResponse($response));
            speechThrows(fn () => $client->transcribe($wav, 'en'), RuntimeException::class);
        }
    });
    speechTest('Upload validation accepts WAV and rejects size, MIME, errors and missing files', function () use ($wav) {
        $upload = ['tmp_name' => $wav, 'size' => filesize($wav), 'type' => 'audio/wav', 'error' => UPLOAD_ERR_OK];
        speechAssert(SpeechClient::validateUpload($upload) === $wav);
        foreach ([['size' => 5242881], ['type' => 'audio/mpeg'], ['error' => UPLOAD_ERR_PARTIAL],
            ['tmp_name' => $wav . '-missing'], ['size' => 0]] as $change) {
            speechThrows(fn () => SpeechClient::validateUpload(array_replace($upload, $change)), InvalidArgumentException::class);
        }
    });
    file_put_contents($wav, 'not a real WAV');
    speechTest('Upload rejects fake WAV header before invoking provider', function () use ($wav) {
        $client = SpeechClient::create(function (): never { throw new RuntimeException('Transport must not run'); });
        speechThrows(fn () => $client->transcribe($wav, 'en'), InvalidArgumentException::class);
    });
    $handle = fopen($wav, 'r+');
    ftruncate($handle, SpeechClient::MAX_UPLOAD + 1);
    fclose($handle);
    speechTest('Upload checks actual file size despite forged small upload metadata', function () use ($wav) {
        speechThrows(fn () => SpeechClient::validateUpload(['tmp_name' => $wav, 'size' => 44,
            'type' => 'audio/wav', 'error' => UPLOAD_ERR_OK]), InvalidArgumentException::class);
    });
} finally {
    unlink($wav);
    putenv('MINIMAX_API_KEY');
}

function speechHttp(string $base, string $method = 'GET', ?array $body = null, ?string $multipart = null, ?string $contentType = null): array
{
    $options = ['method' => $method, 'ignore_errors' => true, 'timeout' => 5];
    if ($body !== null) {
        $options['header'] = 'Content-Type: application/json';
        $options['content'] = json_encode($body);
    }
    if ($multipart !== null) {
        $options['header'] = 'Content-Type: multipart/form-data; boundary=speech-fixture';
        $options['content'] = $multipart;
    }
    if ($contentType !== null) {
        $options['header'] = 'Content-Type: ' . $contentType;
    }
    $response = file_get_contents($base . '/api/speech.php', false, stream_context_create(['http' => $options]));
    preg_match('/HTTP\/\S+ (\d+)/', $http_response_header[0] ?? '', $match);
    return ['status' => (int) ($match[1] ?? 0), 'body' => $response];
}

function speechServer(): array
{
    putenv('TP_SPEECH_TEST_CLIENT=' . bin2hex(random_bytes(12)));
    $listener = stream_socket_server('tcp://127.0.0.1:0', $errno, $error);
    $address = stream_socket_get_name($listener, false);
    fclose($listener);
    $server = proc_open([PHP_BINARY, '-d', 'auto_prepend_file=' . __FILE__, '-S', $address, '-t', SITE_ROOT],
        [['pipe', 'r'], ['pipe', 'w'], ['pipe', 'w']], $pipes, dirname(SITE_ROOT));
    speechAssert(is_resource($server), 'Unable to start test server');
    fclose($pipes[0]);
    stream_set_blocking($pipes[1], false);
    stream_set_blocking($pipes[2], false);
    for ($attempt = 0; $attempt < 50; $attempt++) {
        $connection = @stream_socket_client('tcp://' . $address, $errno, $error, 0.1);
        if ($connection !== false) {
            fclose($connection);
            return [$server, $pipes, 'http://' . $address];
        }
        usleep(20000);
    }
    proc_terminate($server);
    fclose($pipes[1]);
    fclose($pipes[2]);
    proc_close($server);
    throw new RuntimeException('Test server did not start');
}

function speechStopServer($server, array $pipes): void
{
    proc_terminate($server);
    fclose($pipes[1]);
    fclose($pipes[2]);
    proc_close($server);
    $clientKey = hash('sha256', getenv('TP_SPEECH_TEST_CLIENT') . '|tp');
    $rateFile = sys_get_temp_dir() . '/tp-rate/speech' . $clientKey . '.json';
    if (is_file($rateFile)) {
        unlink($rateFile);
    }
}

// Exercise the real HTTP entrypoint without loading local credentials or calling MiniMax.
putenv('TP_SPEECH_TEST_SERVER=1');
putenv('MINIMAX_BASE_URL=http://127.0.0.1:1');
putenv('RATE_LIMIT_SPEECH_PER_HOUR=1');
[$server, $pipes, $base] = speechServer();
try {
    speechTest('HTTP GET reveals only browser provider readiness', function () use ($base) {
        $response = speechHttp($base);
        speechAssert($response['status'] === 200, 'Expected HTTP 200, got ' . $response['status']);
        speechAssert(json_decode($response['body'], true) === ['provider' => 'browser', 'ready' => false]);
    });
    speechTest('HTTP validates methods, actions, language and text', function () use ($base) {
        speechAssert(speechHttp($base, 'DELETE')['status'] === 405);
        foreach ([['action' => 'delete'], ['action' => 'speak', 'language' => 'zh', 'text' => 'Hello'],
            ['action' => 'speak', 'language' => 'en', 'text' => str_repeat('a', 2001)],
            ['action' => 'speak', 'language' => 'en', 'text' => []]] as $body) {
            speechAssert(speechHttp($base, 'POST', $body)['status'] === 400);
        }
    });
    speechTest('HTTP missing key returns 503 without upstream', function () use ($base) {
        speechAssert(speechHttp($base, 'POST', ['action' => 'speak', 'language' => 'en', 'text' => 'Hello'])['status'] === 503);
    });
    speechTest('HTTP invalid VC speaker fails before missing key and provider creation', function () use ($base) {
        speechAssert(speechHttp($base, 'POST', ['action'=>'speak','language'=>'en','text'=>'Hello','speaker'=>'evil'])['status'] === 400);
    });
    speechTest('HTTP rejects unsupported or missing Content-Type before provider selection', function () use ($base) {
        foreach (['text/plain', '', 'application/json-extra', 'multipart/form-data-extra'] as $contentType) {
            $response = speechHttp($base, 'POST', ['action' => 'speak', 'language' => 'en', 'text' => 'Hello'], null, $contentType);
            speechAssert($response['status'] === 415, 'Expected HTTP 415 for ' . var_export($contentType, true) . ', got ' . $response['status']);
        }
    });
    speechTest('HTTP accepts JSON media type with case variation and charset parameter', function () use ($base) {
        $response = speechHttp($base, 'POST', ['action' => 'speak', 'language' => 'en', 'text' => 'Hello'], null, 'Application/JSON; charset=utf-8');
        speechAssert($response['status'] === 503);
    });
    speechTest('HTTP multipart checks real uploaded WAV and rejects fake headers', function () use ($base) {
        $prefix = "--speech-fixture\r\nContent-Disposition: form-data; name=\"action\"\r\n\r\ntranscribe\r\n"
            . "--speech-fixture\r\nContent-Disposition: form-data; name=\"language\"\r\n\r\nen\r\n"
            . "--speech-fixture\r\nContent-Disposition: form-data; name=\"file\"; filename=\"answer.wav\"\r\nContent-Type: audio/wav\r\n\r\n";
        $suffix = "\r\n--speech-fixture--\r\n";
        speechAssert(speechHttp($base, 'POST', null, $prefix . speechWav() . $suffix)['status'] === 503);
        speechAssert(speechHttp($base, 'POST', null, $prefix . 'fake WAV' . $suffix)['status'] === 400);
    });
} finally {
    speechStopServer($server, $pipes);
}
putenv('MINIMAX_API_KEY=test-only-secret');
[$server, $pipes, $base] = speechServer();
try {
    speechTest('HTTP configured provider status contains no credentials', function () use ($base) {
        $response = speechHttp($base);
        speechAssert($response['status'] === 200);
        speechAssert(json_decode($response['body'], true) === ['provider' => 'minimax', 'ready' => true]);
        speechAssert(!str_contains($response['body'], 'test-only-secret'));
    });
    speechTest('HTTP invalid Content-Type never spends configured provider rate limit', function () use ($base) {
        foreach (['text/plain', '', 'application/json-extra', 'multipart/form-data-extra'] as $contentType) {
            speechAssert(speechHttp($base, 'POST', ['action' => 'speak', 'language' => 'en', 'text' => 'Hello'], null, $contentType)['status'] === 415);
        }
    });
    speechTest('HTTP sanitizes connection failure and enforces rate limit', function () use ($base) {
        $body = ['action' => 'speak', 'language' => 'en', 'text' => 'Hello'];
        $response = speechHttp($base, 'POST', $body);
        speechAssert($response['status'] === 502, 'Expected HTTP 502, got ' . $response['status']);
        speechAssert(is_array(json_decode($response['body'], true)), 'Error must be clean JSON');
        speechAssert(!str_contains($response['body'], 'test-only-secret'));
        speechAssert(speechHttp($base, 'POST', $body)['status'] === 429);
    });
} finally {
    speechStopServer($server, $pipes);
    putenv('MINIMAX_API_KEY');
    putenv('TP_SPEECH_TEST_SERVER');
    putenv('TP_SPEECH_TEST_CLIENT');
    putenv('MINIMAX_BASE_URL');
    putenv('RATE_LIMIT_SPEECH_PER_HOUR');
}

echo "\n{$passed} passed, {$failed} failed\n";
exit($failed === 0 ? 0 : 1);
