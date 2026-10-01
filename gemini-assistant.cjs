const MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-3.5-flash-lite';
const OPENAI_SPEECH_MODEL = process.env.OPENAI_SPEECH_MODEL || 'gpt-4o-mini-tts';
const OPENAI_SPEECH_VOICE = process.env.OPENAI_SPEECH_VOICE || 'cedar';
const SPEECH_MODEL = process.env.GEMINI_SPEECH_MODEL || 'gemini-3.8-flash-tts';
const SPEECH_FALLBACK_MODEL = process.env.GEMINI_SPEECH_FALLBACK_MODEL || 'gemini-3.8-flash-lite-tts';
const SPEECH_MODELS = [...new Set([SPEECH_MODEL, SPEECH_FALLBACK_MODEL])];
const SPEECH_VOICE = 'Algieba';
const SUMMARY_MODEL = process.env.GEMINI_SUMMARY_MODEL || 'gemini-3.5-flash-lite';
const SYSTEM_PROMPT = `Sos la recepción virtual de MOTORLOZ, taller multimarca en Montevideo. Tu trabajo es escuchar, orientar sin diagnosticar y preparar una consulta clara para WhatsApp. Pablo es el dueño del taller y Bruno forma parte del equipo experimentado; podés mencionarlos naturalmente al explicar que revisarán el caso, sin prometer que una persona concreta estará disponible. El equipo humano confirma día, hora, disponibilidad y detalles finales: vos nunca confirmás una reserva. Conversá en español rioplatense cálido y natural. Usá todo el historial disponible: recordá lo ya dicho y no repitas preguntas ni datos. Si solo saluda, saludá y preguntá en qué podés ayudar; no hables de turnos. También atendés mantenimiento y servicios programados: aceite, frenos, alineación y revisiones; si pregunta por eso, preguntá qué servicio necesita, para qué vehículo y el kilometraje, sin inventar intervalos ni precios. Si la persona dice solo “tengo un Subaru, unos 200 mil kilómetros y anda mal”, no diagnostiques ni ofrezcas turno enseguida: preguntá qué nota exactamente y desde cuándo. Si cuenta un síntoma, explicá brevemente qué sistemas podrían estar relacionados sin afirmar una causa y hacé una sola pregunta útil sobre cuándo ocurre, qué aviso aparece, cómo se siente o si empezó después de un pozo, golpe o movimiento brusco. Preguntá sobre golpes solo cuando sea pertinente; nunca sugieras que ocurrió si el cliente no lo dijo. Procurá reunir sin interrogatorio: nombre, marca, modelo, año, kilometraje aproximado, síntomas, circunstancias y desde cuándo. Si no sabe año, modelo o kilometraje exacto, aceptá la aproximación. Después de que el cliente responda al menos una pregunta de seguimiento y ya tengas los datos esenciales, ofrecé preparar la consulta estructurada para WhatsApp. Si pide turno antes, seguí la conversación para obtener lo esencial y pedí el nombre si falta; no lo des por confirmado. Nunca pidas teléfono: WhatsApp ya identifica al remitente. No mandes al formulario general de la página. Cuando ya sea oportuno pasar a WhatsApp, decí que la persona puede tocar “Preparar solicitud” debajo del chat para revisar el borrador; no escribas el mensaje de WhatsApp dentro de tu respuesta, no inventes enlaces y no prometas respuesta inmediata del taller. Respondé en 2 a 4 frases breves, normalmente menos de 400 caracteres; no seas telegráfico ni escribas una biblia. No repitas “traelo al taller” ni ofrezcas reservar en cada respuesta. No asegures precios, presupuestos, repuestos ni disponibilidad. No afirmes que es seguro conducir sin una evaluación: si hay humo abundante, olor fuerte a combustible, falla de frenos, sobrecalentamiento, pérdida de dirección o daño tras un impacto, indicá detenerse en lugar seguro, no seguir conduciendo y pedir asistencia. No indiques abrir el sistema de refrigeración caliente. Para otros temas, explicá con amabilidad que el chat ayuda con consultas sobre vehículos y MOTORLOZ.`;
const rateLimits = new Map();
const CHAT_PROMPT = SYSTEM_PROMPT
  .replace('Si solo saluda, saludá y preguntá en qué podés ayudar; no hables de turnos.', 'El chat ya mostró un saludo de bienvenida. Si la persona solo saluda, preguntá en qué podés ayudar sin volver a saludar ni presentarte; no hables de turnos.')
  .replace('Después de que el cliente responda al menos una pregunta de seguimiento y ya tengas los datos esenciales, ofrecé preparar la consulta estructurada para WhatsApp.', 'No ofrezcas WhatsApp por haber reunido datos: primero respondé la inquietud y profundizá lo necesario. Solo mencioná preparar la consulta cuando la persona pida coordinar o cuando, después de conversar sobre el caso, demuestre querer pasar al taller.')
  .replace('“Preparar solicitud” debajo del chat para revisar el borrador', '“Abrir WhatsApp” debajo del chat para revisar el mensaje allí');
