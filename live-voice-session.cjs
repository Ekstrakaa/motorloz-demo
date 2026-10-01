const LIVE_VOICES = Object.freeze({
  a: 'ripple',
  b: 'vesper',
  c: 'meridian'
});

const BASE_INSTRUCTIONS = 'Sos la voz masculina adulta de MOTORLOZ, un taller de Montevideo. Hablá solamente en español rioplatense uruguayo. Soná humano, cálido y atento; reaccioná con preocupación contenida cuando alguien describe un problema del auto. Usá respiraciones, micro pausas y cambios naturales de ritmo. Nunca uses tono de locutor, publicidad, central telefónica ni lectura robótica. Pronunciá MOTORLOZ como Motor Los.';

function authorized(req) {
  const expected = process.env.VOICE_PREVIEW_TOKEN;
  const supplied = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
  return Boolean(expected && supplied && expected.length === supplied.length && require('node:crypto').timingSafeEqual(Buffer.from(expected), Buffer.from(supplied)));
}

async function liveVoiceSession(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    return res.end('Method Not Allowed');
  }

  const expectedOrigin = 'https://motorloz-demo.vercel.app';
  if (req.headers?.origin && req.headers.origin !== expectedOrigin) {
    res.statusCode = 403;
    return res.end(JSON.stringify({ error: 'Origen no permitido' }));
  }
  if (!authorized(req)) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'Enlace de prueba no autorizado' }));
  }

  const sample = String(req.body?.sample || '');
  const voice = LIVE_VOICES[sample];
  const sdp = req.body?.sdp;
  if (!voice || typeof sdp !== 'string' || !sdp.trim() || sdp.length > 65536) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'Prueba inválida' }));
  }
  if (!process.env.OPENAI_API_KEY) {
    res.statusCode = 503;
    return res.end(JSON.stringify({ error: 'OpenAI no está configurado' }));
  }

  try {
    const upstream = await fetch('https://api.openai.com/v1/live/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        session: {
          model: 'gpt-live-1',
          instructions: BASE_INSTRUCTIONS,
          audio: { output: { voice } },
          delegation: { type: 'client' },
          store: false
        },
        transport: { type: 'webrtc', sdp }
      })
    });
    const result = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error('OpenAI Live sample error:', upstream.status, result.error?.code || result.error?.type || 'unknown');
      res.statusCode = upstream.status === 429 ? 429 : 502;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ error: upstream.status === 429 ? 'Límite temporal de voz' : 'No se pudo abrir la prueba Live' }));
    }
    res.statusCode = 201;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(JSON.stringify(result));
  } catch (error) {
    console.error('OpenAI Live session request failed:', error?.message || 'unknown');
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'No se pudo abrir la prueba Live' }));
  }
}

module.exports = liveVoiceSession;
module.exports.LIVE_VOICES = LIVE_VOICES;
module.exports.BASE_INSTRUCTIONS = BASE_INSTRUCTIONS;
