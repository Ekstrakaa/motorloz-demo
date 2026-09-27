const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const root = __dirname;
const port = 4173;
// Local-only environment loading keeps the OpenAI key out of browser assets.
try {
  const envFile = fs.readFileSync(path.join(root, '.env'), 'utf8');
  for (const line of envFile.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
  }
} catch {}

const limits = new Map();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-5-mini';
const VOICE_MODEL = process.env.OPENAI_VOICE_MODEL || 'gpt-4o-mini-audio-preview';
const SYSTEM_PROMPT = `Sos el asistente virtual de recepción de MOTORLOZ, taller multimarca en Montevideo. Respondé en español rioplatense, con calidez y naturalidad, como una persona que escucha de verdad. Entendé errores de escritura y mensajes de voz. La bienvenida ya pidió marca, modelo, kilometraje y qué notó; aprovechá lo que la persona diga y no vuelvas a pedir datos que ya aportó. En cada respuesta, reflejá brevemente lo que entendiste —sin mostrar una transcripción literal del audio— para que sepa que su explicación llegó. Mantené respuestas concretas, de 1 a 3 frases: nada de listas numeradas, pasos, biblias ni enumeraciones de causas. Podés explicar en una frase que los síntomas pueden tener más de una causa, sin asegurar piezas ni diagnósticos; hacé como máximo una pregunta breve y útil si falta un dato importante para entender la historia. Si no hay señales de peligro, respondé con calma y empatía, sin asegurar que no es nada. No des precios, presupuestos ni promesas. Orientá con naturalidad a una revisión presencial en MOTORLOZ, sin presionar ni inventar servicios, garantías o disponibilidad. Si hay humo abundante/continuo, olor fuerte a combustible, frenos que fallan, sobrecalentamiento, pérdida de dirección u otra señal peligrosa, priorizá seguridad: detenerse en un lugar seguro, apagar motor cuando corresponda, no seguir conduciendo y pedir asistencia; nunca asustes con costos. No indiques abrir un sistema de refrigeración caliente. Nunca pidas nombre, teléfono, correo ni otros datos personales durante el chat; se solicitan únicamente después de que la persona toque “Hacer reserva ahora”. No alargues la charla para obtener datos que se completan en la reserva. Para otros temas, explicá amablemente que este chat es para consultas del vehículo y MOTORLOZ. Cuando el contexto esté claro, invitá a hacer una reserva para que el taller revise el vehículo.`;

function rateAllowed(req, bucket, max, windowMs) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwarded || req.socket.remoteAddress || 'local';
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const recent = (limits.get(key) || []).filter(time => now - time < windowMs);
  if (recent.length >= max) return false;
  recent.push(now);
  limits.set(key, recent);
  if (limits.size > 1000) for (const [entry, times] of limits) if (!times.length || now - times[times.length - 1] > windowMs) limits.delete(entry);
  return true;
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(data));
}

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) tooLarge = true;
      else if (!tooLarge) chunks.push(chunk);
    });
    req.on('end', () => tooLarge ? reject(Object.assign(new Error('payload_too_large'), { status: 413 })) : resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function apiRequestAllowed(req, res) {
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.host) {
        json(res, 403, { error: 'origen_no_permitido' });
        return false;
      }
    } catch {
      json(res, 403, { error: 'origen_no_permitido' });
      return false;
    }
  }
  if (!OPENAI_API_KEY) {
    json(res, 503, { error: 'asistente_no_configurado', message: 'La IA todavía no está conectada. Podés usar el formulario de contacto.' });
    return false;
  }
  return true;
}

