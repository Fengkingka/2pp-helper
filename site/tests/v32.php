<?php
declare(strict_types=1);
require __DIR__.'/../includes/bootstrap.php';
function v32check($yes,$message){if(!$yes)throw new RuntimeException($message);echo "PASS $message\n";}
$r=Tasks::run('plan_draft',['startYear'=>2029,'roleName'=>'Data analyst','_lang'=>'en']);
v32check($r['horizon']===[2029,2033],'custom five-year horizon');
v32check(min(array_column($r['milestones'],'year'))>=2029 && max(array_column($r['milestones'],'year'))<=2033,'milestone dates follow selected horizon');
v32check(str_contains($r['vision'],'2033'),'vision follows selected horizon');
$r=Tasks::run('founder_feedback',['_lang'=>'en']);v32check($r['source']==='fallback' && str_contains($r['feedback'],'No AI assessment'),'founder fallback is labelled honestly');
$r=Tasks::run('founder_feedback',[],fn()=>'{"feedback":"Evidence needs testing.","nextAction":"Interview three potential customers."}');v32check($r['source']==='ai' && $r['nextAction']!=='','founder AI task handles structured feedback');
echo "RESULT 5 passed\n";
