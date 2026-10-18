<?php
declare(strict_types=1);

/**
 * PHP 測試（不需要 PHPUnit）：php tests/run.php
 * 用假的 LLM 測試評分器，不需要 API key。
 */
$_SERVER['SCRIPT_FILENAME'] = __FILE__;
putenv('LLM_MODE=mock');
require __DIR__ . '/../includes/bootstrap.php';

$passed = 0;
$failed = 0;
function test(string $name, callable $fn): void
{
    global $passed, $failed;
    try {
        $fn();
        $passed++;
        echo "  ✓ {$name}\n";
    } catch (Throwable $e) {
        $failed++;
        echo "  ✗ {$name}\n    " . $e->getMessage() . "\n";
    }
}
function ok(bool $cond, string $msg = '條件不成立'): void
{
    if (!$cond) {
        throw new RuntimeException($msg);
    }
}
function throws(callable $fn, string $class): void
{
    try {
        $fn();
    } catch (Throwable $e) {
        ok($e instanceof $class, '拋出了 ' . get_class($e) . '：' . $e->getMessage());
        return;
    }
    throw new RuntimeException("沒有拋出 {$class}");
}

$rubric = Content::rubric('b2b_procurement_v1');
$log = Validator::sessionLog([
    'scenarioId' => 'b2b_procurement_v1',
    'kind' => 'exercise',
    'steps' => [['stepId' => 'budget_freeze', 'inputs' => [], 'text' => '我們的系統功能很多，可以幫你們更有效率地排班。有需要再聯絡。']],
]);
$good = [
    'summary' => '语气专业，但未量化 ROI。',
    'dimensions' => [
        ['key' => 'objection_handling', 'score' => 2, 'evidence' => '可以幫你們更有效率地排班', 'suggestion' => '正面回應預算凍結。'],
        ['key' => 'roi_framing', 'score' => 1, 'evidence' => '我們的系統功能很多', 'suggestion' => '把節省的人手時數換算成金額。'],
        ['key' => 'tone', 'score' => 3, 'evidence' => '我們的系統功能很多…排班', 'suggestion' => '再精簡一點。'],
        ['key' => 'cta', 'score' => 2, 'evidence' => '有需要再聯絡', 'suggestion' => '提出具體的通話時間。'],
    ],
    'rewriteExample' => 'Grace 你好……',
];
$goodJson = json_encode($good, JSON_UNESCAPED_UNICODE);

echo "評分器\n";
test('引文必須逐字出現在用戶文字中', function () use ($log) {
    $text = Evaluator::collectUserText($log);
    ok(Evaluator::evidenceIsVerbatim('有需要再聯絡', $text));
    ok(Evaluator::evidenceIsVerbatim('「我們的系統功能很多…排班」', $text));
    ok(!Evaluator::evidenceIsVerbatim('我們保證節省一半成本', $text));
    ok(Evaluator::evidenceIsVerbatim(Evaluator::NO_EVIDENCE, $text));
});
test('正常回應：標籤取自 rubric，保留改寫示範', function () use ($rubric, $log, $goodJson) {
    $r = Evaluator::evaluate($rubric, $log, fn () => $goodJson);
    ok(array_column($r['dimensions'], 'label') === array_column($rubric['dimensions'], 'label'), '標籤不一致');
    ok(isset($r['rewriteExample']), '缺少改寫示範');
});
test('第一次回應不是 JSON：自動重試一次', function () use ($rubric, $log, $goodJson) {
    $calls = 0;
    $r = Evaluator::evaluate($rubric, $log, function () use (&$calls, $goodJson) {
        return ++$calls === 1 ? '好的，以下是評分：' : "```json\n{$goodJson}\n```";
    });
    ok($calls === 2, "呼叫了 {$calls} 次");
    ok(count($r['dimensions']) === 4);
});
test('AI 編造引文：重試後仍編造，就清空並記錄數量', function () use ($rubric, $log, $good) {
    $fake = $good;
    $fake['dimensions'][1]['evidence'] = '我們保證節省一半成本';
    $json = json_encode($fake, JSON_UNESCAPED_UNICODE);
    $r = Evaluator::evaluate($rubric, $log, fn () => $json);
    ok($r['dimensions'][1]['evidence'] === '', '引文沒有被清空');
    ok(($r['metrics']['unverifiedEvidence'] ?? 0) === 1, '沒有記錄數量');
});
test('缺少維度而且重試無效：拋出錯誤', function () use ($rubric, $log, $good) {
    $partial = $good;
    $partial['dimensions'] = array_slice($partial['dimensions'], 0, 2);
    $json = json_encode($partial, JSON_UNESCAPED_UNICODE);
    throws(fn () => Evaluator::evaluate($rubric, $log, fn () => $json), RuntimeException::class);
});
test('示範評分（mock）通過全部檢查，每個劇本都可以評分', function () {
    foreach (['black_swan_saas_v1', 'term_sheet_seed_v1', 'b2b_procurement_v1', 'interview_general_v1'] as $id) {
        $s = Content::scenario($id);
        $rb = Content::rubric($s['rubric']);
        $lg = Validator::sessionLog([
            'scenarioId' => $id, 'kind' => $s['mode'],
            'steps' => [['stepId' => 'x', 'inputs' => ['marketing' => 8000], 'text' => '先減市場預算。之後補聘工程師。']],
            'turns' => [['speaker' => 'user', 'text' => '我負責整理數據，每週做報告。', 'start' => 0, 'end' => 8]],
            'finalCalc' => ['endingCash' => 182000],
        ]);
        $r = Evaluator::evaluate($rb, $lg, MockLlm::evaluation($rb, $lg));
        ok(count($r['dimensions']) === count($rb['dimensions']), "{$id} 維度數量不符");
        ok(($r['metrics']['endingCash'] ?? null) === 182000, "{$id} 沒有保留計算結果");
    }
});

