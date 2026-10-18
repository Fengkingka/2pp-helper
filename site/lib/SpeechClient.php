<?php
declare(strict_types=1);

/** Optional MiniMax speech; credentials stay on the server. */
final class SpeechClient
{
    public const MAX_UPLOAD = 5242880;

    private function __construct(private string $apiKey, private ?Closure $transport)
    {
    }

    public static function status(): array
    {
        $ready = trim((string) Config::get('MINIMAX_API_KEY', '')) !== '';
        return ['provider' => $ready ? 'minimax' : 'browser', 'ready' => $ready];
    }

    public static function create(?callable $transport = null): self
    {
        $key = trim((string) Config::get('MINIMAX_API_KEY', ''));
        if ($key === '') {
            throw new LogicException('尚未設定 MiniMax 語音服務。');
        }
        return new self($key, $transport === null ? null : Closure::fromCallable($transport));
    }

    public static function validateSpeaker(mixed $speaker): ?string
    {
        if ($speaker === null) return null;
        if (!in_array($speaker, ['numbers', 'vision', 'legal'], true)) throw new InvalidArgumentException('Invalid VC speaker.');
        return $speaker;
    }

    public static function vcStatus(): array
    {
        $shared = [];
        foreach (['en'=>'EN', 'zh-HK'=>'YUE'] as $language=>$suffix) {
            $voices = [];
            foreach (['numbers', 'vision', 'legal'] as $role) $voices[$role] = self::resolveVoice($language, $role);
            $counts = array_count_values($voices);
            foreach ($voices as $role=>$voice) $shared[$language][$role] = $counts[$voice] > 1 || trim((string) Config::get('MINIMAX_VC_VOICE_' . strtoupper($role) . '_' . $suffix, '')) === '';
        }
        return self::status() + ['shared'=>$shared];
    }

    private static function resolveVoice(string $language, ?string $speaker): string
    {
        $voice = $speaker === null ? '' : trim((string) Config::get('MINIMAX_VC_VOICE_' . strtoupper($speaker) . '_' . ($language === 'en' ? 'EN' : 'YUE'), ''));
        return $voice !== '' ? $voice : ($language === 'en'
            ? (Config::get('MINIMAX_VOICE_EN') ?: 'English_expressive_narrator')
            : (Config::get('MINIMAX_VOICE_YUE') ?: 'Cantonese_GentleLady'));
    }

    public static function validateLanguage(mixed $language): string
    {
        if (!in_array($language, ['en', 'zh-HK'], true)) {
            throw new InvalidArgumentException('語音語言必須是 en 或 zh-HK。');
        }
        return $language;
    }

    public static function validateText(mixed $text): string
    {
        if (!is_string($text) || !mb_check_encoding($text, 'UTF-8') || trim($text) === '' || mb_strlen($text) > 2000) {
            throw new InvalidArgumentException('語音文字必須是 1 至 2000 字。');
        }
        return trim($text);
    }

