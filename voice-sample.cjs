const SAMPLE_TEXT = 'Bien, entiendo la preocupación.\n\nSi el Subaru Impreza empezó con un golpeteo después de agarrar un pozo, conviene revisarlo. No significa necesariamente que sea algo grave.\n\n¿El ruido aparece al doblar, al frenar o cuando pasás por una calle irregular?';

const SAMPLES = Object.freeze({
  '1a': {
    voice: 'ash',
    speed: 0.97,
    direction: 'Decilo como una charla cara a cara. La cadencia no debe ser perfectamente regular: tomá aire antes de explicar, bajá apenas la voz al tranquilizar y dejá que la pregunta final nazca de una preocupación real.'
  },
  '1b': {
    voice: 'ash',
    speed: 0.93,
    direction: 'Interpretalo como un mecánico experimentado que primero piensa y después responde. Usá silencios cortos, una voz más íntima y una leve duda reflexiva antes de decir que no necesariamente es algo grave.'
  },
  '2a': {
    voice: 'echo',
    speed: 0.96,
    direction: 'Hablale a una persona que está preocupada por su auto. Mostrá empatía auténtica al comienzo, seguridad tranquila durante la explicación y curiosidad sincera en la pregunta final. Evitá una melodía repetitiva.'
  }
});

const INSTRUCTIONS = 'Conservá las palabras del texto, pero no lo leas como un guion: decilo como una respuesta espontánea. Usá una voz masculina adulta y español rioplatense natural de Montevideo. Soná cálido, sereno, atento y profesional. Permití micro pausas, respiraciones discretas y variaciones sutiles de ritmo y volumen. Evitá el tono robótico, plano, publicitario, de locutor o de central telefónica. No exageres el acento, no cantes y no agregues palabras.';

module.exports = async function voiceSample(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
    return res.end('Method Not Allowed');
  }

  const sampleId = String(req.query?.sample || new URL(req.url, 'https://motorloz.local').searchParams.get('sample') || '');
  const sample = SAMPLES[sampleId];
  if (!sample) {
    res.statusCode = 404;
    return res.end('Muestra no disponible');
  }
  if (!process.env.OPENAI_API_KEY) {
    res.statusCode = 503;
    return res.end('La voz de prueba no está configurada');
  }

  try {
    const upstream = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_SPEECH_MODEL || 'gpt-4o-mini-tts',
        voice: sample.voice,
        input: SAMPLE_TEXT,
        instructions: `${INSTRUCTIONS} ${sample.direction}`,
        speed: sample.speed,
        response_format: 'mp3'
      })
    });

    if (!upstream.ok) {
      const error = await upstream.json().catch(() => ({}));
      console.error('OpenAI voice sample error:', upstream.status, error.error?.code || error.error?.type || 'unknown');
      res.statusCode = upstream.status === 429 ? 429 : 502;
      return res.end(upstream.status === 429 ? 'La cuenta alcanzó su límite temporal de audio' : 'No se pudo generar esta muestra');
    }

    const audio = Buffer.from(await upstream.arrayBuffer());
    res.statusCode = 200;
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audio.length);
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.end(audio);
  } catch (error) {
    console.error('OpenAI voice sample request failed:', error?.message || 'unknown');
    res.statusCode = 502;
    return res.end('No se pudo generar esta muestra');
  }
};

module.exports.SAMPLES = SAMPLES;
module.exports.SAMPLE_TEXT = SAMPLE_TEXT;
module.exports.INSTRUCTIONS = INSTRUCTIONS;