echo "資料檢查\n";
test('拒絕格式錯誤的練習紀錄', function () {
    throws(fn () => Validator::sessionLog(['scenarioId' => '../etc', 'kind' => 'exercise', 'steps' => []]), InvalidArgumentException::class);
    throws(fn () => Validator::sessionLog(['scenarioId' => 'ok', 'kind' => 'hack', 'steps' => []]), InvalidArgumentException::class);
    throws(fn () => Validator::sessionLog(['scenarioId' => 'ok', 'kind' => 'exercise', 'steps' => [], 'turns' => []]), InvalidArgumentException::class);
    throws(fn () => Validator::sessionLog(['scenarioId' => 'ok', 'kind' => 'exercise', 'steps' => [['stepId' => 'a', 'inputs' => ['x' => ['nested']]]]]), InvalidArgumentException::class);
});
test('過長的文字會被截短', function () {
    $l = Validator::sessionLog(['scenarioId' => 'ok', 'kind' => 'exercise', 'steps' => [['stepId' => 'a', 'inputs' => [], 'text' => str_repeat('字', 9000)]]]);
    ok(mb_strlen($l['steps'][0]['text']) === Validator::MAX_TEXT);
});
test('劇本名稱不可包含路徑', function () {
    throws(fn () => Content::scenario('../../etc/passwd'), InvalidArgumentException::class);
    throws(fn () => Content::scenario('not_exist'), DomainException::class);
});
test('所有劇本都有對應的評分準則', function () {
    foreach (glob(SITE_ROOT . '/data/scenarios/*.json') as $f) {
        $s = Content::scenario(basename($f, '.json'));
        Content::rubric($s['rubric']);
    }
});

