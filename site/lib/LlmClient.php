<?php
declare(strict_types=1);

/**
 * 呼叫 OpenAI 相容的 /chat/completions（很多供應商都支援）。
 * 換供應商只需改 .env，不用改程式碼。API key 只存在伺服器，不會送到瀏覽器。
 */
final class LlmClient
{
    private function __construct(
        private string $baseUrl,
        private string $apiKey,
        private string $model,
        private float $temperature,
        private bool $jsonMode,
        private int $timeout,
    ) {
    }

    public static function purposeForTask(string $task): string
    {
        return in_array($task, ['advisor_paths', 'advisor_chat'], true) ? 'advisor' : 'chat';
    }

    public static function create(string $purpose): self
    {
        $advisor = $purpose === 'advisor';
        $base = $advisor ? Config::get('ADVISOR_LLM_BASE_URL', Config::get('LLM_BASE_URL')) : Config::get('LLM_BASE_URL');
        // Keep credentials separate; Tasks controls the explicitly requested fallback order.
        $key = Config::get($advisor ? 'ADVISOR_LLM_API_KEY' : 'LLM_API_KEY');
        $model = $advisor ? Config::get('ADVISOR_LLM_MODEL', Config::get('LLM_MODEL_CHAT'))
            : Config::get($purpose === 'eval' ? 'LLM_MODEL_EVAL' : 'LLM_MODEL_CHAT');
        if (!$base || !$key || !$model) {
            throw new LogicException($advisor ? '未設定職涯助理的專用 API key、服務地址或模型名稱。'
                : '未設定 LLM_BASE_URL、LLM_API_KEY 或模型名稱。');
        }
        return new self(rtrim($base, '/'), $key, $model, $purpose === 'eval' ? 0.2 : 0.7,
            Config::bool('LLM_JSON_MODE'), Config::int('LLM_TIMEOUT', 45));
    }

    /** @return callable(array):string 給 Evaluator 使用 */
    public function asCallable(bool $json = true): callable
    {
        return fn (array $messages): string => $this->chat($messages, $json);
    }

    public function chat(array $messages, bool $json = false): string
    {
        $payload = ['model' => $this->model, 'messages' => $messages, 'temperature' => $this->temperature];
        if (parse_url($this->baseUrl, PHP_URL_HOST) === 'api.deepseek.com') {
            $payload['thinking'] = ['type' => 'disabled'];
        }
        if ($json && $this->jsonMode) {
            $payload['response_format'] = ['type' => 'json_object'];
        }
        $ch = curl_init($this->baseUrl . '/chat/completions');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $this->apiKey],
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
        ]);
        $caFile = Config::get('LLM_CA_FILE');
        if ($caFile) {
            $caPath = realpath(dirname(SITE_ROOT) . '/' . $caFile) ?: $caFile;
            curl_setopt($ch, CURLOPT_CAINFO, $caPath);
        }
        $body = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $err = curl_error($ch);
        unset($ch);
        if ($body === false) {
            throw new RuntimeException('無法連接 AI 服務：' . $err);
        }
        if ($status < 200 || $status >= 300) {
            error_log('LLM ' . $status . ': ' . substr((string) $body, 0, 500));
            throw new RuntimeException('AI 服務回應錯誤（' . $status . '）。');
        }
        $data = json_decode((string) $body, true);
        $text = $data['choices'][0]['message']['content'] ?? null;
        if (!is_string($text)) {
            throw new RuntimeException('AI 服務回應格式不符合預期。');
        }
        return $text;
    }
}
