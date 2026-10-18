const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const J = require('../assets/js/journey.js');
const scope = {};
vm.createContext(scope);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/js/engine.js'), 'utf8'), scope);
const E = scope.Engine;
const q = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/questionnaires/ipip_core_strengths_v1.json'), 'utf8'));
const clone = v => JSON.parse(JSON.stringify(v));
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('PASS ' + name); };

test('resume restores answers and page after refresh', () => {
  const result = J.resumeQuestionnaire(q, {key:J.questionnaireKey(q), page:2, answers:{pos1:4}, retaking:true}, {});
  assert.deepEqual(result, {answers:{pos1:4}, page:2, retaking:true});
});
test('changed questionnaire or scoring key never reuses an obsolete draft', () => {
  const changed = clone(q); changed.items[0].keyed = -1;
  assert.deepEqual(J.resumeQuestionnaire(changed, {key:J.questionnaireKey(q), page:2, answers:{pos1:4}}, {pos1:5}).answers, {});
});
test('old v2 partial answers migrate while invalid values are dropped', () => {
  assert.deepEqual(J.resumeQuestionnaire(q, null, {pos1:4, dep1:9, unknown:3}).answers, {pos1:4});
});
test('all 18 answers still use the team engine reverse scoring', () => {
  const answers = Object.fromEntries(q.items.map(i => [i.id, i.keyed === 1 ? 5 : 1]));
  assert.deepEqual(clone(E.strengths.score(q.items, answers).scores), {positivity:5,dependability:5,mastery:5});
});
test('only valid real questionnaire results are displayed as completed', () => {
  const s = {scores:{positivity:4,dependability:3,mastery:2}};
  assert.ok(J.validStrengths(s)); assert.equal(J.validStrengths({...s,demo:true}),false);
  assert.equal(J.validStrengths({scores:{positivity:9}}),false);
});
test('equal or visually rounded equal scores do not name an arbitrary sole strength', () => {
  assert.deepEqual(J.strengthLeaders({positivity:3,dependability:3,mastery:3}), ['positivity','dependability','mastery']);
  assert.deepEqual(J.strengthLeaders({positivity:4.01,dependability:4.04,mastery:3}), ['positivity','dependability']);
});
console.log(`RESULT ${passed} passed`);
