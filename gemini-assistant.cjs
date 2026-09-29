const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const SPEECH_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-lite-tts';
const SPEECH_VOICE = process.env.GEMINI_TTS_VOICE || 'Algieba';
const SYSTEM_PROMPT = `Sos el asistente virtual de recepción de MOTORLOZ, taller multimarca en Montevideo. Respondé en español rioplatense, con calidez y naturalidad, como una persona que escucha de verdad. Entendé errores de escritura y mensajes de voz. La bienvenida ya pidió marca, modelo y kilometraje del auto, y qué notó; aprovechá lo que la persona diga y no vuelvas a pedir datos que ya aportó. En cada respuesta, reflejá brevemente lo que entendiste —sin mostrar una transcripción literal del audio— para que sepa que su explicación llegó. Mantené respuestas concretas, de 1 a 3 frases: nada de listas numeradas, pasos, biblias ni enumeraciones de causas. Podés explicar en una frase que los síntomas pueden tener más de una causa, sin asegurar piezas ni diagnósticos; hacé como máximo una pregunta breve y útil si falta un dato importante. Si no hay señales de peligro, respondé con calma y empatía. No des precios, presupuestos ni promesas. Orientá con naturalidad a una revisión presencial en MOTORLOZ, sin presionar ni inventar servicios, garantías o disponibilidad. Si hay humo abundante o continuo, olor fuerte a combustible, frenos que fallan, sobrecalentamiento, pérdida de dirección u otra señal peligrosa, priorizá la seguridad: indicá detenerse en un lugar seguro, apagar el motor cuando corresponda, no seguir conduciendo y pedir asistencia; nunca asustes con costos. No indiques abrir un sistema de refrigeración caliente. Nunca pidas nombre, teléfono, correo ni otros datos personales durante el chat; se solicitan únicamente después de que la persona toque “Hacer reserva ahora”. No alargues la charla para obtener datos que se completan en la reserva. Para otros temas, explicá amablemente que este chat es para consultas del vehículo y MOTORLOZ. Cuando el contexto esté claro, invitá a hacer una reserva para que el taller revise el vehículo.`;
const rateLimits = new Map();

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(data));
}

function allowed(req, action) {
  const ip = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const bucket = `${action}:${ip}`;
  const now = Date.now();
  const windowMs = action === 'chat' ? 60_000 : 60 * 60_000;
  const limit = action === 'chat' ? 12 : action === 'summary' ? 4 : action.startsWith('speech') ? 48 : 6;
  const recent = (rateLimits.get(bucket) || []).filter(time => now - time < windowMs);
  if (recent.length >= limit) return false;
  recent.push(now);
  rateLimits.set(bucket, recent);
  if (rateLimits.size > 1000) {
    for (const [key, times] of rateLimits) {
      if (!times.length || now - times[times.length - 1] > windowMs) rateLimits.delete(key);
    }
  }
  return true;
}

function cleanHistory(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.slice(-12)
    .filter(item => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string')
    .map(item => ({ role: item.role === 'assistant' ? 'model' : 'user', parts: [{ text: item.content.trim().slice(0, 1200) }] }))
    .filter(item => item.parts[0].text);
}

async function callGemini(contents, { maxOutputTokens = 1536, systemInstruction = SYSTEM_PROMPT } = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw Object.assign(new Error('not_configured'), { status: 503 });
  const models = [...new Set([MODEL, 'gemini-3.7-flash', 'gemini-3.6-flash'])];
  let lastError = new Error('gemini_output_truncated');
  for (const model of models) {
    for (const tokenLimit of [maxOutputTokens, maxOutputTokens * 2]) {
      let upstream;
      try {
        upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents,
            generationConfig: {
              maxOutputTokens: tokenLimit,
              ...(model.startsWith('gemini-3') ? { thinkingConfig: { thinkingLevel: 'low' } } : {})
            }
          })
        });
      } catch (error) {
        lastError = error;
        break;
      }
      const result = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        const error = new Error('gemini_request_failed');
        error.upstreamStatus = upstream.status;
        error.upstreamCode = result.error?.status || result.error?.code || 'unknown';
        if ([404, 500, 502, 503, 504].includes(upstream.status) || error.upstreamCode === 'UNAVAILABLE') {
          lastError = error;
          break;
        }
        throw error;
      }
      const candidate = result.candidates?.[0];
      if (candidate?.finishReason === 'MAX_TOKENS') {
        lastError = new Error('gemini_output_truncated');
        continue;
      }
      const reply = (candidate?.content?.parts || []).filter(part => !part.thought).map(part => part.text || '').join('').trim();
      if (reply) return reply;
      lastError = new Error('gemini_empty_reply');
      break;
    }
  }
  throw lastError;
}

async function requestSpeech(text, stream = false) {
  return fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      model: SPEECH_MODEL,
      input: [{ type: 'user_input', content: [{
        type: 'text', text,
        annotations: [{ type: 'speech_metadata', style: 'Español rioplatense de Montevideo. Voz cálida, natural y cercana, ritmo conversacional tranquilo; sin tono robótico ni locución publicitaria.' }]
      }] }],
      response_format: { type: 'audio' },
      generation_config: { speech_config: [{ voice: SPEECH_VOICE }] },
      ...(stream ? { stream: true } : {})
    })
  });
}