echo "AI 任務的後備做法\n";
$profile = [
    'careerStage' => 'fresh_grad',
    'education' => [['school' => '示範大學', 'major' => '市場學', 'gradYear' => 2026]],
    'interests' => ['品牌', '數據分析'], 'skills' => ['Excel', 'Canva'],
    'experiences' => [['title' => '市場部實習生', 'org' => '示範零售集團', 'bullets' => ['協助整理社交媒體數據，每週製作報告', '參與一次新產品推廣活動']]],
    'targetRoles' => ['Marketing Analyst'], 'tags' => ['marketing', 'data'],
];
test('職涯路徑：三條，都來自職位卡片，第一站是用戶現況', function () use ($profile) {
    $r = Tasks::run('advisor_paths', ['profile' => $profile]);
    ok(count($r['paths']) === 3);
    $ids = array_column(Content::roles(), 'id');
    foreach ($r['paths'] as $p) {
        ok(in_array($p['id'], $ids, true), '職位不在卡片中');
        ok(count($p['stations']) === 4);
    }
    ok($r['paths'][0]['stations'][0] === '市場學＋Excel', '第一站不正確：' . $r['paths'][0]['stations'][0]);
    ok($r['paths'][0]['id'] === 'marketing_analyst', '排序不正確：' . $r['paths'][0]['id']);
});
test('AI 回應無效時自動改用後備做法', function () use ($profile) {
    $r = Tasks::run('advisor_paths', ['profile' => $profile], fn () => '{"paths":[{"roleId":"made_up","why":"x","plan":"y"}]}');
    ok($r['source'] === 'fallback' && count($r['paths']) === 3);
});
test('CV 改寫不會加入原句沒有的數字', function () {
    $r = Tasks::run('cv_rewrite', ['bullet' => '協助整理社交媒體數據，每週製作報告']);
    ok(!preg_match('/\d/', $r['suggestion']) && str_contains($r['suggestion'], '[填入'));
});
test('面試題按 CV 經歷生成；追問會要求具體結果', function () use ($profile) {
    ok(count(Tasks::run('interview_questions', ['profile' => $profile])['questions']) === 2);
    ok(Tasks::run('interview_followup', ['question' => 'q', 'answer' => '短'])['followUp'] !== null);
    ok(Tasks::run('interview_followup', ['question' => 'q', 'answer' => str_repeat('我負責整理數據並向團隊匯報，', 3) . '互動率提升了 20%。'])['followUp'] === null);
});
test('B2B 分支判斷', function () {
    ok(Tasks::run('check', ['check' => '有沒有量化 ROI', 'text' => '每週可節省 12 小時'])['pass'] === true);
    ok(Tasks::run('check', ['check' => '有沒有量化 ROI', 'text' => '功能很多'])['pass'] === false);
});
test('不支援的任務會被拒絕', fn () => throws(fn () => Tasks::run('delete_everything', []), InvalidArgumentException::class));

