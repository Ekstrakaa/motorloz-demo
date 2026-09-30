const MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-3.5-flash-lite';
const SPEECH_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-lite-tts';
const SPEECH_VOICE = process.env.GEMINI_TTS_VOICE || 'Algieba';
const SYSTEM_PROMPT = `Sos el asistente virtual de recepción de MOTORLOZ, taller multimarca en Montevideo. Conversá en español rioplatense, con calidez y naturalidad. Recordá el hilo: respondé a lo último que dijo la persona y no repitas preguntas ni datos ya aportados. La bienvenida ya pidió marca, modelo, kilometraje y síntomas. Si solo te saludan, devolvé el saludo y preguntá qué le pasa al auto; no sugieras traerlo ni reservar. Si cuentan un problema, reconocé el síntoma en pocas palabras y hacé una sola pregunta útil para entenderlo mejor. Respondé en una o dos frases breves, idealmente menos de 220 caracteres, sin listas ni diagnósticos inventados. No repitas mecánicamente “traelo al taller” ni propongas turno o reserva antes de que la persona lo pida o de que ya hayan aclarado el motivo de consulta. Cuando la persona quiera coordinar, explicá brevemente que puede tocar “Hacer reserva ahora” para preparar el mensaje al taller. No asegures precios, presupuestos, promesas ni disponibilidad. Si hay humo abundante, olor fuerte a combustible, falla de frenos, sobrecalentamiento o pérdida de dirección, priorizá la seguridad: indicá detenerse en un lugar seguro, no seguir conduciendo y pedir asistencia. No indiques abrir el sistema de refrigeración caliente. Nunca pidas datos personales en el chat; se solicitan después de tocar “Hacer reserva ahora”. Para otros temas, explicá con amabilidad que el chat es para consultas del vehículo y MOTORLOZ.`;
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

async function callGemini(contents, { maxOutputTokens = 768, systemInstruction = SYSTEM_PROMPT, models = [MODEL, 'gemini-3.8-flash', 'gemini-3.7-flash'] } = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw Object.assign(new Error('not_configured'), { status: 503 });
  models = [...new Set(models)];
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
              ...(model.startsWith('gemini-3') ? { thinkingConfig: { thinkingLevel: model.includes('flash-lite') ? 'minimal' : 'low' } } : {})
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
        annotations: [{ type: 'speech_metadata', style: 'Leé exactamente el texto recibido, sin agregar ni omitir palabras. Español rioplatense de Montevideo. Voz cálida, natural y cercana, ritmo conversacional tranquilo; sin tono robótico ni locución publicitaria.' }]
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
    let maxOutputTokens = action === 'summary' ? 768 : 768;

    if (action === 'summary') {
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