const DICTATION_GUIDANCE = ' El dictado puede confundir nombres de vehículos. Si una marca o un modelo nuevos contradicen lo que dijo antes el cliente (por ejemplo Subaru frente a Hyundai), preguntá cuál es el correcto antes de darlo por confirmado o preparar WhatsApp. Impreza, Hawkeye y Wagon pueden aparecer al hablar de un Subaru; no sustituyas esos términos por palabras comunes ni inventes un modelo a partir de una transcripción dudosa.';
const DIALOGUE_GUIDANCE = ' Tu prioridad en cada turno es responder lo que la persona acaba de decir o preguntar. Si describe un golpeteo o ruido, explicá en lenguaje simple que puede venir de distintas zonas y preguntá una cosa concreta para ubicarlo (por ejemplo si aparece al acelerar, frenar o pasar por irregularidades); si comenzó después de un pozo, tené en cuenta ese dato sin afirmar una causa. Si pide información general sobre un auto, servicio o mantenimiento, contestá de forma útil aunque todavía no quiera reservar. Guiá la conversación de a un dato por vez y recordá lo ya contestado. Antes de ofrecer WhatsApp necesitás: nombre, marca y modelo, kilometraje aproximado (o que diga que no lo sabe), qué necesita o qué síntoma nota, desde cuándo o en qué situación ocurre, y si precisa atención urgente o puede esperar una fecha. Si falta algo y la persona quiere coordinar con el taller, pedí solamente el dato más útil que falte. La urgencia expresa la necesidad del cliente y no reemplaza una evaluación de seguridad. No conviertas una consulta informativa en una reserva: si la persona solo busca entender un síntoma, una pieza o un mantenimiento, respondé y seguí ayudando sin ofrecer WhatsApp. Cuando estén todos los datos y la persona pida turno, quiera llevar el auto o muestre intención clara de coordinar, respondé la inquietud pendiente y preguntá naturalmente si quiere revisar la consulta en WhatsApp; el botón aparecerá debajo. No repitas saludos, el nombre MOTORLOZ ni los nombres Pablo y Bruno en respuestas consecutivas. Evitá frases de venta y preguntas de formulario; mantené una conversación natural de una pregunta útil por vez.';
const SPEECH_STYLE = 'Leé exactamente el texto recibido, sin agregar ni omitir palabras. Español rioplatense de Montevideo. Voz cálida, natural y cercana, ritmo conversacional tranquilo; sin tono robótico ni locución publicitaria. El nombre del taller se pronuncia Motor Los, dos palabras; nunca Motorola.';
const OPENAI_SPEECH_STYLE = `${SPEECH_STYLE} Usá siempre una voz masculina adulta, serena y consistente.`;

function spokenTranscript(text) {
  // Display and WhatsApp keep the real brand; only the sound gets a phonetic hint.
  return text.replace(/\bMOTORLOZ\b/gi, 'Motor Los');
}

function withoutRepeatedGreeting(text) {
  const answer = text.trim().replace(/^\s*[¡!]*\s*(?:hola|buenas(?:\s+(?:tardes|noches))?|buenos?\s+d[ií]as)\s*[,!.¡:–-]?\s*/iu, '').trim();
  return answer || 'Contame qué necesitás saber sobre tu auto.';
}

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

