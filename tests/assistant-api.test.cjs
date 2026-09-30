const assert = require('node:assert/strict');
const test = require('node:test');
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
        : { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Revisemos ese ruido al frenar con el taller.' }] } }] }
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
  } finally {
    global.fetch = previousFetch;
  }
});

test('serves the fixed Gemini voice as WAV audio', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  const previousFetch = global.fetch;
  let request;
  const wav = Buffer.from('RIFFtest-WAVE-audio');
  global.fetch = async (_url, options) => {
    request = JSON.parse(options.body);
    return { ok: true, json: async () => ({ steps: [{ type: 'model_output', content: [{ type: 'audio', data: wav.toString('base64') }] }] }) };
  };
  try {
    const res = response();
    await handle({ method: 'POST', body: { text: 'Hola, soy MOTORLOZ, Pablo Lozano.' }, headers: {}, socket: {} }, res, 'speech');
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['Content-Type'], 'audio/wav');
    assert.equal(Buffer.compare(res.body, wav), 0);
    assert.equal(request.generation_config.speech_config[0].voice, 'Algieba');
    assert.equal(request.model, 'gemini-3.8-flash-lite-tts');
    assert.equal(request.input[0].content[0].text, 'Hola, soy Motor Los, Pablo Lozano.');
    assert.match(request.input[0].content[0].annotations[0].style, /nunca Motorola/);
  } finally {
    global.fetch = previousFetch;
  }
});

test('streams fixed-voice audio chunks without waiting for the complete recording', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  const previousFetch = global.fetch;
  const event = Buffer.from('event: step.delta\ndata: {"event_type":"step.delta","delta":{"type":"audio","data":"AAAA"}}\n\n');
  let request;
  global.fetch = async (_url, options) => {
    request = JSON.parse(options.body);
    return { ok: true, body: ReadableStream.from([event.subarray(0, 17), event.subarray(17)]) };
  };
  try {
    const res = response();
    await handle({ method: 'POST', body: { text: 'Hola, te escucho.' }, headers: {}, socket: {} }, res, 'speech-stream');
    assert.equal(res.statusCode, 200);
    assert.match(res.headers['Content-Type'], /text\/event-stream/);
    assert.equal(Buffer.concat(res.chunks).toString(), event.toString());
    assert.equal(request.stream, true);
    assert.equal(request.generation_config.speech_config[0].voice, 'Algieba');
  } finally {
    global.fetch = previousFetch;
  }
});

test('keeps the one voice and model when speech reaches its quota', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  const previousFetch = global.fetch;
  const urls = [];
  global.fetch = async (url, options) => {
    urls.push(JSON.parse(options.body).model);
    const event = 'event: error\ndata: {"event_type":"error","error":{"code":"rate_limit_exceeded"}}\n\n';
    return { ok: true, body: ReadableStream.from([Buffer.from(event)]) };
  };
  try {
    const res = response();
    await handle({ method: 'POST', body: { text: 'Hola' }, headers: {}, socket: {} }, res, 'speech-stream');
    assert.equal(res.statusCode, 429);
    assert.deepEqual(urls, ['gemini-3.8-flash-lite-tts']);
  } finally { global.fetch = previousFetch; }
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