/* ---------------------------------------------------------------- 第 2 版 */
test('政策資料卡：最少 10 張，每張都有出處連結、官方全文連結和範疇', function () {
    $cards = Content::policyCards();
    ok(count($cards) >= 10, '政策卡太少');
    $areas = Content::policy()['areas'];
    foreach ($cards as $id => $c) {
        ok(preg_match('/^[a-z0-9_]+$/', $id) === 1, "id 格式：{$id}");
        ok(str_starts_with($c['source']['url'], 'https://') && str_starts_with($c['officialUrl'], 'https://'), "連結：{$id}");
        ok(isset($areas[$c['area']]), "範疇：{$id}");
        ok(array_key_exists('verifiedAt', $c) && array_key_exists('verifiedBy', $c), "核實欄位：{$id}");
    }
});
test('五年規劃初稿（後備）：有願景、3 個目標、每年里程碑，政策卡 id 都存在', function () use ($profile) {
    $r = Tasks::run('plan_draft', ['profile' => $profile, 'pathId' => 'junior_data_analyst']);
    ok($r['source'] === 'fallback' && $r['roleId'] === 'junior_data_analyst');
    ok($r['vision'] !== '' && count($r['goals']) === 3 && count($r['milestones']) === 5);
    $cards = Content::policyCards();
    foreach ($r['goals'] as $g) {
        foreach ($g['policyIds'] as $id) {
            ok(isset($cards[$id]), "不存在的政策卡：{$id}");
        }
    }
    $years = array_column($r['milestones'], 'year');
    ok(min($years) === 2026 && max($years) === 2030);
});
test('五年規劃初稿（AI）：刪除不存在的政策卡、超出年份的里程碑；內容不足時改用後備', function () use ($profile) {
    $fake = fn () => json_encode(['vision' => '2030 年帶領數據團隊', 'goals' => [['text' => '入行', 'policyIds' => ['youth_30k_jobs', 'made_up_policy']]],
        'milestones' => [['year' => 2026, 'goalIndex' => 9, 'text' => 'a'], ['year' => 2027, 'goalIndex' => 0, 'text' => 'b'], ['year' => 2031, 'goalIndex' => 0, 'text' => 'c'], ['year' => 2028, 'goalIndex' => 0, 'text' => 'd']]], JSON_UNESCAPED_UNICODE);
    $r = Tasks::run('plan_draft', ['profile' => $profile, 'pathId' => 'junior_data_analyst'], $fake);
    ok($r['source'] === 'ai' && $r['goals'][0]['policyIds'] === ['youth_30k_jobs']);
    ok(count($r['milestones']) === 3 && $r['milestones'][0]['goalIndex'] === 0);
    $thin = Tasks::run('plan_draft', ['profile' => $profile, 'pathId' => 'junior_data_analyst'], fn () => '{"vision":"x","goals":[],"milestones":[]}');
    ok($thin['source'] === 'fallback');
});
test('問卷結果只在用戶同意時才用於 AI 助理', function () use ($profile) {
    $s = ['instrument' => 'x', 'version' => '0.1', 'takenAt' => '2026-10-08', 'scores' => ['positivity' => 3.1, 'dependability' => 4.5, 'mastery' => 3.0]];
    $off = Tasks::run('advisor_paths', ['profile' => $profile + ['strengths' => $s + ['shareWithAI' => false]]]);
    $on = Tasks::run('advisor_paths', ['profile' => $profile + ['strengths' => $s + ['shareWithAI' => true]]]);
    ok(!str_contains($off['paths'][0]['why'], '強項'), '未同意卻提到強項');
    ok(str_contains($on['paths'][0]['why'], '「可靠」'), '同意後沒有提到強項');
    ok(array_column($off['paths'], 'id') === array_column($on['paths'], 'id'), '強項不可以改變路徑');
    $seen = null;
    Tasks::run('advisor_paths', ['profile' => $profile + ['strengths' => $s + ['shareWithAI' => false]]], function (array $m) use (&$seen) { $seen = $m[1]['content']; return '{}'; });
    ok($seen !== null && !str_contains($seen, '4.5'), '未同意時分數被送給 AI');
});
test('選用評分維度：沒有答「行業認知」題就不評這一項', function () {
    $r = Content::rubric('interview_v1');
    $base = ['scenarioId' => 'interview_general_v1', 'kind' => 'voice', 'steps' => [], 'turns' => []];
    $without = Evaluator::applicableRubric($r, $base + ['finalCalc' => ['answeredQuestions' => 5]]);
    $with = Evaluator::applicableRubric($r, $base + ['finalCalc' => ['industryQuestions' => 1]]);
    ok(!in_array('industry', array_column($without['dimensions'], 'key'), true));
    ok(in_array('industry', array_column($with['dimensions'], 'key'), true));
    ok(count($with['dimensions']) === count($without['dimensions']) + 1);
});
test('職位卡：建議證書和政策卡連結都有效', function () {
    $cards = Content::policyCards();
    foreach (Content::roles() as $r) {
        foreach ($r['policyIds'] ?? [] as $id) {
            ok(isset($cards[$id]), "{$r['id']} → {$id}");
        }
        foreach ($r['recommendedCerts'] ?? [] as $c) {
            ok(is_string($c['name']) && $c['name'] !== '', "{$r['id']} 證書名稱");
        }
    }
});

test('工作與活動：每項都有 https 連結、核實日期和有效的類型；政府計劃最少 8 項', function () {
    $cards = Content::policyCards();
    $kinds = ['role', 'intern', 'scheme', 'course', 'event', 'contest'];
    $schemes = 0;
    foreach (Content::opportunities() as $it) {
        ok(in_array($it['kind'], $kinds, true), "類型：{$it['id']}");
        ok(is_string($it['url']) && str_starts_with($it['url'], 'https://'), "連結：{$it['id']}");
        ok(preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $it['verifiedAt']) === 1, "核實日期：{$it['id']}");
        ok(($it['titleEn'] ?? '') !== '' && ($it['metaEn'] ?? '') !== '', "英文：{$it['id']}");
        foreach (['majorTags', 'interestTags', 'skills', 'certs'] as $k) {
            ok(is_array($it[$k] ?? null), "{$k}：{$it['id']}");
        }
        foreach ($it['policyIds'] ?? [] as $id) {
            ok(isset($cards[$id]), "{$it['id']} → {$id}");
        }
        $schemes += $it['kind'] === 'scheme' ? 1 : 0;
    }
    ok($schemes >= 8, '政府計劃太少');
});

echo "\n{$passed} 項通過，{$failed} 項失敗\n";
exit($failed === 0 ? 0 : 1);
