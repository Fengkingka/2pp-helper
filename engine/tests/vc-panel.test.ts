import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { getScenario, getRubric } from '../lib/content';
import { reportScore } from '../lib/plan';
const path = (p: string) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
function rules() {
  const root: any = {};
  if (existsSync(path('site/assets/js/vc-panel.js'))) runInNewContext(readFileSync(path('site/assets/js/vc-panel.js'), 'utf8'), { window: root });
  expect(root.VcPanel, 'VC rules module missing').toBeDefined();
  return root.VcPanel;
}
describe('VC source content and rules', () => {
  it('registers a six-round scenario and five anchored equal cores', () => {
    expect(getScenario('hostile_vc_v1').steps).toHaveLength(6);
    const r = getRubric('hostile_vc_v1');
    expect(r.dimensions.map(d => d.key)).toEqual(['relevance', 'evidence', 'financial', 'risk', 'clarity']);
    for (const d of r.dimensions) expect(Object.keys(d.levels)).toEqual(['1', '2', '3', '4', '5']);
  });
  it('uses 45 seconds and spoken English/Cantonese numeric cues', () => {
    const r = rules();
    expect(r.cue('Our customers like it', 44, 'en', false)).toBeNull();
    expect(r.cue('Our customers like it', 45, 'en', false)).toBe('numbers');
    for (const text of ['twenty customers', 'one hundred HK dollars', '10 users', 'zero revenue', '十個客', '兩百蚊', '零收入']) expect(r.hasNumeric(text)).toBe(true);
    expect(r.cue('twenty customers', 46, 'en', false)).toBeNull();
    for (const text of ['一直努力', '一起合作', '有一些回饋', '唯一方案']) expect(r.hasNumeric(text)).toBe(false);
    expect(r.hasNumeric('一點五萬')).toBe(true);
    expect(r.cue('Our customers like it', 50, 'en', true)).toBeNull();
  });
  it('requires explicit competition and market-size claims without misreading negation or sources', () => {
    const r = rules();
    expect(r.cue('We have no competitors', 2, 'en', false)).toBe('competition');
    expect(r.cue('I do not claim we have no competitors', 2, 'en', false)).toBeNull();
    expect(r.cue('我哋冇競爭對手', 2, 'zh-HK', false)).toBe('competition');
    expect(r.cue('唔係話我哋冇競爭對手', 2, 'zh-HK', false)).toBeNull();
    expect(r.cue('The market size is ten billion', 2, 'en', false)).toBe('source');
    expect(r.cue('According to our survey, the market size is ten billion', 2, 'en', false)).toBeNull();
    expect(r.cue('市場規模有十億', 2, 'zh-HK', false)).toBe('source');
    expect(r.cue('根據政府報告，市場規模有十億', 2, 'zh-HK', false)).toBeNull();
    expect(r.cue('The market size is ten billion, but we have no source.', 2, 'en', false)).toBe('source');
    expect(r.cue('市場規模有十億，但我哋冇資料來源。', 2, 'zh-HK', false)).toBe('source');
  });
  it('keeps unknown finances null and computes only available arithmetic', () => {
    const r = rules();
    const c = r.context({ name: 'Acme', industry: 'SaaS', stage: 'seed', pitch: 'hello', cac: '', ltv: '100', monthlyBurn: '', runway: '' });
    expect(c.cac).toBeNull(); expect(c.monthlyBurn).toBeNull(); expect(c.ltv).toBe(100);
    expect(r.arithmetic(c)).toEqual({});
    expect(r.arithmetic({ cac: 20, ltv: 100, monthlyBurn: 10, runway: 3 })).toEqual({ ltvCacRatio: 5 });
    expect(r.arithmetic({ cac: 1e-300, ltv: 1e12 })).toEqual({});
  });
  it('requires English or conservatively compatible Cantonese moderation', () => {
    const r = rules();
    expect(r.questionCompatible('请介绍你的公司，并说明你们的商业计划。', 'zh-HK')).toBe(false);
    expect(r.questionCompatible('請介紹你的公司，並說明你們的商業計劃。', 'zh-HK')).toBe(false);
    expect(r.questionCompatible('你哋嘅方案有咩證據支持？', 'zh-HK')).toBe(true);
    expect(r.questionCompatible('What evidence supports your plan?', 'en')).toBe(true);
    expect(r.questionCompatible('你哋有咩計劃？', 'en')).toBe(false);
  });
  it('does not count unassessed demonstration as scored milestone evidence', () => {
    expect(reportScore({ scenarioId: 'hostile_vc_v1', report: { dimensions: [{ score: 1 }], metrics: { vcScoringVersion: 1, coreRated: 0 } } } as any)).toBeNull();
    expect(reportScore({ scenarioId: 'hostile_vc_v1', report: { dimensions: [{ score: 1 }], metrics: { vcScoringVersion: 1, coreRated: 2, coreAverage: 4 } } } as any)).toBe(4);
  });
});