    public static function validateUpload(array $upload): string
    {
        $path = $upload['tmp_name'] ?? null;
        $size = $upload['size'] ?? null;
        $mime = $upload['type'] ?? null;
        if (($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK
            || !is_string($path) || !is_file($path) || !is_readable($path)
            || !is_int($size) || $size <= 0 || $size > self::MAX_UPLOAD
            || !in_array($mime, ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave'], true)) {
            throw new InvalidArgumentException('請上傳不超過 5 MB 的 WAV 錄音。');
        }
        self::validateWav($path);
        return $path;
    }

    private static function validateWav(string $path): void
    {
        $size = is_file($path) && is_readable($path) ? filesize($path) : false;
        if ($size === false || $size < 12 || $size > self::MAX_UPLOAD) {
            throw new InvalidArgumentException('請上傳不超過 5 MB 的 WAV 錄音。');
        }
        $header = file_get_contents($path, false, null, 0, 12);
        if ($header === false || substr($header, 0, 4) !== 'RIFF' || substr($header, 8, 4) !== 'WAVE') {
            throw new InvalidArgumentException('錄音格式必須是 WAV。');
        }
    }

    public function speak(string $text, string $language, ?string $speaker = null): string
    {
        $speaker = self::validateSpeaker($speaker);
        $language = self::validateLanguage($language);
        $text = self::validateText($text);
        $voice = self::resolveVoice($language, $speaker);
        $data = $this->request('/v1/t2a_v2', [
            'model' => Config::get('MINIMAX_TTS_MODEL') ?: 'speech-2.8-turbo',
            'text' => $text,
            'stream' => false,
            'output_format' => 'hex',
            'language_boost' => $language === 'en' ? 'English' : 'Chinese,Yue',
            'voice_setting' => ['voice_id' => $voice],
            'audio_setting' => ['sample_rate' => 32000, 'bitrate' => 128000, 'format' => 'mp3', 'channel' => 1],
        ]);
        $audio = $data['data']['audio'] ?? null;
        if (($data['base_resp']['status_code'] ?? null) !== 0 || !is_string($audio)
            || $audio === '' || strlen($audio) % 2 !== 0 || !ctype_xdigit($audio)) {
            throw new RuntimeException('語音服務回應格式不正確。');
        }
        return hex2bin($audio);
    }

    public function transcribe(string $path, string $language): string
    {
        $language = self::validateLanguage($language);
        self::validateWav($path);
        $data = $this->request('/v1/speech_to_text', [
            'model' => Config::get('MINIMAX_ASR_MODEL') ?: 'asr-1.0',
            'file' => new CURLFile($path, 'audio/wav', 'answer.wav'),
            'response_format' => 'json',
            'stream' => 'false',
        ], true, ['language: ' . ($language === 'en' ? 'en' : 'yue')]);
        $text = $data['text'] ?? null;
        if (!is_string($text) || trim($text) === '') {
            throw new RuntimeException('未能辨識錄音中的說話，請重新錄音。');
        }
        return trim($text);
    }

    private function request(string $endpoint, array $payload, bool $multipart = false, array $extraHeaders = []): array
    {
        $url = rtrim(Config::get('MINIMAX_BASE_URL') ?: 'https://api.minimax.io', '/') . $endpoint;
        $headers = array_merge(['Authorization: Bearer ' . $this->apiKey], $extraHeaders);
        if (!$multipart) {
            $headers[] = 'Content-Type: application/json';
        }
        try {
            $response = $this->transport !== null
                ? ($this->transport)($url, $headers, $payload, $multipart)
                : $this->send($url, $headers, $payload, $multipart);
        } catch (Throwable $error) {
            // Never surface transport details or provider bodies containing credentials.
            throw new RuntimeException('暫時未能連接語音服務，請稍後再試。');
        }
        if (($response['status'] ?? 0) < 200 || ($response['status'] ?? 0) >= 300) {
            throw new RuntimeException('語音服務暫時未能處理，請稍後再試。');
        }
        $data = json_decode((string) ($response['body'] ?? ''), true);
        if (!is_array($data) || (isset($data['base_resp']) && ($data['base_resp']['status_code'] ?? null) !== 0)) {
            throw new RuntimeException('語音服務回應格式不正確。');
        }
        return $data;
    }

    private function send(string $url, array $headers, array $payload, bool $multipart): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 45,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_POSTFIELDS => $multipart ? $payload : json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
        ]);
        $caFile = Config::get('LLM_CA_FILE');
        if ($caFile) {
            $caPath = realpath(dirname(SITE_ROOT) . '/' . $caFile) ?: $caFile;
            curl_setopt($ch, CURLOPT_CAINFO, $caPath);
        }
        $body = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        unset($ch);
        if ($body === false) {
            throw new RuntimeException('Speech connection failed.');
        }
        return ['status' => $status, 'body' => $body];
    }
}
