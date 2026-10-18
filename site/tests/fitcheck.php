<?php
declare(strict_types=1);
require __DIR__ . '/../includes/bootstrap.php';
Config::load('/nonexistent-fitcheck-test-config'); // Never use the user's private credentials.
$checks = 0;
function check($value, string $name): void {global $checks;if (!$value) throw new RuntimeException($name);$checks++;echo "PASS $name\n";}
function rejects(callable $fn, string $name): void {try {$fn();} catch (InvalidArgumentException $e) {check(true,$name);return;}throw new RuntimeException($name);}
$p=FitCheck::proposal(['name'=>'LedgerPilot','problem'=>'Small shops miss overdue invoices.','audience'=>'Hong Kong independent retailers','solution'=>'A weekly invoice follow-up dashboard.','revenue'=>'HKD 99 per month, untested.','marketSize'=>'Unknown; bottom-up research needed.','differentiator'=>'Local-language invoice reminders.','query'=>'invoice software','geo'=>'HK']);
rejects(fn()=>FitCheck::proposal([]),'empty proposal rejected');
rejects(fn()=>FitCheck::proposal(['geo'=>'invalid']),'invalid geography rejected');
check(FitCheck::url('javascript:alert(1)')===''&&FitCheck::url('https://user:secret@example.test')==='','unsafe evidence URLs rejected');
$e=[['category'=>'problem','title'=>'Interview notes','summary'=>'Five founders described chasing invoices. Two currently pay for help.','url'=>'https://example.test/notes','date'=>gmdate('Y-m-d')]];
$manual=FitCheck::evidence($e);
check($manual[0]['origin']==='user','manual evidence cannot declare itself verified');
check(count(FitCheck::evidence([$e[0],$e[0]]))===1,'duplicate evidence removed');
rejects(fn()=>FitCheck::evidence([array_replace($e[0],['date'=>'2024-02-31'])]),'impossible date rejected');
rejects(fn()=>FitCheck::evidence([array_replace($e[0],['date'=>'2099-01-01'])]),'future evidence date rejected');
rejects(fn()=>FitCheck::evidence([array_replace($e[0],['url'=>'file:///etc/passwd'])]),'local file evidence URL rejected');
rejects(fn()=>FitCheck::evidence([['title'=>'Half written','summary'=>'']]),'incomplete evidence rejected');
$empty=FitCheckSources::collect($p,true,fn()=>throw new RuntimeException('should not call'));
check(count(array_filter($empty['sources'],fn($s)=>$s['status']==='not_configured'))===2,'key-based sources without keys never call transport');
check($empty['sources']['community']['status']==='unavailable','keyless community source fails safely when transport errors');
$base=FitCheck::analyze($p,[],$empty['sources'],'en',null);
check($base['aiStatus']==='not_configured'&&$base['score']['value']===25,'no-evidence report is explicitly a readiness checklist');
check(count($base['findings'])===5&&count($base['experiments'])===2,'offline report gives evidence gaps and experiments');
$dated=FitCheck::analyze($p,$manual,[],'en',null);
check($dated['score']['value']===40,'documented and dated evidence adds the published 15 points');
$stale=$manual;$stale[0]['date']='2010-01-01';
check(FitCheck::readiness($p,$stale)['value']===35,'old evidence gets coverage but no recency credit');
$negative=$manual;$negative[0]['summary']='All five founders rejected the proposed service.';
check(FitCheck::readiness($p,$negative)['value']===40,'readiness is explicitly independent of positive market findings');
$valid=['summary'=>'Demand and pricing remain unvalidated.','findings'=>[
 ['level'=>'warning','title'=>'Limited interview sample','detail'=>'Test whether these problems recur.','basis'=>'evidence','citations'=>[['id'=>'E1','quote'=>'Five founders described chasing invoices.']]],
 ['level'=>'risk','title'=>'Forged source','detail'=>'Invented market fact.','basis'=>'evidence','citations'=>[['id'=>'E999','quote'=>'invented']]],
 ['level'=>'strength','title'=>'Forged quotation','detail'=>'Invented quote.','basis'=>'evidence','citations'=>[['id'=>'E1','quote'=>'There are 100000 paying customers.']]],
], 'rewrites'=>[['field'=>'audience','text'=>'Hong Kong independent retailers who chase invoices weekly.','why'=>'Narrow the segment.'],['field'=>'API_KEY','text'=>'bad','why'=>'bad']],
 'experiments'=>[['title'=>'Pilot','method'=>'Offer a priced pilot to ten prospects.','success_criterion'=>'Two paid commitments within 14 days; revise otherwise.','days'=>14]]];
