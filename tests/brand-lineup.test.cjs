const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

test('the visible and repeated brand rows use the same real, local marks for requested makes', () => {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const row = html.match(/<div class="brand-lineup-track">([\s\S]*?)<\/div><\/div><p class="brand-experience-note">/)?.[1];
  assert.ok(row, 'brand row exists');

  const primary = [...row.matchAll(/<div class="brand-wordmark" role="img" aria-label="([^"]+)"><img src="([^"]+)" alt="[^"]*"><\/div>/g)]
    .map(match => ({ name: match[1], src: match[2] }));
  const repeated = [...row.matchAll(/<div class="brand-wordmark" aria-hidden="true"><img src="([^"]+)" alt=""><\/div>/g)]
    .map(match => match[1]);
  assert.equal(primary.length, 25);
  assert.deepEqual(repeated, primary.map(item => item.src));
  assert.deepEqual(primary.slice(1, 6).map(item => item.name), ['Alfa Romeo', 'Citroën', 'Dodge', 'Ferrari', 'Porsche']);

  for (const { name, src } of primary) {
    assert.ok(!/^https?:/.test(src), `${name} does not depend on a third-party image host`);
    assert.ok(fs.statSync(path.join(root, src)).size > 100, `${name} has a nonempty local logo`);
  }

  for (const { name, src } of primary.slice(1, 6)) {
    assert.match(src, /^assets\/brands\//, `${name} is served locally`);
    const bytes = fs.readFileSync(path.join(root, src));
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${name} is a valid PNG`);
    assert.ok(bytes.length > 2000, `${name} has image content`);
  }
});
