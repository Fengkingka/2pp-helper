/* Questionnaire draft compatibility helpers. */
(function (root) {
  'use strict';
  function questionnaireKey(q) {
    return JSON.stringify([q.id, q.version, q.items.map(i => [i.id, i.keyed, i.text, i.textEn])]);
  }
  function resumeQuestionnaire(q, draft, legacy) {
    const matched = draft && draft.key === questionnaireKey(q);
    const raw = matched ? draft.answers : (!draft ? legacy : {});
    const answers = Object.fromEntries(q.items.filter(i => Number.isInteger(raw?.[i.id]) && raw[i.id] >= 1 && raw[i.id] <= 5)
      .map(i => [i.id, raw[i.id]]));
    const last = Math.ceil(q.items.length / q.pageSize) - 1;
    return { answers, page: matched && Number.isInteger(draft.page) ? Math.max(0, Math.min(last, draft.page)) : 0,
      retaking: !!(matched && draft.retaking) };
  }
  function validStrengths(s) {
    return !!s && s.demo !== true && s.scores && ['positivity', 'dependability', 'mastery'].every(k =>
      Number.isFinite(s.scores[k]) && s.scores[k] >= 1 && s.scores[k] <= 5);
  }
  function strengthLeaders(scores) {
    const entries = Object.entries(scores).map(([k, v]) => [k, Math.round(v * 10)]);
    const max = Math.max(...entries.map(([, v]) => v));
    return entries.filter(([, v]) => v === max).map(([k]) => k);
  }
  const api = { questionnaireKey, resumeQuestionnaire, validStrengths, strengthLeaders };
  root.J1Journey = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
