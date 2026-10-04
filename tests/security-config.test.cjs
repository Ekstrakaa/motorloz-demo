const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.join(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));

test('only intended pages and API endpoints stay public', () => {
  const hidden = ['/openai-assistant.cjs', '/.env.local', '/tests/assistant-api.test.cjs', '/ASISTENTE-MOTORLOZ.md', '/home-sequence-studio.html', '/api/assistant/chat.js'];
  const publicPaths = ['/index.html', '/assistant-widget.js', '/api/assistant/chat', '/assets/recepcion-optimized.webp'];
  const blocked = url => config.routes.some(route => route.status === 404 && new RegExp(`^${route.src}$`).test(url));
  hidden.forEach(url => assert.ok(blocked(url), `${url} must be hidden`));
  publicPaths.forEach(url => assert.ok(!blocked(url), `${url} must remain public`));
});

test('content policy permits exactly the current inline scripts without unsafe script execution', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const policy = config.headers[0].headers.find(header => header.key === 'Content-Security-Policy').value;
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length > 0);
  for (const script of scripts) {
    const hash = crypto.createHash('sha256').update(script[1]).digest('base64');
    assert.ok(policy.includes(`'sha256-${hash}'`));
  }
  assert.ok(!policy.includes("script-src 'unsafe-inline'"));
  assert.ok(policy.includes("frame-ancestors 'none'"));
});
