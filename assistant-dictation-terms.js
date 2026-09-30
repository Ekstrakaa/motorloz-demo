'use strict';

// Keep corrections narrow: an ordinary word or another car make must never be
// rewritten merely because it sounds similar to a Subaru model.
const motorlozDictation = (() => {
  const subaruContext = text => /\b(?:subaru|impreza|hawkeye)\b/i.test(text);

  function normalize(text, context = '') {
    let result = String(text || '').trim();
    if (!subaruContext(`${context} ${result}`)) return result;
    result = result.replace(/\bsubaru\s+(?:impresa|empresa)\b/gi, 'Subaru Impreza');
    result = result.replace(/\b(?:hawkei|hockey|hawk\s*eye)\b/gi, 'Hawkeye');
    result = result.replace(/\b(?:vag[oó]n|guat[oó]n)\b/gi, 'Wagon');
    result = result.replace(/\b((?:Impreza|Hawkeye|modelo|versi[oó]n|carrocer[ií]a)\s+)cag[oó]n\b/gi, '$1Wagon');
    return result;
  }

  function choose(result, context = '') {
    const candidates = result?.length == null && result?.[0] ? [result[0]] : Array.from(result || []);
    const alternatives = candidates.map(item => String(item?.transcript || '').trim()).filter(Boolean);
    if (!alternatives.length) return '';
    if (subaruContext(context)) {
      const specialist = alternatives.find(item => /\b(?:impreza|hawkeye|hawkei|hawk\s*eye|wagon)\b/i.test(item));
      if (specialist) return normalize(specialist, context);
    }
    return normalize(alternatives[0], context);
  }

  return { normalize, choose };
})();

if (typeof window !== 'undefined') window.MOTORLOZ_DICTATION = motorlozDictation;
