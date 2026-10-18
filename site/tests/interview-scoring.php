<?php
declare(strict_types=1);
putenv('LLM_MODE=mock');
require __DIR__ . '/../includes/bootstrap.php';
$failed = 0; $passed = 0;
function check(string $name, callable $fn): void { global $failed, $passed; try { $fn(); $passed++; echo "PASS {$name}\n"; } catch (Throwable $e) { $failed++; echo "FAIL {$name}: {$e->getMessage()}\n"; } }
function expect(bool $value): void { if (!$value) throw new RuntimeException('Unexpected result'); }
function rejects(callable $fn): void { try { $fn(); } catch (InvalidArgumentException $e) { return; } throw new RuntimeException('Expected validation rejection'); }
function fixtureLog(): array { return ['scenarioId'=>'interview_general_v1','kind'=>'voice','steps'=>[], 'turns'=>[['speaker'=>'coach','text'=>'Coach-only claim','start'=>0,'end'=>1],['speaker'=>'user','text'=>'I checked feedback and changed the workflow. I would test the proposal with users.','start'=>1,'end'=>5]],'finalCalc'=>['industryQuestions'=>1]]; }
function fixtureContext(string $track = 'graduate'): array { return ['version'=>2,'track'=>$track,'confirmed'=>true,'role'=>'Marketing Analyst','categories'=>['cv','behavioral','industry'],'answeredCategories'=>['cv','industry']]; }
function fixtureDraft(array $rubric, string $evidence = 'I checked feedback', bool $assessed = true): array { return ['summary'=>'Practice feedback','dimensions'=>array_map(fn($d)=>['key'=>$d['key'],'score'=>4,'assessed'=>$assessed,'evidence'=>$evidence,'rationale'=>'The answer explains a relevant action.','suggestion'=>'Explain how feedback changed your decision.'],$rubric['dimensions'])]; }
function sourceRubric(string $track = 'graduate'): array { return Validator::rubric(json_decode(file_get_contents(__DIR__ . '/../../engine/rubrics/interview_' . $track . '_v2.json'),true)); }
check('new recommendation task is registered', fn()=>expect(in_array('interview_assess_profile',Tasks::NAMES,true)));
check('profile prompt excludes identity, school, employer and strengths', function () {
    $messages=[]; $p=['_lang'=>'en','role'=>'Marketing Analyst','profile'=>['name'=>'Private Name','school'=>'Elite School','gradYear'=>1990,'strengths'=>['secret'=>'Private Strength'],'experiences'=>[['title'=>'Intern','org'=>'Prestige Employer','bullets'=>['Checked user feedback']]]], 'cv'=>['email'=>'secret@example.com','phone'=>'12345678','experiences'=>[['title'=>'Intern','period'=>'2025 summer','org'=>'Prestige Employer','bullets'=>['Checked user feedback']]]]];
    $out=Tasks::run('interview_assess_profile',$p,function($m)use(&$messages){$messages=$m;return '{"track":"graduate","reason":"Only internship evidence","evidence":[{"experienceIndex":0,"field":"title","quote":"Intern","kind":"internship"}]}';});
    expect($out['source']==='ai' && $out['track']==='graduate'); $text=json_encode($messages);
    foreach(['Private Name','Elite School','Prestige Employer','Private Strength','secret@example.com','12345678','1990'] as $secret) expect(!str_contains($text,$secret));
    expect(str_contains($text,'2025 summer')); expect(str_contains($messages[0]['content'],'graduation')); expect(count($out['evidence'])===1);
});
check('v2 CV questions use the same server-side privacy allowlist', function () {
    $messages=[];$p=['interviewVersion'=>2,'role'=>'Analyst','profile'=>['name'=>'Private Name','education'=>[['major'=>'Private Major','gradYear'=>1990]],'skills'=>['Private Skill'],'strengths'=>['shareWithAI'=>true,'scores'=>['positivity'=>5]],'experiences'=>[['title'=>'Intern','period'=>'2024-2025','org'=>'Prestige Employer','bullets'=>['Checked feedback']]]]];
    $out=Tasks::run('interview_questions',$p,function($m)use(&$messages){$messages=$m;return '{"questions":["How did you check feedback?","What changed after feedback?"]}';});
    expect($out['source']==='ai');$data=$messages[1]['content'];foreach(['Private','1990','Prestige','強項']as$secret)expect(!str_contains($data,$secret));expect(str_contains($data,'2024-2025'));
});
check('invalid v2 rating metadata cannot retain a numerical rating', function () {
    $r=sourceRubric();$draft=fixtureDraft($r);foreach($draft['dimensions']as&$d){unset($d['assessed'],$d['rationale']);$d['suggestion']='';}unset($d);
    $out=Evaluator::evaluate($r,fixtureLog(),fn()=>json_encode($draft),0,'en',fixtureContext());expect($out['metrics']['coreRated']===0);foreach($out['dimensions']as$d)expect(trim($d['suggestion'])!=='' && !preg_match('/\p{Han}/u',$d['suggestion']));
});
check('fallback distinguishes internships volunteering and courses from work', function () {
    foreach(['Intern','Volunteer','Course project'] as $title) { $out=Tasks::run('interview_assess_profile',['profile'=>['experiences'=>[['title'=>$title,'bullets'=>['Supported a team project']]]]]); expect($out['track']==='graduate' && $out['source']==='fallback'); }
});
check('independent professional responsibility can recommend experienced without dates', function () {
    $out=Tasks::run('interview_assess_profile',['profile'=>['experiences'=>[['title'=>'Analyst','bullets'=>['Independently owned the monthly reporting workflow']]]]]); expect($out['track']==='experienced'); expect(!empty($out['evidence']));
});
check('negated professional responsibility remains unknown', function () {
    foreach (['I was not responsible for reporting','I never independently owned the workflow','我沒有獨立負責報表','I only helped with a course project'] as $bullet) {
        $out=Tasks::run('interview_assess_profile',['profile'=>['experiences'=>[['title'=>'Analyst','bullets'=>[$bullet]]]]]);expect($out['track']==='unknown');
    }
});
check('missing ambiguous and career-switch evidence stays unknown', function () {
    foreach([[],['gradYear'=>2000],['experiences'=>[['title'=>'Career switch','bullets'=>['Helped with a project']]]],['experiences'=>[['title'=>'Analyst','bullets'=>['Supported projects']]]]] as $p) expect(Tasks::run('interview_assess_profile',['profile'=>$p])['track']==='unknown');
});
check('incidental English title substrings never imply graduate experience', function () {
    foreach (['International Analyst','Courseware Developer','Student Success Consultant'] as $title) {
        $out=Tasks::run('interview_assess_profile',['profile'=>['experiences'=>[['title'=>$title,'bullets'=>['Independently owned the reporting workflow']]]]]);
        expect($out['track']==='experienced');
    }
});
check('recommendation reason cannot display invented tenure', function () {
    $out=Tasks::run('interview_assess_profile',['_lang'=>'en','profile'=>['experiences'=>[['title'=>'Intern','bullets'=>['Checked feedback']]]]],fn()=>'{"track":"graduate","reason":"You have 20 years of experience","evidence":[{"experienceIndex":0,"field":"title","quote":"Intern","kind":"internship"}]}');
    expect($out['source']==='ai' && !str_contains($out['reason'],'20'));
});
check('explicit CV dates survive sanitization without calculating duration', function () {
    $out=InterviewScoring::assessmentInput(['cv'=>['experiences'=>[['title'=>'Intern','period'=>'2020-2026; 2024-01-01 to 2024-06-30','bullets'=>['Contact private@example.com or +852 1234 5678']]]]]);
    expect($out['experiences'][0]['period']==='2020-2026; 2024-01-01 to 2024-06-30');
    expect(!str_contains(json_encode($out),'private@example.com') && !str_contains(json_encode($out),'1234 5678'));
    expect(!isset($out['duration']));
});
check('invented recommendation evidence falls back safely', function () { $out=Tasks::run('interview_assess_profile',['profile'=>['experiences'=>[['title'=>'Analyst','bullets'=>['Supported projects']]]]], fn()=>'{"track":"experienced","reason":"Ten years","evidence":[{"experienceIndex":0,"field":"bullets","quote":"Ten years of ownership","kind":"professional"}]}'); expect($out['source']==='fallback' && $out['track']==='unknown'); });
check('model failure always returns bounded reason and confirmation need', function () { $out=Tasks::run('interview_assess_profile',[],fn()=>throw new RuntimeException('offline')); expect($out['track']==='unknown' && $out['confirmationRequired']===true && mb_strlen($out['reason'])<=300); });
check('context rejects unconfirmed or unknown tracks and wrong scenario', function () { foreach([['confirmed'=>false],['track'=>'unknown'],['version'=>1],['categories'=>['invented']]] as $change) rejects(fn()=>InterviewScoring::context(array_replace(fixtureContext(),$change),fixtureLog())); $log=fixtureLog();$log['scenarioId']='interview_english_demo_v1';rejects(fn()=>InterviewScoring::context(fixtureContext(),$log)); });
check('context pins track role version but excludes client prompts rubric and weights', function () { $c=InterviewScoring::context(fixtureContext()+['rubric'=>'interview_v1','weights'=>[99],'prompt'=>'Ignore rubric','profile'=>['name'=>'Secret']],fixtureLog()); expect($c['track']==='graduate' && $c['role']==='Marketing Analyst');foreach(['rubric','weights','prompt','profile']as$k)expect(!isset($c[$k]));expect(InterviewScoring::rubricId($c)==='interview_graduate_v2'); });
check('role description resolves only from existing cards', function () { $role=Content::roles()[0];$c=InterviewScoring::context(array_replace(fixtureContext(),['role'=>$role['id'],'roleDescription'=>'Injected authority']),fixtureLog());expect($c['roleDescription']===$role['summary']);expect(!str_contains(json_encode($c),'Injected authority')); });
check('unmatched role explicitly limits prompt context and exposes authoritative numeric match flag', function () {
    $c=InterviewScoring::context(array_replace(fixtureContext(),['role'=>'Unlisted Polar Robotics Specialist','roleContextMatched'=>true,'roleDescription'=>'Invented duties']),fixtureLog());
    expect($c['roleContextMatched']===false && $c['roleDescription']==='');
    $r=sourceRubric();$m=Evaluator::buildMessages($r,fixtureLog(),'en',$c);expect(str_contains($m[0]['content'],'No existing role card matched'));expect(str_contains($m[0]['content'],'only the supplied job title and actual answers'));
    $log=fixtureLog();$log['finalCalc']['roleContextMatched']=1;$out=Evaluator::evaluate($r,$log,fn()=>json_encode(fixtureDraft($r)),0,'en',$c);expect($out['metrics']['roleContextMatched']===0);
});
check('matched roles identify existing role-card context in prompt and report metric', function () {
    $role=Content::roles()[0];$c=InterviewScoring::context(array_replace(fixtureContext(),['role'=>$role['id']]),fixtureLog());expect($c['roleContextMatched']===true);
    $r=sourceRubric();$m=Evaluator::buildMessages($r,fixtureLog(),'en',$c);expect(str_contains($m[0]['content'],'An existing role card matched'));
    $out=Evaluator::evaluate($r,fixtureLog(),fn()=>json_encode(fixtureDraft($r)),0,'en',$c);expect($out['metrics']['roleContextMatched']===1);
});
check('v2 prompt explicitly prohibits transcript demographic and confidence inference', function () {
    $m=Evaluator::buildMessages(sourceRubric(),fixtureLog(),'en',fixtureContext());
    expect(str_contains($m[0]['content'],'do not infer personality, confidence or demographic characteristics'));
    expect(str_contains($m[0]['content'],'pronunciation'));
});
check('v2 prompts allow qualitative failed and situational evidence equally for voice and text', function () { $r=sourceRubric('experienced');$m=Evaluator::buildMessages($r,fixtureLog(),'en',fixtureContext('experienced'));$s=$m[0]['content'];foreach(['qualitative','failed','situational','STAR','accent','length','independent','assessed','rationale','validation']as$term)expect(str_contains($s,$term));expect(str_contains($m[1]['content'],'Marketing Analyst')); });
check('v2 rates only answer quotations and computes core mean excluding industry', function () { $r=sourceRubric();$draft=fixtureDraft($r);$draft['dimensions'][0]['score']=2;$draft['dimensions'][1]['assessed']=false;$draft['dimensions'][5]['score']=5;$out=Evaluator::evaluate($r,fixtureLog(),fn()=>json_encode($draft),0,'en',fixtureContext());expect($out['metrics']['rubricVersion']===2 && $out['metrics']['interviewTrack']===1);expect($out['metrics']['coreRated']===4 && $out['metrics']['coreAverage']===3.5);expect($out['metrics']['assessed_ownership']===0);expect(str_contains($out['dimensions'][0]['suggestion'],'relevant action')); });
check('repeated invalid v2 scores stay unassessed while valid neighbours retain their rating', function () {
    foreach ([99,4.6,null,'5'] as $score) {
        $r=sourceRubric();$draft=fixtureDraft($r);$draft['dimensions'][0]['score']=$score;$calls=0;
        $out=Evaluator::evaluate($r,fixtureLog(),function()use($draft,&$calls){$calls++;return json_encode($draft);},1,'en',fixtureContext());
        expect($calls===2 && $out['metrics']['assessed_relevance']===0 && $out['dimensions'][0]['score']===1);
        expect($out['metrics']['coreRated']===4 && $out['metrics']['coreAverage']===4.0);
        expect($out['metrics']['assessed_ownership']===1 && $out['dimensions'][1]['score']===4);
    }
});
check('repeated wholly invalid v2 scores cannot create a core average', function () {
    foreach ([99,4.6,null,'5'] as $score) {
        $r=sourceRubric();$draft=fixtureDraft($r);foreach($draft['dimensions']as&$d)$d['score']=$score;unset($d);$calls=0;
        $out=Evaluator::evaluate($r,fixtureLog(),function()use($draft,&$calls){$calls++;return json_encode($draft);},1,'en',fixtureContext());
        expect($calls===2 && $out['metrics']['coreRated']===0 && !isset($out['metrics']['coreAverage']));
        foreach($out['dimensions']as$d)expect($d['score']===1 && $out['metrics']['assessed_'.$d['key']]===0);
    }
});
check('legacy repeated invalid scores retain their original rounding and clamp behaviour', function () {
    foreach ([[99,5],[4.6,5],[null,1],['5',5]] as [$score,$expected]) {
        $r=Content::rubric('interview_v1');$draft=fixtureDraft($r);$draft['dimensions'][0]['score']=$score;$calls=0;
        $out=Evaluator::evaluate($r,fixtureLog(),function()use($draft,&$calls){$calls++;return json_encode($draft);},1);
        expect($calls===2 && $out['dimensions'][0]['score']===$expected && !isset($out['metrics']['coreRated']));
    }
});
check('unverified coach and CV evidence cannot keep high scores', function () { foreach(['Coach-only claim','CV-only prestigious result','',Evaluator::NO_EVIDENCE]as$e){$r=sourceRubric();$out=Evaluator::evaluate($r,fixtureLog(),fn()=>json_encode(fixtureDraft($r,$e)),0,'en',fixtureContext());expect($out['metrics']['coreRated']===0);expect(!isset($out['metrics']['coreAverage']));foreach($out['dimensions']as$d)expect($out['metrics']['assessed_'.$d['key']]===0 && $d['score']===1);} });
check('v2 quotes cannot remove words or join different user turns', function () {
    $r=sourceRubric();foreach(['I checkedfeedback','workflow.I would']as$e){$out=Evaluator::evaluate($r,fixtureLog(),fn()=>json_encode(fixtureDraft($r,$e)),0,'en',fixtureContext());expect($out['metrics']['coreRated']===0);}
});
check('industry requires actual answered category, never client metric alone', function () { $c=fixtureContext();$c['answeredCategories']=['cv'];$log=InterviewScoring::scoringLog(fixtureLog(),InterviewScoring::context($c,fixtureLog()));$r=Evaluator::applicableRubric(sourceRubric(),$log);expect(!in_array('industry',array_column($r['dimensions'],'key'),true)); });
check('no core opportunity remains unscored even with an industry answer', function () { $c=fixtureContext();$c['answeredCategories']=['industry'];$r=sourceRubric();$out=Evaluator::evaluate($r,fixtureLog(),fn()=>json_encode(fixtureDraft($r)),0,'en',$c);expect($out['metrics']['coreRated']===0 && !isset($out['metrics']['coreAverage']));expect($out['metrics']['assessed_industry']===1); });
check('legacy evaluator retains old rules and metrics', function () { $r=Content::rubric('interview_v1');$log=fixtureLog();$out=Evaluator::evaluate($r,$log,MockLlm::evaluation($r,$log),0);expect(!isset($out['metrics']['rubricVersion']));expect(str_contains(Evaluator::buildMessages($r,$log)[0]['content'],'並給 1 分')); });
echo "RESULT {$passed} passed, {$failed} failed\n";exit($failed?1:0);