$messages=[];$live=FitCheck::analyze($p,$manual,[],'en',function($m)use($valid,&$messages){$messages=$m;return json_encode($valid);});
check($live['aiStatus']==='live','valid AI result is labelled live');
check(count(array_filter($live['findings'],fn($f)=>$f['basis']==='evidence'))===1,'unrecognized citations and forged quotes removed');
check(count($live['rewrites'])===1&&$live['rewrites'][0]['field']==='audience','rewrites limited to known proposal fields');
check(str_contains($messages[0]['content'],'untrusted data')&&str_contains($messages[1]['content'],'LedgerPilot'),'AI receives bounded proposal and untrusted-data instructions');
check(FitCheck::analyze($p,[],[],'en',fn()=>'{broken')['aiStatus']==='failed','malformed AI result yields transparent fallback');
check(FitCheck::analyze($p,[],[],'en',fn()=>throw new RuntimeException('secret provider body'))['aiStatus']==='failed','provider failure does not expose provider message');
check(!str_contains(json_encode(FitCheck::analyze($p,[],[],'en',fn()=>throw new RuntimeException('SECRET'))),'SECRET'),'private provider errors never enter reports');
$extracted=FitCheck::extract(str_repeat('A retailer invoice proposal. ',3),'en',fn()=>json_encode(['problem'=>'Unpaid invoices','marketSize'=>'','geo'=>'HK']));
check($extracted['marketSize']===''&&$extracted['problem']==='Unpaid invoices','extraction preserves missing values for manual review');

putenv('FITCHECK_SERPAPI_KEY=test-fixture');
$calls=[];
$transport=function($method,$url,$headers,$body)use(&$calls){
 $calls[]=[$method,$url,$headers,$body];
 if(str_contains($url,'serpapi')&&($body['engine']??'')==='google_trends')return ['interest_over_time'=>['timeline_data'=>[['date'=>'Jan 1','values'=>[['extracted_value'=>20]]],['date'=>'Jan 8','values'=>[['extracted_value'=>0]]],['date'=>'Jan 15','is_partial'=>true,'values'=>[['extracted_value'=>99]]]]]];
 if(str_contains($url,'serpapi'))return ['organic_results'=>[['title'=>'Example Co','link'=>'https://example.test/','snippet'=>'Invoice tools.']]];
 return ['hits'=>[['title'=>'Chasing invoice payments','url'=>'https://example.test/hn-post','story_text'=>'How do you handle late invoices?','created_at'=>gmdate('c'),'objectID'=>'123','author'=>'DO_NOT_COLLECT'],['title'=>'','objectID'=>'456']]];
};
$collected=FitCheckSources::collect($p,true,$transport);
check(count($calls)===3&&count($collected['evidence'])===3,'three connectors operate through fixture transport');
check(count(array_filter($collected['sources'],fn($s)=>$s['status']==='retrieved'))===3,'successful sources have retrieved status');
check(count($collected['evidence'][0]['series'])===2&&$collected['evidence'][0]['series'][1]['value']===0.0,'trend zeros retained and partial samples removed');
check(str_contains($collected['evidence'][0]['summary'],'Not absolute search volume'),'trend result carries correct measurement limits');
check($calls[1][3]['engine']==='google'&&$calls[1][3]['api_key']==='test-fixture','competitor search reuses the SerpApi key on the Google engine');
check($collected['evidence'][1]['date']==='','unknown company data date is not replaced with fetch date');
check(!str_contains(json_encode($collected),'DO_NOT_COLLECT'),'Hacker News author names are excluded');
check($collected['evidence'][1]['url']==='https://example.test/','competitor result provides an attribution URL');
check($collected['evidence'][2]['provider']==='Hacker News'&&$collected['evidence'][2]['date']===gmdate('Y-m-d'),'community story keeps its publication date');
$failed=FitCheckSources::collect($p,true,fn()=>throw new RuntimeException('API_KEY=SECRET'));
check(count(array_filter($failed['sources'],fn($s)=>$s['status']==='unavailable'))===3&&!str_contains(json_encode($failed),'SECRET'),'source errors are partial-safe and credential-free');
$missing=FitCheckSources::collect(array_replace($p,['query'=>'']),true,fn()=>throw new RuntimeException('must not call'));
check(count(array_filter($missing['sources'],fn($s)=>$s['status']==='query_needed'))===3,'missing keyword does not trigger unbounded provider searches');
$disabled=FitCheckSources::collect($p,false,fn()=>throw new RuntimeException('must not call'));
check(count(array_filter($disabled['sources'],fn($s)=>$s['status']==='not_requested'))===3,'opted-out sources never call transport');
echo "RESULT $checks checks passed\n";
