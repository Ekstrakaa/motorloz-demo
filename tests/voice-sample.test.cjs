const assert = require('node:assert/strict');
const test = require('node:test');
const voiceSample = require('../voice-sample.cjs');

function response() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(body) { this.body = body; }
  };
}

test('voice samples use fixed text, voice and human Spanish direction', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  const previousFetch = global.fetch;
  let request;
  global.fetch = async (_url, options) => {
    request = JSON.parse(options.body);
    return { ok: true, arrayBuffer: async () => Buffer.from('sample-audio') };
  };
  try {
    const res = response();
    await voiceSample({ method: 'GET', query: { sample: '2' }, url: '/api/voice-sample?sample=2' }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['Content-Type'], 'audio/mpeg');
    assert.equal(request.model, 'gpt-4o-mini-tts');
    assert.equal(request.voice, 'echo');
    assert.equal(request.input, voiceSample.SAMPLE_TEXT);
    assert.match(request.instructions, /español rioplatense natural de Montevideo/);
    assert.match(request.instructions, /comprendés la preocupación/);
  } finally {
    delete process.env.OPENAI_API_KEY;
    global.fetch = previousFetch;
  }
});

test('voice samples reject arbitrary voices', async () => {
  const res = response();
  await voiceSample({ method: 'GET', query: { sample: '99' }, url: '/api/voice-sample?sample=99' }, res);
  assert.equal(res.statusCode, 404);
});
