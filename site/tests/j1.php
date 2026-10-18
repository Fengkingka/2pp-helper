<?php
declare(strict_types=1);
require __DIR__ . '/../includes/bootstrap.php';

$checked = 0;
function checkJ1(bool $condition, string $label): void {
    global $checked;
    if (!$condition) throw new RuntimeException($label);
    $checked++;
    echo "PASS {$label}\n";
}
$captured = [];
$fake = function (array $messages) use (&$captured): string {
    $captured = json_decode($messages[1]['content'], true, 512, JSON_THROW_ON_ERROR);
    return json_encode(['reply' => 'Choose one action to practise this week.']);
};
$input = ['_lang' => 'en', 'profile' => ['education' => [[
    'school' => 'Private school name', 'major' => 'Computer Science', 'gradYear' => 2026,
    'degreeLevel' => 'master', 'degree' => 'MSc in AI for Business', 'educationStatus' => 'in_progress',
]]], 'history' => [['role' => 'user', 'text' => 'How do I start?']], 'paths' => ['Junior Data Analyst']];
$result = Tasks::run('advisor_chat', $input, $fake);
checkJ1($result['source'] === 'ai', 'education fields preserve the existing advisor task');
checkJ1($captured['用戶資料']['學位資料'][0] === ['level' => 'master', 'programme' => 'MSc in AI for Business', 'status' => 'in_progress'], 'degree level, programme and actual study status reach the advisor');
checkJ1(!str_contains(json_encode($captured), 'Private school name'), 'school identity remains excluded from the prompt');
$input['profile']['education'][0]['degreeLevel'] = 'unrecognised';
$input['profile']['education'][0]['degree'] = str_repeat('x', 200);
$input['profile']['education'][0]['educationStatus'] = 'unrecognised';
Tasks::run('advisor_chat', $input, $fake);
checkJ1($captured['用戶資料']['學位資料'][0]['level'] === '' && strlen($captured['用戶資料']['學位資料'][0]['programme']) === 120, 'invalid degree level is ignored and programme length is bounded');
checkJ1($captured['用戶資料']['學位資料'][0]['status'] === '', 'unknown study status is not treated as completed');
unset($input['profile']['education'][0]['degree'], $input['profile']['education'][0]['degreeLevel'], $input['profile']['education'][0]['educationStatus']);
Tasks::run('advisor_chat', $input, $fake);
checkJ1($captured['用戶資料']['學位資料'][0] === ['level' => '', 'programme' => '', 'status' => ''], 'older profiles remain compatible');
$input['profile']['education'][] = ['degreeLevel' => 'master', 'degree' => 'Future MSc', 'major' => 'Future Major', 'educationStatus' => 'planned'];
Tasks::run('advisor_chat', $input, $fake);
checkJ1(count($captured['用戶資料']['學位資料']) === 1 && count($captured['用戶資料']['學歷']) === 1
    && $captured['用戶資料']['進修目標'] === [['level' => 'master', 'programme' => 'Future MSc']], 'legacy planned education is a future study goal, not a current credential');
unset($input['profile']['education'][1]);
$selection = [];
$roles = array_slice(Content::roles(), 0, 3);
$choose = function (array $messages) use (&$selection, $roles): string {
    $selection = json_decode($messages[1]['content'], true, 512, JSON_THROW_ON_ERROR)['用戶資料'];
    return json_encode(['intro' => 'Choose a route to explore.', 'paths' => array_map(fn ($r) => ['roleId' => $r['id'], 'why' => 'Relevant skills.', 'plan' => 'Build a small project.'], $roles)]);
};
$input['profile']['strengths'] = ['scores' => ['positivity' => 3.1, 'dependability' => 4.5, 'mastery' => 3], 'shareWithAI' => false];
$off = Tasks::run('advisor_paths', $input, $choose);
$offSelection = $selection;
$input['profile']['strengths']['shareWithAI'] = true;
$on = Tasks::run('advisor_paths', $input, $choose);
checkJ1($on['source'] === 'ai' && $offSelection === $selection && !array_key_exists('強項', $selection), 'live role selection cannot see questionnaire scores');
checkJ1(array_column($off['paths'], 'id') === array_column($on['paths'], 'id') && !str_contains($off['paths'][0]['why'], 'relative strength') && str_contains($on['paths'][0]['why'], 'relative strength'), 'consent changes explanations but not the selected role order');
$input['paths'] = [['roleId' => $roles[1]['id'], 'name' => 'Fabricated name'], ['roleId' => 'unknown'], ['roleId' => $roles[0]['id']]];
Tasks::run('advisor_chat', $input, $fake);
checkJ1(array_column($captured['建議路徑'], 'label') === ['A', 'C'] && $captured['建議路徑'][0]['name'] === $roles[1]['name'], 'chat sees exact route labels and authoritative role cards, never fabricated names');
$input['profile']['strengths']['scores'] = ['positivity' => 3, 'dependability' => 3, 'mastery' => 3];
$tied = Tasks::run('advisor_paths', $input, $choose);
checkJ1(str_contains($tied['paths'][0]['why'], 'three questionnaire scores are similar'), 'AI path explanations do not assign a sole strength to equal scores');
$input['profile']['strengths']['scores']['positivity'] = 9;
Tasks::run('advisor_chat', $input, $fake);
checkJ1($captured['用戶資料']['強項'] === null, 'invalid questionnaire scores are not sent to the model');
$bilingual = Tasks::run('advisor_paths', ['_lang' => 'zh-HK', 'profile' => []], function () use ($roles): string {
    return json_encode(['intro' => '先比較路徑。', 'paths' => array_map(fn ($r) => [
        'roleId' => $r['id'], 'why' => '技能符合職位要求。', 'plan' => '完成一個小型項目。',
        'whyOther' => 'Your skills match the role.', 'planOther' => 'Complete a small project.',
    ], $roles)]);
});
checkJ1($bilingual['source'] === 'ai' && array_column($bilingual['paths'], 'id') === array_column($roles, 'id')
    && $bilingual['paths'][0]['localized']['zh-HK']['why'] === '技能符合職位要求。'
    && $bilingual['paths'][0]['localized']['en']['plan'] === 'Complete a small project.',
    'one role selection supplies both explanation languages without changing route IDs');
echo "RESULT {$checked} passed\n";
