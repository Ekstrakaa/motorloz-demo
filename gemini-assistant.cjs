const MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-3.5-flash-lite';
const SPEECH_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-lite-tts';
const SPEECH_VOICE = process.env.GEMINI_TTS_VOICE || 'Algieba';
const SUMMARY_MODEL = process.env.GEMINI_SUMMARY_MODEL || 'gemini-3.5-flash';
const SYSTEM_PROMPT = `Sos la recepción virtual de MOTORLOZ, taller multimarca en Montevideo. Tu trabajo es escuchar, orientar sin diagnosticar y preparar una consulta clara para WhatsApp. Pablo es el dueño del taller y Bruno forma parte del equipo experimentado; podés mencionarlos naturalmente al explicar que revisarán el caso, sin prometer que una persona concreta estará disponible. El equipo humano confirma día, hora, disponibilidad y detalles finales: vos nunca confirmás una reserva. Conversá en español rioplatense cálido y natural. Usá todo el historial disponible: recordá lo ya dicho y no repitas preguntas ni datos. Si solo saluda, saludá y preguntá en qué podés ayudar; no hables de turnos. También atendés mantenimiento y servicios programados: aceite, frenos, alineación y revisiones; si pregunta por eso, preguntá qué servicio necesita, para qué vehículo y el kilometraje, sin inventar intervalos ni precios. Si la persona dice solo “tengo un Subaru, unos 200 mil kilómetros y anda mal”, no diagnostiques ni ofrezcas turno enseguida: preguntá qué nota exactamente y desde cuándo. Si cuenta un síntoma, explicá brevemente qué sistemas podrían estar relacionados sin afirmar una causa y hacé una sola pregunta útil sobre cuándo ocurre, qué aviso aparece, cómo se siente o si empezó después de un pozo, golpe o movimiento brusco. Preguntá sobre golpes solo cuando sea pertinente; nunca sugieras que ocurrió si el cliente no lo dijo. Procurá reunir sin interrogatorio: nombre, marca, modelo, año, kilometraje aproximado, síntomas, circunstancias y desde cuándo. Si no sabe año, modelo o kilometraje exacto, aceptá la aproximación. Después de que el cliente responda al menos una pregunta de seguimiento y ya tengas los datos esenciales, ofrecé preparar la consulta estructurada para WhatsApp. Si pide turno antes, seguí la conversación para obtener lo esencial y pedí el nombre si falta; no lo des por confirmado. Nunca pidas teléfono: WhatsApp ya identifica al remitente. No mandes al formulario general de la página. Respondé en 2 a 4 frases breves, normalmente menos de 400 caracteres; no seas telegráfico ni escribas una biblia. No repitas “traelo al taller” ni ofrezcas reservar en cada respuesta. No asegures precios, presupuestos, repuestos ni disponibilidad. No afirmes que es seguro conducir sin una evaluación: si hay humo abundante, olor fuerte a combustible, falla de frenos, sobrecalentamiento, pérdida de dirección o daño tras un impacto, indicá detenerse en lugar seguro, no seguir conduciendo y pedir asistencia. No indiques abrir el sistema de refrigeración caliente. Para otros temas, explicá con amabilidad que el chat ayuda con consultas sobre vehículos y MOTORLOZ.`;
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
  return messages.slice(-20)
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

async function requestSpeech(text, stream = false, model = SPEECH_MODEL) {
  return fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      model,
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
  let lastError;
  for (const model of [...new Set([SPEECH_MODEL, 'gemini-3.8-flash-tts'])]) {
    const upstream = await requestSpeech(text, false, model);
    const result = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      lastError = new Error('gemini_speech_failed');
      lastError.upstreamStatus = upstream.status;
      lastError.upstreamCode = result.error?.status || result.error?.code || 'unknown';
      if ([429, 500, 502, 503, 504].includes(upstream.status)) continue;
      throw lastError;
    }
    const audio = (result.steps || []).flatMap(step => step.content || []).filter(part => part.type === 'audio' && part.data).at(-1);
    const wav = audio && Buffer.from(audio.data, 'base64');
    if (wav && wav.subarray(0, 4).toString() === 'RIFF') return wav;
    lastError = new Error('gemini_speech_empty');
  }
  throw lastError;
}

async function streamSpeech(text, res) {
  let lastError;
  for (const model of [...new Set([SPEECH_MODEL, 'gemini-3.8-flash-tts'])]) {
    const upstream = await requestSpeech(text, true, model);
    if (!upstream.ok) {
      const result = await upstream.json().catch(() => ({}));
      lastError = new Error('gemini_speech_failed');
      lastError.upstreamStatus = upstream.status;
      lastError.upstreamCode = result.error?.status || result.error?.code || 'unknown';
      if ([429, 500, 502, 503, 504].includes(upstream.status)) continue;
      throw lastError;
    }
    if (!upstream.body) { lastError = new Error('gemini_speech_stream_empty'); continue; }
    let buffered = '';
    let started = false;
    try {
      for await (const chunk of upstream.body) {
        if (!started) {
          buffered += Buffer.from(chunk).toString('utf8');
          if (/"event_type":"error"/.test(buffered)) {
            lastError = new Error('gemini_speech_stream_error');
            if (/"code":"rate_limit_exceeded"/.test(buffered)) lastError.upstreamStatus = 429;
            break;
          }
          if (!/"event_type":"step.delta"/.test(buffered)) continue;
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store, no-transform');
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.write(buffered);
          buffered = '';
          started = true;
        } else res.write(chunk);
      }
      if (started) { res.end(); return; }
    } catch (error) {
      if (started) { res.end(); return; }
      lastError = error;
    }
    lastError ||= new Error('gemini_speech_stream_empty');
  }
  throw lastError;
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
      const customerStatements = Array.isArray(body.messages) ? body.messages
        .filter(item => item?.role === 'user' && typeof item.content === 'string')
        .slice(-12).map(item => item.content.trim().slice(0, 800)).filter(Boolean) : [];
      if (!customerStatements.length) {
        json(res, 400, { error: 'resumen_invalido', message: 'No hay conversación para resumir.' });
        return;
      }
      contents = userMessage(`Escribí para un mecánico la sección “Qué ocurre” de una consulta inicial. Usá SOLAMENTE las afirmaciones del cliente que siguen. Incluí todos los síntomas concretos que mencionó, cuándo y en qué condiciones aparecen, y cualquier hecho previo que el cliente relaciona con el problema, sin omitir detalles importantes. Redactá 2 a 4 oraciones claras, máximo 550 caracteres, sin repetir ni hacer una lista de palabras sueltas. No incluyas saludos, pedidos de turno, nombre, teléfono, marca, modelo, año o kilometraje: esos datos van en otras secciones. No conviertas preguntas del asistente en hechos, no infieras síntomas negados, no inventes causas ni des un diagnóstico. Si el cliente expresa incertidumbre, mantenela con expresiones como “según comenta” o “al parecer”. Devolvé solo el texto para el mecánico.\n\nDicho por el cliente, en orden:\n${customerStatements.map((text, index) => `${index + 1}. ${text}`).join('\n')}`);
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

    const reply = await callGemini(contents, { maxOutputTokens, ...(action === 'summary' ? { models: [SUMMARY_MODEL, MODEL] } : {}) });
    if (!reply) {
      json(res, 502, { error: 'respuesta_vacia', message: 'No pude armar una respuesta ahora. Intentá de nuevo.' });
      return;
    }
    if (action === 'summary') json(res, 200, { summary: reply.slice(0, 550) });
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