function normalized(text) {
  return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function quickFirstReply(messages) {
  if (!Array.isArray(messages)) return '';
  const usable = messages.filter(item => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string' && item.content.trim());
  if (usable.length !== 1 || usable[0].role !== 'user') return '';
  const original = usable[0].content.trim().slice(0, 180);
  const text = normalized(original);
  const words = text.split(' ').filter(Boolean);

  if (words.length <= 4 && /^(hola|buenas|buen dia|buenos dias|buenas tardes|buenas noches)[!.? ]*$/.test(text)) {
    return 'Contame, ¿en qué te puedo ayudar con tu auto?';
  }
  if (/\b(se me rompio|se rompio|rompi el auto|auto roto|no arranca|no enciende)\b/.test(text) && words.length <= 16) {
    return 'Entiendo. ¿Qué notaste exactamente: no arranca, hace un ruido, vibra, perdió fuerza o apareció una luz en el tablero?';
  }
  const vehicleOnly = /^(?:tengo|es|mi auto es|mi coche es|mi camioneta es)\s+(?:un[ao]?\s+)?(.+)$/i.exec(original);
  const symptomWords = /\b(ruido|golpe|golpeteo|vibra|falla|humo|luz|pierde|perdio|calienta|arranca|enciende|frena|tironea|consume|rompio|roto|anda mal)\b/;
  if (vehicleOnly && words.length <= 12 && !symptomWords.test(text)) {
    const vehicle = vehicleOnly[1].replace(/[.!?]+$/, '').trim();
    return `Perfecto, anoté ${vehicle}. ¿Qué notaste en el auto y desde cuándo?`;
  }
  if (words.length <= 10 && /\b(cambio de aceite|service|mantenimiento|alineacion|balanceo)\b/.test(text)) {
    return 'Claro. ¿Para qué vehículo sería y qué kilometraje aproximado tiene?';
  }
  return '';
}

function unavailableReply(text) {
  const normalizedText = normalized(text);
  if (/\b(humo abundante|olor (?:fuerte )?a combustible|sin frenos|no frena|sobrecalent|sin direccion)\b/.test(normalizedText)) {
    return 'Por seguridad, detené el auto en un lugar seguro y no sigas circulando. Pedí asistencia y contame qué aviso apareció para dejar la consulta clara.';
  }
  return 'Te leí. Para orientarte sin adivinar, ¿eso aparece al acelerar, frenar, doblar o al pasar por una irregularidad?';
}

async function callGemini(contents, { maxOutputTokens = 768, systemInstruction = CHAT_PROMPT + DICTATION_GUIDANCE + DIALOGUE_GUIDANCE, models = [MODEL, 'gemini-3.8-flash', 'gemini-3.7-flash'] } = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw Object.assign(new Error('not_configured'), { status: 503 });
  models = [...new Set(models)];
  const deadline = Date.now() + 8500;
  let lastError = new Error('gemini_output_truncated');
  for (const model of models) {
    for (const tokenLimit of [maxOutputTokens, maxOutputTokens * 2]) {
      const remaining = deadline - Date.now();
      if (remaining < 250) throw Object.assign(new Error('gemini_deadline_exceeded'), { upstreamCode: 'TIMEOUT' });
      let upstream;
      const controller = new AbortController();
      const attemptTimeout = setTimeout(() => controller.abort(), Math.min(3800, remaining));
      try {
        upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          signal: controller.signal,
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
        lastError = controller.signal.aborted
          ? Object.assign(new Error('gemini_deadline_exceeded'), { upstreamCode: 'TIMEOUT' })
          : error;
        break;
      } finally {
        clearTimeout(attemptTimeout);
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

async function requestSpeech(text, stream = false, model = SPEECH_MODEL, signal) {
  return fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      model,
      input: [{ type: 'user_input', content: [{
        type: 'text', text: spokenTranscript(text),
        annotations: [{ type: 'speech_metadata', style: SPEECH_STYLE }]
      }] }],
      response_format: { type: 'audio' },
      generation_config: { speech_config: [{ voice: SPEECH_VOICE }] },
      ...(stream ? { stream: true } : {})
    })
  });
}

async function requestOpenAISpeech(text, stream = false, signal) {
  return fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: OPENAI_SPEECH_MODEL,
      voice: OPENAI_SPEECH_VOICE,
      input: spokenTranscript(text),
      instructions: OPENAI_SPEECH_STYLE,
      response_format: stream ? 'pcm' : 'wav'
    })
  });
}

