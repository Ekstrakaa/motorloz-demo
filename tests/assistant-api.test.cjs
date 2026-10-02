const assert = require('node:assert/strict');
const test = require('node:test');
const { EventEmitter } = require('node:events');
const { handle } = require('../gemini-assistant.cjs');

function response() {
  return {
    headers: {},
    chunks: [],
    setHeader(name, value) { this.headers[name] = value; },
    write(chunk) { this.chunks.push(Buffer.from(chunk)); },
    end(body) { this.body = body; }
  };
}

test('retries a token-truncated Gemini response and returns the complete reply', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  const previousFetch = global.fetch;
  const requests = [];
  global.fetch = async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return {
      ok: true,
      json: async () => requests.length === 1
        ? { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'Hola, entiendo que' }] } }] }
        : { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '¡Hola! Revisemos ese ruido al frenar con el taller.' }] } }] }
    };
  };
  try {
    const res = response();
    await handle({ method: 'POST', body: { messages: [{ role: 'user', content: 'Ruido al frenar' }] }, headers: {}, socket: {} }, res, 'chat');
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).reply, 'Revisemos ese ruido al frenar con el taller.');
    assert.equal(requests.length, 2);
    assert.equal(requests[0].generationConfig.thinkingConfig.thinkingLevel, 'minimal');
    assert.ok(requests[0].generationConfig.maxOutputTokens > 260);
    assert.match(requests[0].systemInstruction.parts[0].text, /No ofrezcas WhatsApp por haber reunido datos/);
    assert.match(requests[0].systemInstruction.parts[0].text, /Si describe un golpeteo o ruido/);
    assert.match(requests[0].systemInstruction.parts[0].text, /todavía faltan name, vehicle, mileage, issue, urgency/);
    assert.match(requests[0].systemInstruction.parts[0].text, /No digas que el botón de WhatsApp apareció/);
  } finally {
    global.fetch = previousFetch;
  }
});

test('answers a simple first vehicle message immediately without waiting for Gemini', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  const previousFetch = global.fetch;
  let upstreamCalls = 0;
  global.fetch = async () => { upstreamCalls += 1; throw new Error('Gemini should not be called'); };
  try {
    const res = response();
    await handle({ method:'POST', body:{ messages:[{ role:'user', content:'Tengo un Subaru Impreza' }] }, headers:{}, socket:{} }, res, 'chat');
    assert.equal(res.statusCode, 200);
    assert.equal(upstreamCalls, 0);
    assert.equal(JSON.parse(res.body).source, 'instant');
    assert.match(JSON.parse(res.body).reply, /Subaru Impreza/);
  } finally { global.fetch = previousFetch; }
});

test('answers a generic breakdown immediately and asks one useful question', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  const previousFetch = global.fetch;
  global.fetch = async () => { throw new Error('Gemini should not be called'); };
  try {
    const res = response();
    await handle({ method:'POST', body:{ messages:[{ role:'user', content:'Se me rompió el auto' }] }, headers:{}, socket:{} }, res, 'chat');
    assert.equal(res.statusCode, 200);
    assert.match(JSON.parse(res.body).reply, /¿Qué notaste exactamente/);
  } finally { global.fetch = previousFetch; }
});

test('never claims the WhatsApp control is visible while required intake data is missing', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  const previousFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ candidates: [{ finishReason:'STOP', content:{ parts:[{ text:'Podés tocar “Abrir WhatsApp” debajo del chat.' }] } }] })
  });
  try {
    const res = response();
    await handle({ method:'POST', body:{
      messages:[{ role:'user', content:'Quiero coordinar para mi Subaru Impreza de 200 mil kilómetros.' }],
      intake:{ name:true, vehicle:true, mileage:true, issue:true, urgency:false }
    }, headers:{}, socket:{} }, res, 'chat');
    const body = JSON.parse(res.body);
    assert.equal(body.handoffReady, false);
    assert.doesNotMatch(body.reply, /debajo del chat|Abrir WhatsApp/i);
    assert.match(body.reply, /urgente|fecha coordinada/i);
  } finally { global.fetch = previousFetch; }
});

test('serves the selected Cedar voice without requiring Gemini for narration', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  const geminiKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const previousFetch = global.fetch;
  let request;
  const wav = Buffer.from('RIFFtest-WAVE-audio');
  global.fetch = async (_url, options) => {
    request = JSON.parse(options.body);
    return { ok: true, arrayBuffer: async () => Buffer.concat([wav, Buffer.alloc(44)]) };
  };
  try {
    const res = response();
    await handle({ method: 'POST', body: { text: 'Hola, soy MOTORLOZ, Pablo Lozano.' }, headers: {}, socket: {} }, res, 'speech');
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['Content-Type'], 'audio/wav');
    assert.equal(Buffer.compare(res.body.subarray(0,wav.length), wav), 0);
    assert.equal(request.voice, 'cedar');
    assert.equal(request.model, 'gpt-4o-mini-tts');
    assert.equal(request.response_format, 'wav');
    assert.equal(request.input, 'Hola, soy Motor Los, Pablo Lozano.');
    assert.match(request.instructions, /uruguayo de Montevideo/);
    assert.match(request.instructions, /nunca Motorola/);
    assert.equal(res.headers['X-Voice'], 'cedar');
  } finally {
    global.fetch = previousFetch;
    if(geminiKey) process.env.GEMINI_API_KEY = geminiKey;
    delete process.env.OPENAI_API_KEY;
  }
});