async function generateSpeech(text) {
  const upstream = await requestSpeech(text);
  const result = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const error = new Error('gemini_speech_failed');
    error.upstreamStatus = upstream.status;
    error.upstreamCode = result.error?.status || result.error?.code || 'unknown';
    throw error;
  }
  const audio = (result.steps || []).flatMap(step => step.content || []).filter(part => part.type === 'audio' && part.data).at(-1);
  const wav = audio && Buffer.from(audio.data, 'base64');
  if (!wav || wav.subarray(0, 4).toString() !== 'RIFF') throw new Error('gemini_speech_empty');
  return wav;
}

async function streamSpeech(text, res) {
  const upstream = await requestSpeech(text, true);
  if (!upstream.ok) {
    const result = await upstream.json().catch(() => ({}));
    const error = new Error('gemini_speech_failed');
    error.upstreamStatus = upstream.status;
    error.upstreamCode = result.error?.status || result.error?.code || 'unknown';
    throw error;
  }
  if (!upstream.body) throw new Error('gemini_speech_stream_empty');
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-transform');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.flushHeaders?.();
  try {
    for await (const chunk of upstream.body) res.write(chunk);
    res.end();
  } catch (error) {
    console.error('Gemini speech stream error:', error.message || 'unknown');
    res.end();
  }
}

function userMessage(message) {
  return [{ role: 'user', parts: [{ text: message }] }];
}

async function handle(req, res, action) {
  if (req.method !== (action === 'status' ? 'GET' : 'POST')) {
    json(res, 405, { error: 'metodo_no_permitido', message: 'Método no permitido.' });
    return;
  }
  if (action === 'status') {
    json(res, 200, { configured: Boolean(process.env.GEMINI_API_KEY), model: MODEL });
    return;
  }
  if (!process.env.GEMINI_API_KEY) {
    json(res, 503, { error: 'asistente_no_configurado', message: 'La IA todavía no está conectada. Podés usar el formulario de contacto.' });
    return;
  }
  if (!allowed(req, action)) {
    json(res, 429, { error: 'limite_temporal', message: 'Esperá un momento antes de enviar otro mensaje.' });
    return;
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if (action === 'speech' || action === 'speech-stream') {
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      if (!text || text.length > 700) {
        json(res, 400, { error: 'texto_invalido', message: 'No pude leer ese mensaje.' });
        return;
      }
      if (action === 'speech-stream') {
        await streamSpeech(text, res);
        return;
      }
      const wav = await generateSpeech(text);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Length', wav.length);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.end(wav);
      return;
    }
    const history = cleanHistory(body.messages);
    let contents;
    let maxOutputTokens = action === 'summary' ? 768 : 1536;

    if (action === 'voice') {
      const audio = typeof body.audio === 'string' ? body.audio : '';
      if (!audio || audio.length > 4_000_000) {
        json(res, 400, { error: 'audio_invalido', message: 'No pude procesar esta nota de voz. Probá grabarla otra vez o escribí tu consulta.' });
        return;
      }
      contents = [...history, { role: 'user', parts: [
        { text: 'Escuchá este mensaje de voz y respondé en texto dentro del chat. No devuelvas una transcripción literal; entendé la consulta y continuá la conversación como recepción de MOTORLOZ.' },
        { inlineData: { mimeType: 'audio/wav', data: audio } }
      ] }];
    } else if (action === 'summary') {
      if (!history.length) {
        json(res, 400, { error: 'resumen_invalido', message: 'No hay conversación para resumir.' });
        return;
      }
      contents = userMessage(`Prepará para el mecánico de MOTORLOZ un único párrafo breve, máximo 2 frases y 500 caracteres. Incluí marca, modelo, año y kilometraje solo si la persona los mencionó; resumí en sus palabras qué ocurrió, síntomas, cuándo aparecen y detalles que aclaró. No diagnostiques ni inventes causas, piezas, datos del vehículo o gravedad. No incluyas nombres, teléfonos, matrículas, precios ni consejos nuevos. Esta es una síntesis de recepción, no un diagnóstico.\n\nConversación:\n${body.messages.slice(-12).map(item => `${item.role === 'assistant' ? 'Asistente' : 'Cliente'}: ${String(item.content || '').slice(0, 1200)}`).join('\n')}`);
    } else if (action === 'chat') {
      if (!history.length || history[history.length - 1].role !== 'user') {
        json(res, 400, { error: 'mensaje_invalido', message: 'Escribí una consulta para continuar.' });
        return;
      }
      contents = history;
    } else {
      json(res, 404, { error: 'no_encontrado' });
      return;
    }

    const reply = await callGemini(contents, { maxOutputTokens });
    if (!reply) {
      json(res, 502, { error: 'respuesta_vacia', message: 'No pude armar una respuesta ahora. Intentá de nuevo.' });
      return;
    }
    if (action === 'summary') json(res, 200, { summary: reply.slice(0, 520) });
    else json(res, 200, { reply });
  } catch (error) {
    if (error.status === 503) {
      json(res, 503, { error: 'asistente_no_configurado', message: 'La IA todavía no está conectada. Podés usar el formulario de contacto.' });
    } else if (error.upstreamStatus === 429) {
      json(res, 429, { error: 'cuota_gemini_alcanzada', message: 'El asistente alcanzó su límite gratuito por ahora. Probá de nuevo más tarde.' });
    } else {
      console.error('Gemini assistant error:', error.upstreamStatus || 'unknown', error.upstreamCode || error.message || 'unknown');
      json(res, 502, { error: 'respuesta_no_disponible', message: 'No pude responder ahora. Intentá de nuevo o usá el formulario del taller.', reason: error.upstreamCode || error.message || 'unknown' });
    }
  }
}

module.exports = { handle };