async function generateSpeech(text) {
  let lastError;
  if (process.env.OPENAI_API_KEY) {
    const upstream = await requestOpenAISpeech(text);
    if (upstream.ok) {
      const wav = Buffer.from(await upstream.arrayBuffer());
      if (wav.subarray(0, 4).toString() === 'RIFF') return wav;
      lastError = new Error('openai_speech_empty');
    } else {
      const result = await upstream.json().catch(() => ({}));
      lastError = new Error('openai_speech_failed');
      lastError.upstreamStatus = upstream.status;
      lastError.upstreamCode = result.error?.code || result.error?.type || 'unknown';
    }
    throw lastError;
  }
  for (const model of SPEECH_MODELS) {
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

async function streamSpeech(text, req, res) {
  const controller = new AbortController();
  const onDisconnect = () => controller.abort();
  req.on?.('aborted', onDisconnect);
  res.on?.('close', onDisconnect);
  let lastError;
  try {
   if (process.env.OPENAI_API_KEY) {
    let upstream;
    try { upstream = await requestOpenAISpeech(text, true, controller.signal); }
    catch (error) { if (controller.signal.aborted) return; upstream = null; lastError = error; }
    if (upstream?.ok && upstream.body) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, no-transform');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      for await (const chunk of upstream.body) {
        if (controller.signal.aborted) return;
        const data = Buffer.from(chunk).toString('base64');
        if (data) res.write(`data: ${JSON.stringify({ event_type: 'step.delta', delta: { type: 'audio', data } })}\n\n`);
      }
      if (!res.destroyed) res.end();
      return;
    }
    if (upstream && !upstream.ok) {
      const result = await upstream.json().catch(() => ({}));
      lastError = new Error('openai_speech_failed');
      lastError.upstreamStatus = upstream.status;
      lastError.upstreamCode = result.error?.code || result.error?.type || 'unknown';
    }
    throw lastError || new Error('openai_speech_stream_empty');
   }
   for (const model of SPEECH_MODELS) {
    let upstream;
    try { upstream = await requestSpeech(text, true, model, controller.signal); }
    catch (error) { if (controller.signal.aborted) return; throw error; }
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
      if (started) { if (!res.destroyed) res.end(); return; }
    } catch (error) {
      if (controller.signal.aborted) return;
      if (started) { if (!res.destroyed) res.end(); return; }
      lastError = error;
    }
    lastError ||= new Error('gemini_speech_stream_empty');
   }
   throw lastError;
  } finally {
    req.off?.('aborted', onDisconnect);
    res.off?.('close', onDisconnect);
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
    json(res, 200, {
      configured: Boolean(process.env.GEMINI_API_KEY),
      chatProvider: process.env.GEMINI_API_KEY ? 'gemini' : null,
      voiceProvider: process.env.OPENAI_API_KEY ? 'openai' : process.env.GEMINI_API_KEY ? 'gemini' : null,
      model: MODEL
    });
    return;
  }
  if (!process.env.GEMINI_API_KEY) {
    json(res, 503, { error: 'asistente_no_configurado', message: 'La IA todavía no está conectada. Podés usar el formulario de contacto.' });
    return;
  }
  if (!allowed(req, action)) {
    json(res, 429, { error: 'limite_temporal', message: action.startsWith('speech') ? 'Se alcanzó el límite temporal de voz del sitio. Intentá más tarde.' : 'Esperá un momento antes de enviar otro mensaje.' });
    return;
  }

  let latestUserText = '';
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if (action === 'speech' || action === 'speech-stream') {
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      if (!text || text.length > 700) {
        json(res, 400, { error: 'texto_invalido', message: 'No pude leer ese mensaje.' });
        return;
      }
      if (action === 'speech-stream') {
        await streamSpeech(text, req, res);
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
    let chatSystemInstruction = '';
    let chatMissingFields = [];
    let maxOutputTokens = action === 'summary' ? 512 : 768;

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
      latestUserText = history[history.length - 1].parts[0].text;
      const immediateReply = quickFirstReply(body.messages);
      if (immediateReply) {
        json(res, 200, { reply: immediateReply, source: 'instant' });
        return;
      }
      contents = history;
      const intake = body.intake && typeof body.intake === 'object' ? body.intake : {};
      const required = ['name', 'vehicle', 'mileage', 'issue', 'urgency'];
      const missing = required.filter(field => intake[field] !== true);
      chatMissingFields = missing;
      const interfaceState = missing.length
        ? ` Estado real de la interfaz: todavía faltan ${missing.join(', ')}. No digas que el botón de WhatsApp apareció ni que está debajo del chat. Si la persona quiere coordinar, pedí de forma natural solo el dato faltante más útil.`
        : ' Estado real de la interfaz: los datos necesarios están completos. Si la persona quiere coordinar o aceptó hacerlo, podés preguntarle si quiere revisar la consulta en WhatsApp; el botón se mostrará con tu respuesta.';
      chatSystemInstruction = CHAT_PROMPT + DICTATION_GUIDANCE + DIALOGUE_GUIDANCE + interfaceState;
    } else {
      json(res, 404, { error: 'no_encontrado' });
      return;
    }

    const reply = await callGemini(contents, { maxOutputTokens, ...(action === 'summary'
      ? { models: [SUMMARY_MODEL, MODEL, 'gemini-3.5-flash'] }
      : { systemInstruction: chatSystemInstruction }) });
    if (!reply) {
      json(res, 502, { error: 'respuesta_vacia', message: 'No pude armar una respuesta ahora. Intentá de nuevo.' });
      return;
    }
    if (action === 'summary') json(res, 200, { summary: reply.slice(0, 550) });
    else {
      let safeReply = withoutRepeatedGreeting(reply);
      const claimsWhatsAppControl = /(?:abrir|bot[oó]n|debajo|toc[aá]|revisar|preparar).{0,90}whatsapp|whatsapp.{0,90}(?:abrir|bot[oó]n|debajo|toc[aá]|revisar|preparar)/i.test(safeReply);
      if (chatMissingFields.length && claimsWhatsAppControl) {
        const missingQuestion = {
          name: 'Antes de preparar la consulta, ¿cómo te llamás?',
          vehicle: 'Antes de preparar la consulta, ¿qué marca y modelo es tu vehículo?',
          mileage: 'Antes de preparar la consulta, ¿qué kilometraje aproximado tiene? Si no lo sabés, decímelo.',
          issue: 'Antes de preparar la consulta, contame brevemente qué necesitás revisar o qué notaste en el auto.',
          urgency: 'Antes de preparar la consulta, decime una cosa: ¿necesitás atención urgente o puede esperar una fecha coordinada?'
        };
        safeReply = missingQuestion[chatMissingFields[0]];
      }
      const handoffReady = chatMissingFields.length === 0 && /whatsapp/i.test(safeReply);
      json(res, 200, { reply: safeReply, handoffReady });
    }
  } catch (error) {
    if (error.status === 503) {
      json(res, 503, { error: 'asistente_no_configurado', message: 'La IA todavía no está conectada. Podés usar el formulario de contacto.' });
    } else if (error.upstreamStatus === 429) {
      json(res, 429, action.startsWith('speech')
        ? { error: 'cuota_voz_alcanzada', message: 'La voz alcanzó su límite temporal. Probá de nuevo más tarde.' }
        : { error: 'cuota_gemini_alcanzada', message: 'El chat alcanzó su límite temporal. Probá de nuevo más tarde.' });
    } else if (action === 'chat' && (error.message === 'gemini_deadline_exceeded' || ['TIMEOUT', 'UNAVAILABLE'].includes(error.upstreamCode) || [500, 502, 503, 504].includes(error.upstreamStatus))) {
      json(res, 200, { reply: unavailableReply(latestUserText), source: 'fallback' });
    } else {
      console.error('Assistant provider error:', error.upstreamStatus || 'unknown', error.upstreamCode || error.message || 'unknown');
      json(res, 502, { error: 'respuesta_no_disponible', message: 'No pude responder ahora. Intentá de nuevo o usá el formulario del taller.', reason: error.upstreamCode || error.message || 'unknown' });
    }
  }
}

module.exports = { handle };
