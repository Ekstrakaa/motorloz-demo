const text = '¿Un golpeteo después de un pozo? Ta, contame un poquito más. ¿Lo sentís al doblar o cuando agarrás otra irregularidad? Puede venir de distintas partes de la suspensión. Con eso solo no te puedo decir qué se dañó, pero sí ayudarte a ordenar lo que conviene revisar.';

const base = 'Interpret this as one person speaking directly to another in a small workshop. Speak entirely in native Uruguayan Rioplatense Spanish, using the voseo and pronunciation in the script. Adult male voice. Deliver the supplied words exactly once. The client is worried: acknowledge that with attentive, measured concern, then explain clearly and calmly. The opening is a genuine question, not a greeting. The final sentence reassures without promising a diagnosis. Keep technical Spanish words intelligible. Let sentence lengths and intention shape the rhythm.';

module.exports = Object.freeze({
  1: {
    voice: 'ballad', model: 'gpt-4o-mini-tts', label: 'Cercano y tranquilo', text,
    instructions: `${base} Delivery: an informal, warm conversation with a familiar client. Relaxed mid-register, soft phrase endings, slight smile only in the invitation to explain. Ask the second question with real curiosity. Leave a short thinking pause before the explanation. Keep the pace natural rather than slow.`
  },
  2: {
    voice: 'fable', model: 'gpt-4o-mini-tts', label: 'Expresivo y atento', text,
    instructions: `${base} Delivery: a lively but grounded workshop advisor. Make the first question carry a small, authentic reaction of concern. Use flexible pitch and conversational emphasis on the differences between turning and road irregularities. Explain with energy, then settle into a calm reassuring ending. A spontaneous spoken exchange, without theatrical acting.`
  },
  3: {
    voice: 'cedar', model: 'gpt-4o-mini-tts', label: 'Mecánico experimentado', text,
    instructions: `${base} Delivery: a mature mechanic, thoughtful and confident, speaking at normal conversational speed. A grounded lower register, concise phrase endings, modest breath between ideas. The questions sound attentive and practical. Pause briefly at the diagnostic uncertainty, then finish with helpful warmth. Keep a varied conversational cadence, not a lecture.`
  }
});
