const test = require('node:test');
const assert = require('node:assert/strict');
const generate = require('../voice-style-generate.cjs');
function response() {
  return { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(body) { this.body = body; } };
}
test('private generation rejects missing, expired and arbitrary requests without contacting OpenAI', async () => {
  const previousFetch = global.fetch;
  global.fetch = () => { throw new Error('unexpected provider request'); };
  try {
    process.env.VOICE_PREVIEW_TOKEN = `secret.${Date.now() + 60000}`;
    const noAuth = response();
    await generate({ method: 'POST', headers: {}, body: { sample: '1' } }, noAuth);
    assert.equal(noAuth.statusCode, 401);
    const invalid = response();
    await generate({ method: 'POST', headers: { authorization: `Bearer ${process.env.VOICE_PREVIEW_TOKEN}` }, body: { sample: '__proto__' } }, invalid);
    assert.equal(invalid.statusCode, 400);
    process.env.VOICE_PREVIEW_TOKEN = `secret.${Date.now() - 1000}`;
    const expired = response();
    await generate({ method: 'POST', headers: { authorization: `Bearer ${process.env.VOICE_PREVIEW_TOKEN}` }, body: { sample: '1' } }, expired);
    assert.equal(expired.statusCode, 403);
  } finally { delete process.env.VOICE_PREVIEW_TOKEN; global.fetch = previousFetch; }
});
test('generates each fixed sample once and ignores caller text or voice', async () => {
  const previousFetch = global.fetch;
  let calls = 0, request;
  process.env.VOICE_PREVIEW_TOKEN = `secret.${Date.now() + 60000}`;
  process.env.OPENAI_API_KEY = 'test-key';
  global.fetch = async (url, options) => {
    calls++; request = JSON.parse(options.body);
    return { ok: true, arrayBuffer: async () => Buffer.alloc(4000) };
  };
  try {
    const req = { method: 'POST', headers: { authorization: `Bearer ${process.env.VOICE_PREVIEW_TOKEN}` }, body: { sample: '1', text: 'arbitrary input', voice: 'other' } };
    const results = [response(), response()];
    await Promise.all(results.map(res => generate(req, res)));
    assert.equal(calls, 1);
    assert.equal(request.voice, 'ballad');
    assert.match(request.input, /golpeteo después de un pozo/);
    assert.match(request.instructions, /Uruguayan Rioplatense Spanish/);
    results.forEach(res => assert.equal(res.statusCode, 200));
  } finally { delete process.env.VOICE_PREVIEW_TOKEN; delete process.env.OPENAI_API_KEY; global.fetch = previousFetch; }
});