async function handleApi(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/assistant/status') {
    json(res, 200, { configured: Boolean(OPENAI_API_KEY), model: CHAT_MODEL, voiceModel: VOICE_MODEL });
    return true;
  }
  if (!['/api/assistant/chat', '/api/assistant/voice', '/api/assistant/summary'].includes(pathname)) return false;
  if (req.method !== 'POST') {
    json(res, 405, { error: 'metodo_no_permitido' });
    return true;
  }
  if (!apiRequestAllowed(req, res)) return true;

  if (pathname === '/api/assistant/chat' || pathname === '/api/assistant/voice' || pathname === '/api/assistant/summary') {
    const isVoice = pathname.endsWith('/voice');
    const isSummary = pathname.endsWith('/summary');
    if (!rateAllowed(req, isVoice ? 'voice' : isSummary ? 'summary' : 'chat', isVoice ? 6 : isSummary ? 4 : 12, isVoice || isSummary ? 60 * 60_000 : 60_000)) {
      json(res, 429, { error: 'limite_temporal', message: 'Esperá un momento antes de enviar otro mensaje.' });
      return true;
    }
    try {
      const body = JSON.parse((await readBody(req, isVoice ? 5_500_000 : 24_000)).toString('utf8'));
      const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
      const history = messages
        .filter(item => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string')
        .map(item => ({ role: item.role, content: item.content.trim().slice(0, 1200) }))
        .filter(item => item.content);
      if (isSummary) {
        if (!history.length) {
          json(res, 400, { error: 'resumen_invalido' });
          return true;
        }
        const upstream = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: CHAT_MODEL,
            instructions: 'Prepará para el mecánico de MOTORLOZ un único párrafo breve, máximo 2 frases y 500 caracteres. Incluí marca/modelo/año y kilometraje solo si la persona los mencionó; resumí en sus palabras qué ocurrió, síntomas, cuándo aparecen y los detalles que aclaró. No diagnostiques ni inventes causas, piezas, datos del vehículo o gravedad. Si hay una nota de voz, usá la forma en que el asistente reflejó lo que entendió en la conversación. No incluyas nombres, teléfonos, matrículas, precios ni consejos nuevos. Esta es una síntesis de recepción, no un diagnóstico.',
            input: history,
            store: false,
            max_output_tokens: 140
          })
        });
        const result = await upstream.json();
        if (!upstream.ok) {
          console.error('OpenAI summary error:', upstream.status, result.error?.type || result.error?.code || 'unknown');
          json(res, 502, { error: 'resumen_no_disponible', message: 'No pude preparar el resumen ahora.' });
          return true;
        }
        const summary = (result.output || []).flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text).join('\n').trim().slice(0, 520);
        if (!summary) {
          json(res, 502, { error: 'resumen_vacio', message: 'No pude preparar el resumen ahora.' });
          return true;
        }
        json(res, 200, { summary });
        return true;
      }
      if (isVoice) {
        const encoded = typeof body.audio === 'string' ? body.audio : '';
        const audio = Buffer.from(encoded, 'base64');
        if (!encoded || encoded.length > 5_000_000 || audio.length < 44 || audio.toString('ascii', 0, 4) !== 'RIFF' || audio.toString('ascii', 8, 12) !== 'WAVE') {
          json(res, 400, { error: 'audio_invalido', message: 'No pude procesar esta nota de voz. Probá grabarla otra vez o escribí tu consulta.' });
          return true;
        }
        const content = [
          { type: 'text', text: 'Escuchá este mensaje de voz y respondé en texto dentro del chat. No devuelvas una transcripción literal; entendé la consulta y continuá la conversación como recepción de MOTORLOZ.' },
          { type: 'input_audio', input_audio: { data: audio.toString('base64'), format: 'wav' } }
        ];
        const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: VOICE_MODEL, modalities: ['text'], max_completion_tokens: 260, store: false, messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history, { role: 'user', content }] })
        });
        const result = await upstream.json();
        if (!upstream.ok) {
          console.error('OpenAI voice error:', upstream.status, result.error?.type || result.error?.code || 'unknown');
          json(res, 502, { error: 'audio_no_disponible', message: 'No pude escuchar ese audio ahora. Podés volver a grabarlo o escribir tu consulta.' });
          return true;
        }
        const answer = String(result.choices?.[0]?.message?.content || '').trim();
        if (!answer) {
          json(res, 502, { error: 'respuesta_vacia', message: 'No pude armar una respuesta ahora. Intentá de nuevo.' });
          return true;
        }
        json(res, 200, { reply: answer });
        return true;
      }
      if (!history.length || history[history.length - 1].role !== 'user') {
        json(res, 400, { error: 'mensaje_invalido' });
        return true;
      }
      const upstream = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: CHAT_MODEL, instructions: SYSTEM_PROMPT, input: history, store: false, max_output_tokens: 240 })
      });
      const result = await upstream.json();
      if (!upstream.ok) {
        console.error('OpenAI chat error:', upstream.status, result.error?.type || result.error?.code || 'unknown');
        json(res, 502, { error: 'respuesta_no_disponible', message: 'No pude responder ahora. Intentá de nuevo o usá el formulario del taller.' });
        return true;
      }
      const answer = (result.output || []).flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text).join('\n').trim();
      if (!answer) {
        json(res, 502, { error: 'respuesta_vacia', message: 'No pude armar una respuesta ahora. Intentá de nuevo.' });
        return true;
      }
      json(res, 200, { reply: answer });
    } catch (error) {
      if (!res.headersSent && !res.destroyed) json(res, error.status || 400, { error: error.message === 'payload_too_large' ? 'mensaje_muy_largo' : 'solicitud_invalida' });
    }
    return true;
  }
  return false;
}
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
};

function sendFile(req, res, file, stats) {
  const contentType = types[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const commonHeaders = {
    'Content-Type': contentType,
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Accept-Ranges': 'bytes'
  };
  const range = req.headers.range;

  if (!range) {
    res.writeHead(200, { ...commonHeaders, 'Content-Length': stats.size });
    fs.createReadStream(file).pipe(res);
    return;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) {
    res.writeHead(416, { 'Content-Range': `bytes */${stats.size}` });
    res.end();
    return;
  }

  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Math.min(Number(match[2]), stats.size - 1) : stats.size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= stats.size) {
    res.writeHead(416, { 'Content-Range': `bytes */${stats.size}` });
    res.end();
    return;
  }

  res.writeHead(206, {
    ...commonHeaders,
    'Content-Range': `bytes ${start}-${end}/${stats.size}`,
    'Content-Length': end - start + 1
  });
  fs.createReadStream(file, { start, end }).pipe(res);
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }

  if (pathname.startsWith('/api/')) {
    handleApi(req, res, pathname).then(handled => {
      if (!handled && !res.headersSent) json(res, 404, { error: 'no_encontrado' });
    }).catch(() => {
      if (!res.headersSent && !res.destroyed) json(res, 500, { error: 'error_interno' });
    });
    return;
  }

  const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!file.startsWith(`${root}${path.sep}`)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(file, (error, stats) => {
    if (error || !stats.isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    sendFile(req, res, file, stats);
  });
});

server.listen(port, '0.0.0.0', () => {
  const addresses = Object.values(os.networkInterfaces())
    .flat()
    .filter(item => item && item.family === 'IPv4' && !item.internal)
    .map(item => `http://${item.address}:${port}`);
  console.log(`MOTORLOZ local: http://127.0.0.1:${port}`);
  addresses.forEach(address => console.log(`MOTORLOZ celular: ${address}`));
});
