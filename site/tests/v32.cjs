const assert=require('node:assert/strict'),V=require('../assets/js/v32.js');
let count=0;const test=(name,fn)=>{fn();count++;console.log('PASS '+name)};
test('aliases share skill identity',()=>{assert.equal(V.skillId('Python 基礎'),V.skillId('PYTHON'));assert.equal(V.skillId('MS Excel'),V.skillId('Excel'));});
test('migration preserves planned education and consent',()=>{const p=V.normalizeProfile({education:[{major:'AI',educationStatus:'planned'}],strengths:{shareWithAI:false},skills:['Python 基礎']});assert.equal(p.education[0].educationStatus,'planned');assert.equal(p.strengths.shareWithAI,false);assert.equal(p.skillDetails[0].id,'python');});
test('contact changes do not invalidate career relevance',()=>{assert.equal(V.fingerprint({education:[{school:'A',major:'IT'}]}),V.fingerprint({education:[{school:'B',major:'IT'}]}));});
test('real skill changes invalidate recommendations',()=>{assert.notEqual(V.fingerprint({skills:['Excel']}),V.fingerprint({skills:['Python']}));});
test('comparisons exclude mock and incompatible assessments',()=>{const a={scenarioId:'interview_general_v1',route:'grad',practiceLength:5,language:'en',interviewContext:{role:'Analyst'},report:{metrics:{rubricVersion:2,interviewTrack:1}}};assert.ok(V.comparable(a,{...a}));assert.equal(V.comparable(a,{...a,practiceLength:3}),false);assert.equal(V.comparable(a,{...a,report:{metrics:{mock:1}}}),false);});
console.log('RESULT '+count+' passed');
