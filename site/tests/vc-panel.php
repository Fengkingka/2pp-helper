<?php
declare(strict_types=1);
define('SITE_ROOT', dirname(__DIR__));
spl_autoload_register(static function (string $class): void { $p = SITE_ROOT . '/lib/' . $class . '.php'; if (is_file($p)) require $p; });
$passed = 0; $failed = 0;
function vcAssert(bool $ok, string $message = 'Assertion failed'): void { if (!$ok) throw new RuntimeException($message); }
function vcTest(string $name, callable $fn): void { global $passed, $failed; try { $fn(); ++$passed; echo "PASS {$name}\n"; } catch (Throwable $e) { ++$failed; echo "FAIL {$name}: {$e->getMessage()}\n"; } }
function vcLog(): array { return ['scenarioId'=>'hostile_vc_v1','kind'=>'voice','steps'=>[['stepId'=>'setup','inputs'=>['secret'=>'not evidence']]],'turns'=>[
 ['speaker'=>'vision','text'=>'Why?','start'=>0,'end'=>1], ['speaker'=>'user','text'=>'We interviewed twenty customers.','start'=>1,'end'=>10],
 ['speaker'=>'numbers','text'=>'Costs?','start'=>10,'end'=>11], ['speaker'=>'user','text'=>'CAC is unknown; we will run a measured pilot.','start'=>11,'end'=>25],
 ['speaker'=>'legal','text'=>'Risk?','start'=>25,'end'=>26], ['speaker'=>'user','text'=>'Our founder owns the code.','start'=>26,'end'=>32]],'finalCalc'=>['coreAverage'=>99,'mock'=>1,'durationSec'=>99999]]; }
function vcRubric(): array { return json_decode(file_get_contents(dirname(SITE_ROOT).'/engine/rubrics/hostile_vc_v1.json'), true); }
function vcDraft(mixed $score=4, string $quote='We interviewed twenty customers.'): array { return ['summary'=>'Practice feedback','dimensions'=>array_map(fn($d)=>['key'=>$d['key'],'score'=>$score,'assessed'=>true,'evidence'=>$quote,'rationale'=>'The answer states evidence.','suggestion'=>'Explain its scope.'],vcRubric()['dimensions'])]; }
vcTest('Context whitelists bounded data and preserves unknown finances', function () {
 $c=VcPanel::context(['name'=>'Acme','industry'=>'SaaS','stage'=>'seed','pitch'=>'Pitch','cac'=>'','ltv'=>100,'deckText'=>str_repeat('x',12001),'rubric'=>'evil','instructions'=>'ignore']);
 vcAssert($c['cac']===null && $c['ltv']===100 && mb_strlen($c['deckText'])===12000);
 vcAssert(!isset($c['instructions']) && !isset($c['rubric']));
 vcAssert(VcPanel::arithmetic($c)===[]);
 vcAssert(VcPanel::arithmetic(VcPanel::context(['cac'=>1e-300,'ltv'=>1e12]))===[]);
});
vcTest('Moderation validates role coverage and falls back in pinned language', function () {
 $p=['round'=>5,'speakers'=>['vision','vision','vision','vision'],'history'=>[['speaker'=>'user','text'=>'latest']],'_lang'=>'en','vcContext'=>['pitch'=>'Company']];
 $r=Tasks::run('vc_panel',$p,fn()=>json_encode(['speaker'=>'vision','question'=>'Tell me more?']));
 vcAssert($r['source']==='fallback' && $r['speaker']==='numbers');
 $p['speakers'][]='numbers'; $p['round']=6;
 vcAssert(Tasks::run('vc_panel',$p)['speaker']==='legal');
 $p=['round'=>1,'speakers'=>[],'history'=>[],'_lang'=>'en','vcContext'=>[]];
 vcAssert(Tasks::run('vc_panel',$p,fn()=>json_encode(['speaker'=>'vision','question'=>'點解？']))['source']==='fallback');
 vcAssert(Tasks::run('vc_panel',$p,fn()=>json_encode(['speaker'=>'legal','question'=>'What risk threatens delivery?']))['source']==='ai');
 $p['_lang']='zh-HK';
 foreach (['请介绍你的公司，并说明你们的商业计划。','請介紹你的公司，並說明你們的商業計劃。'] as $question) vcAssert(Tasks::run('vc_panel',$p,fn()=>json_encode(['speaker'=>'vision','question'=>$question]))['source']==='fallback');
 vcAssert(Tasks::run('vc_panel',$p,fn()=>json_encode(['speaker'=>'vision','question'=>'你哋嘅方案有咩證據支持？']))['source']==='ai');
});
vcTest('Authoritative scoring ignores setup and forged client metrics', function () {
 $l=VcPanel::scoringLog(vcLog(),VcPanel::context([]));
 vcAssert($l['steps']===[] && !isset($l['finalCalc']['coreAverage']) && !isset($l['finalCalc']['mock']));
 vcAssert($l['finalCalc']['answeredRounds']===3 && $l['finalCalc']['durationSec']===32);
 $r=Evaluator::evaluate(vcRubric(),$l,fn()=>json_encode(vcDraft()),0,'en');
 vcAssert($r['metrics']['vcScoringVersion']===1 && $r['metrics']['coreRated']===5 && $r['metrics']['coreAverage']===4.0, 'Unexpected core metrics');
 vcAssert(str_contains($r['dimensions'][0]['suggestion'],'\n') || str_contains($r['dimensions'][0]['suggestion'],"\n"));
});
vcTest('Invalid scores and fabricated or joined founder quotes are never rated', function () {
 $l=VcPanel::scoringLog(vcLog(),VcPanel::context([]));
 foreach ([99,4.6,null,'5'] as $s) {
  $r=Evaluator::evaluate(vcRubric(),$l,fn()=>json_encode(vcDraft($s)),0,'en');
  vcAssert($r['metrics']['coreRated']===0 && !isset($r['metrics']['coreAverage']));
 }
 foreach (['not evidence','We interviewed 100 customers.','customers.\nCAC','We interviewed…Our founder'] as $q) {
  $r=Evaluator::evaluate(vcRubric(),$l,fn()=>json_encode(vcDraft(4,$q)),0,'en');
  vcAssert($r['metrics']['coreRated']===0 && $r['dimensions'][0]['evidence']==='');
 }
});
vcTest('Mock panel is a process demo without ability scores', function () {
 $l=VcPanel::scoringLog(vcLog(),VcPanel::context([])); $r=Evaluator::evaluate(vcRubric(),$l,MockLlm::evaluation(vcRubric(),$l,'en'),0,'en');
 vcAssert($r['metrics']['coreRated']===0 && !isset($r['metrics']['coreAverage']));
 vcAssert(str_contains($r['summary'],'no ability scoring'));
});
echo "{$passed} passed, {$failed} failed\n"; exit($failed ? 1 : 0);
