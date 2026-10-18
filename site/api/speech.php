<?php
declare(strict_types=1);

require __DIR__ . '/../includes/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'GET') {
    Http::json(($_GET['vc'] ?? '') === '1' ? SpeechClient::vcStatus() : SpeechClient::status());
}
if ($method !== 'POST') {
    header('Allow: GET, POST');
    Http::error('不支援這個請求方法。', 405);
}
if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > SpeechClient::MAX_UPLOAD + 65536) {
    Http::error('錄音資料太大。', 413);
}

$contentType = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '', 2)[0]));
if (!in_array($contentType, ['application/json', 'multipart/form-data'], true)) {
    Http::error('語音請求必須使用 JSON 或 multipart/form-data。', 415);
}
$multipart = $contentType === 'multipart/form-data';
$body = $multipart ? $_POST : Http::body();
$action = $body['action'] ?? null;
if ((!$multipart && $action !== 'speak') || ($multipart && $action !== 'transcribe')) {
    Http::error('不支援這個語音操作或資料格式。', 400);
}

try {
    $speaker = SpeechClient::validateSpeaker($body['speaker'] ?? null);
    $language = SpeechClient::validateLanguage($body['language'] ?? null);
    if ($action === 'speak') {
        $text = SpeechClient::validateText($body['text'] ?? null);
    } else {
        $upload = $_FILES['file'] ?? [];
        if (!is_array($upload)) {
            throw new InvalidArgumentException('請上傳 WAV 錄音。');
        }
        $path = SpeechClient::validateUpload($upload);
        if (!is_uploaded_file($path)) {
            throw new InvalidArgumentException('請上傳 WAV 錄音。');
        }
    }
    $client = SpeechClient::create();
    if (!RateLimit::hit('speech-' . Http::clientKey(), Config::int('RATE_LIMIT_SPEECH_PER_HOUR', 120))) {
        Http::error('語音使用次數已達上限，請一小時後再試。', 429);
    }
    if ($action === 'transcribe') {
        Http::json(['text' => $client->transcribe($path, $language)]);
    }
    $audio = $client->speak($text, $language, $speaker);
    header('Content-Type: audio/mpeg');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo $audio;
} catch (InvalidArgumentException $error) {
    Http::error($error->getMessage(), 400);
} catch (LogicException $error) {
    Http::error('尚未設定 MiniMax 語音服務。', 503);
} catch (Throwable $error) {
    Http::error('語音服務暫時未能處理，請稍後再試。', 502);
}
