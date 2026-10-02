const { timingSafeEqual } = require('node:crypto');
const styles = require('./voice-styles.cjs');
const requests = new Map();

function send(res, status, message) {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify({ error: message }));
}

module.exports = async function generate(req, res) {
  if (req.method !== 'POST') return send(res, 405, 'Método no permitido');
  const secret = process.env.VOICE_PREVIEW_TOKEN || '';
  const supplied = String(req.headers?.authorization || '').replace(/^Bearer /, '');
  const expectedBytes = Buffer.from(secret);
  const suppliedBytes = Buffer.from(supplied);
  if (!secret || expectedBytes.length !== suppliedBytes.length || !timingSafeEqual(expectedBytes, suppliedBytes)) {
    return send(res, 401, 'Acceso denegado');
  }
  const expires = Number(secret.split('.')[1]);
  if (!Number.isFinite(expires) || Date.now() > expires) return send(res, 403, 'Acceso vencido');
  const id = String(req.body?.sample || '');
  if (!Object.hasOwn(styles, id)) return send(res, 400, 'Muestra inválida');
  if (!process.env.OPENAI_API_KEY) return send(res, 503, 'Voz no configurada');

  // Only authenticated, fixed samples. Identical requests share one generation.
  if (!requests.has(id)) {
    requests.set(id, (async () => {
      const style = styles[id];
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST', signal: AbortSignal.timeout(45000),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: style.model, voice: style.voice, input: style.text,
          instructions: style.instructions, response_format: 'mp3'
        })
      });
      if (!response.ok) throw new Error(`provider_${response.status}`);
      const audio = Buffer.from(await response.arrayBuffer());
      if (audio.length < 1000) throw new Error('empty_audio');
      return audio;
    })());
  }
  try {
    const audio = await requests.get(id);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audio.length);
    res.setHeader('Cache-Control', 'no-store');
    res.end(audio);
  } catch (error) {
    return send(res, 502, error.message.startsWith('provider_') ? error.message : 'audio_unavailable');
  }
};