test('streams fixed-voice audio chunks without waiting for the complete recording', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  const previousFetch = global.fetch;
  const pcm = Buffer.from([0, 0, 12, 1]);
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  let request;
  global.fetch = async (_url, options) => {
    request = JSON.parse(options.body);
    return { ok: true, body: ReadableStream.from((async function*(){ yield pcm.subarray(0,3); await pending; yield pcm.subarray(3); })()) };
  };
  try {
    const res = response();
    const handling = handle({ method: 'POST', body: { text: 'Hola, te escucho.', voice: 'other' }, headers: {}, socket: {} }, res, 'speech-stream');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(res.chunks.length, 1, 'first audio is sent while provider is still generating');
    release();
    await handling;
    assert.equal(res.statusCode, 200);
    assert.match(res.headers['Content-Type'], /text\/event-stream/);
    const frames = Buffer.concat(res.chunks).toString().trim().split('\n\n').map(frame => JSON.parse(frame.slice(6)));
    assert.deepEqual(Buffer.concat(frames.map(frame => Buffer.from(frame.delta.data, 'base64'))), pcm);
    assert.equal(request.response_format, 'pcm');
    assert.equal(request.voice, 'cedar');
  } finally {
    global.fetch = previousFetch;
    release();
    delete process.env.OPENAI_API_KEY;
  }
});

test('stops generating voice when the visitor interrupts playback', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  const previousFetch = global.fetch;
  let aborted = false;
  global.fetch = async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); });
  });
  try {
    const req = Object.assign(new EventEmitter(), { method:'POST', body:{ text:'Hola, soy MOTORLOZ.' }, headers:{}, socket:{} });
    const res = Object.assign(new EventEmitter(), response());
    const handling = handle(req, res, 'speech-stream');
    await new Promise(resolve => setImmediate(resolve));
    res.emit('close');
    await handling;
    assert.equal(aborted, true);
    assert.equal(res.body, undefined);
  } finally { global.fetch = previousFetch; delete process.env.OPENAI_API_KEY; }
});

test('an exhausted OpenAI balance never calls Gemini or changes the selected voice', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  const previousFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push(JSON.parse(options.body));
    assert.equal(url, 'https://api.openai.com/v1/audio/speech');
    return { ok: false, status: 429, json: async () => ({error:{code:'insufficient_quota'}}) };
  };
  try {
    const res = response();
    await handle({ method: 'POST', body: { text: 'Hola' }, headers: {}, socket: {} }, res, 'speech-stream');
    assert.equal(res.statusCode, 429);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].voice, 'cedar');
    assert.equal(JSON.parse(res.body).error, 'saldo_openai_agotado');
  } finally { global.fetch = previousFetch; delete process.env.OPENAI_API_KEY; }
});

test('reports an interrupted audio stream so the browser can offer a complete replay', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  const previousFetch = global.fetch;
  global.fetch = async () => ({ ok:true, body:ReadableStream.from((async function*(){
    yield Buffer.from([0,0]);
    throw new Error('connection lost');
  })()) });
  try {
    const res = response();
    await handle({ method:'POST', body:{text:'Una respuesta completa.'}, headers:{}, socket:{} }, res, 'speech-stream');
    assert.equal(res.statusCode, 200);
    const events = Buffer.concat(res.chunks).toString().trim().split('\n\n').map(frame=>JSON.parse(frame.slice(6)));
    assert.equal(events[0].delta.type, 'audio');
    assert.equal(events.at(-1).error.code, 'voice_interrupted');
  } finally { global.fetch = previousFetch; delete process.env.OPENAI_API_KEY; }
});

test('the workshop summary uses only customer facts and the fast summary model', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  const previousFetch = global.fetch;
  let request;
  let modelUrl;
  global.fetch = async (url, options) => {
    modelUrl = url;
    request = JSON.parse(options.body);
    return { ok:true, json:async () => ({ candidates:[{ finishReason:'STOP', content:{ parts:[{ text:'Se enciende la luz al acelerar. Tras pasar un pozo empezó un ruido, vibra la caja y sale más humo blanco.' }] } }] }) };
  };
  try {
    const res = response();
    await handle({ method:'POST', body:{ messages:[
      { role:'user', content:'Se enciende la luz al acelerar; vibra la caja y sale más humo blanco.' },
      { role:'assistant', content:'Entonces no hay ruidos ni golpes, ¿verdad?' },
      { role:'user', content:'Después de pasar un pozo empezó un ruido raro.' }
    ] }, headers:{}, socket:{} }, res, 'summary');
    assert.equal(res.statusCode, 200);
    assert.match(JSON.parse(res.body).summary, /pozo/);
    assert.match(modelUrl, /gemini-3\.5-flash-lite:generateContent/);
    assert.match(request.contents[0].parts[0].text, /pozo/);
    assert.doesNotMatch(request.contents[0].parts[0].text, /no hay ruidos ni golpes/);
  } finally { global.fetch = previousFetch; }
});

test('uses the backup Gemini model when the primary service is unavailable', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  const previousFetch = global.fetch;
  const urls = [];
  global.fetch = async (url) => {
    urls.push(url);
    return urls.length === 1
      ? { ok: false, status: 503, json: async () => ({ error: { status: 'UNAVAILABLE' } }) }
      : { ok: true, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Podemos revisar ese ruido en el taller.' }] } }] }) };
  };
  try {
    const res = response();
    await handle({ method: 'POST', body: { messages: [{ role: 'user', content: 'Ruido al frenar' }] }, headers: {}, socket: {} }, res, 'chat');
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).reply, 'Podemos revisar ese ruido en el taller.');
    assert.match(urls[0], /gemini-3\.5-flash-lite/);
    assert.match(urls[1], /gemini-3\.8-flash/);
  } finally {
    global.fetch = previousFetch;
  }
});

test('rejects any former audio-input action', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  for (const action of ['voice', 'transcribe']) {
    const res = response();
    await handle({ method:'POST', body:{ audio:'AAAA' }, headers:{}, socket:{} }, res, action);
    assert.equal(res.statusCode, 404);
  }
});
