/** Pure VC context and transcript rules. Loudness never determines content. */
(function (root) {
  'use strict';
  const roles = ['numbers', 'vision', 'legal'];
  function hasNumeric(text) {
    return /\d|\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|percent)\b|[零〇一二兩三四五六七八九十百千萬億]+(?:點[零一二三四五六七八九]+)?(?:萬|億|個|位|間|蚊|元|倍|成|收入|客|月|年|日)|[二兩三四五六七八九][十百千萬億]/i.test(text);
  }
  function cue(text, seconds, lang, used) {
    if (used || typeof text !== 'string' || !text.trim()) return null;
    const claim = text.replace(/[^.!?。！？]*(?:do not claim|don't claim|not saying|not true that|唔係話|唔係冇|不是說)[^.!?。！？]*/gi, '');
    if (/\b(?:no competitors|no competition|without competitors)\b|冇競爭對手|沒有競爭對手|無競爭對手/i.test(claim)) return 'competition';
    const sourceDenied = /\b(?:no|without)\s+(?:(?:a|any|stated|known|data)\s+)*source\b|\b(?:don't|do not)\s+have\s+(?:a\s+)?source\b|(?:冇|沒有)(?:資料|數據)?來源|來源(?:未提供|不明|未知)/i.test(claim);
    if (/\b(?:market size|total addressable market|TAM)\b|市場規模|市場總量/i.test(claim)
      && hasNumeric(claim) && (sourceDenied || !/\b(?:according to|source|survey|research|report|study|estimate from)\b|根據|來源|調查|報告|研究|出處/i.test(claim))) return 'source';
    if (seconds >= 45 && !hasNumeric(text)) return 'numbers';
    return null;
  }
  function questionCompatible(text, lang) {
    if (typeof text !== 'string') return false;
    if (lang === 'en') return !/[\u3400-\u9fff]/.test(text);
    return /咩|唔|嘅|哋|咗|喺|啲|點|邊|幾|乜|講下/.test(text) && !/[请们这说为吗么]|介绍|商业|问题|竞争|数据/.test(text);
  }
  function context(values) {
    const out = {};
    for (const [key, max] of [['name', 60], ['industry', 60], ['stage', 20], ['pitch', 1200], ['deckText', 12000]]) out[key] = String(values[key] || '').trim().slice(0, max);
    if (!['pre_seed', 'seed', 'series_a'].includes(out.stage)) out.stage = 'pre_seed';
    for (const key of ['cac', 'ltv', 'monthlyBurn', 'runway']) {
      const raw = values[key];
      const value = raw === '' || raw === null || raw === undefined ? null : Number(raw);
      if (value !== null && (!Number.isFinite(value) || value < 0 || value > (key === 'runway' ? 1200 : 1e12))) throw new Error('Invalid financial value');
      out[key] = value;
    }
    return out;
  }
  function arithmetic(c) {
    const out = {};
    if (c.cac !== null && c.cac > 0 && c.ltv !== null && Number.isFinite(c.ltv / c.cac)) out.ltvCacRatio = c.ltv / c.cac;
    return out;
  }
  root.VcPanel = { roles, hasNumeric, cue, questionCompatible, context, arithmetic };
})(window);
