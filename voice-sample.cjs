const SAMPLE_TEXT = 'Bien, entiendo la preocupación. Si el Subaru Impreza empezó con un golpeteo después de agarrar un pozo, conviene revisarlo. No significa necesariamente que sea algo grave. ¿El ruido aparece al doblar, al frenar o cuando pasás por una calle irregular?';

const SAMPLES = Object.freeze({
  1: { voice: 'ash' },
  2: { voice: 'echo' },
  3: { voice: 'verse' }
});

const INSTRUCTIONS = 'Leé exactamente el texto recibido. Usá una voz masculina adulta y hablá siempre en español rioplatense natural de Montevideo. Soná como un asesor humano de un taller: cálido, sereno, atento y profesional. En la primera frase transmití que comprendés la preocupación sin dramatizar. Hacé pausas breves y naturales, variá sutilmente la entonación y formulá la pregunta final con interés auténtico. Evitá el tono robótico, plano, publicitario, de locutor o de central telefónica. No exageres el acento y no agregues palabras.';

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
        instructions: INSTRUCTIONS,
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
