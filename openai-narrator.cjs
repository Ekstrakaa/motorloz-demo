const selected = require('./voice-styles.cjs')[1];
const instructions = `${selected.instructions}\nEl taller MOTORLOZ se pronuncia Motor Los, dos palabras, nunca Motorola. Respetá el contenido del mensaje y su intención: en saludos y explicaciones comunes hablá con cercanía y vivacidad; expresá preocupación moderada solo si el texto describe un problema. Mantené un ritmo conversado y fluido, sin silencios largos.`;

async function request(text, format, signal) {
  const upstream = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: selected.model, voice: selected.voice, input: text, instructions, speed: 1.14, response_format: format })
  });
  if (!upstream.ok) {
    const detail = await upstream.json().catch(() => ({}));
    throw Object.assign(new Error('openai_speech_failed'), {
      upstreamStatus: upstream.status, upstreamCode: detail.error?.code || 'voice_unavailable'
    });
  }
  return upstream;
}

function connection(req, res) {
  const controller = new AbortController();
  let gone = false;
  const disconnected = () => { gone = true; controller.abort(); };
  req.on?.('aborted', disconnected);
  res.on?.('close', disconnected);
  const timeout = setTimeout(() => controller.abort(), 25000);
  return {
    controller,
    disconnected: () => gone,
    cleanup() { clearTimeout(timeout); req.off?.('aborted', disconnected); res.off?.('close', disconnected); }
  };
}

async function generateSpeech(text, req, res) {
  const active = connection(req, res);
  try {
    const upstream = await request(text, 'wav', active.controller.signal);
    const wav = Buffer.from(await upstream.arrayBuffer());
    if (wav.length < 44 || wav.subarray(0, 4).toString() !== 'RIFF') throw new Error('openai_speech_empty');
    return wav;
  } finally { active.cleanup(); }
}

async function streamSpeech(text, req, res) {
  const active = connection(req, res);
  let started = false;
  const firstAudioTimeout = setTimeout(() => { if (!started) active.controller.abort(); }, 7500);
  try {
    const upstream = await request(text, 'pcm', active.controller.signal);
    if (!upstream.body) throw new Error('openai_speech_empty');
    for await (const chunk of upstream.body) {
      if (active.controller.signal.aborted || res.destroyed) return;
      if (!chunk.length) continue;
      if (!started) {
        started = true;
        clearTimeout(firstAudioTimeout);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store, no-transform');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Voice-Provider', 'openai');
        res.setHeader('X-Voice', selected.voice);
      }
      // Keep the existing browser's 24 kHz mono PCM playback protocol.
      const event = { event_type: 'step.delta', delta: { type: 'audio', data: Buffer.from(chunk).toString('base64') } };
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    if (!started) throw new Error('openai_speech_empty');
    if (!res.destroyed) res.end();
  } catch (error) {
    if (active.disconnected() || req.aborted || res.destroyed) return;
    if (started) {
      res.write(`data: ${JSON.stringify({ event_type: 'error', error: { code: 'voice_interrupted' } })}\n\n`);
      res.end();
      return;
    }
    throw error;
  } finally { clearTimeout(firstAudioTimeout); active.cleanup(); }
}

module.exports = { generateSpeech, streamSpeech, voice: selected.voice, model: selected.model };
