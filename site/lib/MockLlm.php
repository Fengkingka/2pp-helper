<?php
declare(strict_types=1);

/**
 * 未連接 AI 時的示範評分（LLM_MODE=mock）。
 * 產生的草稿同樣經過 Evaluator 的全部檢查，所以網站流程和真正連接 AI 時完全一樣。
 * 分數只按簡單規則估算，報告會標示「示範評分」。
 */
final class MockLlm
{
    /** @return callable(array):string */
    public static function evaluation(array $rubric, array $log, string $lang = 'zh-HK'): callable
    {
        return function (array $messages) use ($rubric, $log, $lang): string {
            $text = Evaluator::collectUserText($log);
            $hasText = trim($text) !== '';
            $hasDigit = (bool) preg_match('/\d/u', $text);
            $long = mb_strlen($text) > 120;
            $evidence = self::firstSentence($text);

            $dims = [];
            foreach ($rubric['dimensions'] as $d) {
                if (InterviewScoring::isV2($rubric) || ($rubric['id'] ?? '') === VcPanel::ID) {
                    $dims[] = ['key' => $d['key'], 'score' => 1, 'assessed' => false,
                        'evidence' => Evaluator::NO_EVIDENCE,
                        'rationale' => $lang === 'en' ? 'The offline demonstration does not assess competency performance.' : '離線示範不會評定能力表現。',
                        'suggestion' => $lang === 'en' ? 'Use this question to practise a specific action, its reasoning and a way to validate its effect.' : '用這條問題練習說明具體行動、判斷理由，以及驗證效果的方法。'];
                    continue;
                }
                $numbersMatter = (bool) preg_match('/roi|result|具體|成果|數字|consisten/iu', $d['key'] . $d['label']);
                $score = !$hasText ? 1 : 3;
                if ($hasText && $numbersMatter && !$hasDigit) {
                    $score = 2;
                } elseif ($hasText && $long && $hasDigit) {
                    $score = 4;
                }
                $dims[] = [
                    'key' => $d['key'],
                    'score' => $score,
                    'evidence' => $hasText ? $evidence : Evaluator::NO_EVIDENCE,
                    'suggestion' => $lang === 'en'
                        ? 'Give a more specific answer with clear reasoning, evidence and a practical next step.'
                        : '目標是做到：' . $d['levels'][(string) min(5, $score + 1)],
                ];
            }
            $draft = [
                'summary' => $lang === 'en'
                    ? '(Demo score — AI is not connected.) A solid start; use the suggestions below to make your next attempt more specific.'
                    : '（示範評分，尚未連接 AI）整體表現中等，可以按各項建議改善。',
                'dimensions' => $dims,
            ];
            if (InterviewScoring::isV2($rubric) || ($rubric['id'] ?? '') === VcPanel::ID) $draft['summary'] = $lang === 'en'
                ? '(Process demo — no ability scoring.) Your answers were retained for practice; no competency ratings were produced.'
                : '（流程示範，未進行能力評分）回答已保留作練習，沒有產生能力評級。';
            if ($rubric['wantsRewrite']) {
                $draft['rewriteExample'] = ($lang === 'en' ? '(Demo) ' : '（示範）') . mb_substr($text, 0, 80);
            }
            return json_encode($draft, JSON_UNESCAPED_UNICODE);
        };
    }

    /** 取用戶文字的第一句（最多 24 字），保證是逐字引文。 */
    public static function firstSentence(string $text): string
    {
        foreach (preg_split('/[。！？!?\n]/u', $text) ?: [] as $s) {
            $s = trim($s);
            if (mb_strlen($s) >= 2) {
                return mb_substr($s, 0, 24);
            }
        }
        return Evaluator::NO_EVIDENCE;
    }
}
