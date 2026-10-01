const assert = require('node:assert/strict');
const test = require('node:test');
const liveVoiceSession = require('../live-voice-session.cjs');

function response() {
  return { headers: {}, setHeader(name, value) { this.headers[name] = value; }, end(body) { this.body = body; } };
}

test('creates a short GPT-Live session using only an approved natural voice', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.VOICE_PREVIEW_TOKEN = 'preview-secret';
  const previousFetch = global.fetch;
  let request;
  global.fetch = async (_url, options) => {
    request = JSON.parse(options.body);
    return { ok: true, json: async () => ({ session: { id: 'live_test' }, transport: { type: 'webrtc', sdp: 'answer' } }) };
  };
  try {
    const res = response();
    await liveVoiceSession({ method: 'POST', headers: { origin: 'https://motorloz-demo.vercel.app', authorization: 'Bearer preview-secret' }, body: { sample: 'b', sdp: 'offer' } }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(request.session.model, 'gpt-live-1');
    assert.equal(request.session.audio.output.voice, 'vesper');
    assert.equal(request.session.store, false);
    assert.match(request.session.instructions, /español rioplatense uruguayo/);
  } finally {
    delete process.env.OPENAI_API_KEY;
    delete process.env.VOICE_PREVIEW_TOKEN;
    global.fetch = previousFetch;
  }
});

test('rejects unapproved Live voice requests', async () => {
  process.env.VOICE_PREVIEW_TOKEN = 'preview-secret';
  const res = response();
  await liveVoiceSession({ method: 'POST', headers: { authorization: 'Bearer preview-secret' }, body: { sample: 'other', sdp: 'offer' } }, res);
  assert.equal(res.statusCode, 400);
  delete process.env.VOICE_PREVIEW_TOKEN;
});

test('rejects a Live voice session without the private preview token', async () => {
  process.env.VOICE_PREVIEW_TOKEN = 'preview-secret';
  const res = response();
  await liveVoiceSession({ method: 'POST', headers: {}, body: { sample: 'a', sdp: 'offer' } }, res);
  assert.equal(res.statusCode, 401);
  delete process.env.VOICE_PREVIEW_TOKEN;
});
