const assert = require('node:assert/strict');
const test = require('node:test');
const { handle } = require('../gemini-assistant.cjs');

function response() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
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
    assert.equal(requests[0].generationConfig.thinkingConfig.thinkingLevel, 'low');
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
    await handle({ method: 'POST', body: { text: 'Hola, ¿cómo estás?' }, headers: {}, socket: {} }, res, 'speech');
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['Content-Type'], 'audio/wav');
    assert.equal(Buffer.compare(res.body, wav), 0);
    assert.equal(request.generation_config.speech_config[0].voice, 'Algieba');
  } finally {
    global.fetch = previousFetch;
  }
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
    assert.match(urls[0], /gemini-3\.8-flash/);
    assert.match(urls[1], /gemini-3\.7-flash/);
  } finally {
    global.fetch = previousFetch;
  }
});
