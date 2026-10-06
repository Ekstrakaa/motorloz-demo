const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');

test('the public demo stays out of Google while crawlers can read noindex', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const robots = fs.readFileSync(path.join(root, 'robots.txt'), 'utf8');
  const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(robots, /Allow: \/\s*$/m);
  assert.doesNotMatch(robots, /Disallow: \/\s*$/m);
  assert.doesNotMatch(sitemap, /127\.0\.0\.1|localhost|motorloz-demo/);
  assert.doesNotMatch(html, /mailto:Info@motorloz\.com\.uy/);
});

test('launch preparation only accepts a final domain and removes demo markings', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'motorloz-seo-'));
  try {
    for (const name of ['prepare-seo.cjs', 'index.html', 'robots.txt', 'sitemap.xml']) {
      fs.copyFileSync(path.join(root, name), path.join(directory, name));
    }
    for (const domain of ['https://motorloz-demo.vercel.app/', 'http://motorloz.com.uy/', 'https://motorloz.com.uy/path']) {
      assert.notEqual(spawnSync(process.execPath, [path.join(directory, 'prepare-seo.cjs'), domain]).status, 0);
    }
    const result = spawnSync(process.execPath, [path.join(directory, 'prepare-seo.cjs'), 'https://motorloz.com.uy/']);
    assert.equal(result.status, 0, result.stderr.toString());
    const html = fs.readFileSync(path.join(directory, 'index.html'), 'utf8');
    assert.match(html, /<meta name="robots" content="index, follow">/);
    assert.match(html, /rel="canonical" href="https:\/\/motorloz\.com\.uy\/"/);
    assert.match(html, /SITIO OFICIAL · MOTORLOZ/);
    assert.doesNotMatch(html, /DEMO DE PROPUESTA/);
    assert.match(fs.readFileSync(path.join(directory, 'robots.txt'), 'utf8'), /Sitemap: https:\/\/motorloz\.com\.uy\/sitemap\.xml/);
    assert.match(fs.readFileSync(path.join(directory, 'sitemap.xml'), 'utf8'), /<loc>https:\/\/motorloz\.com\.uy\/<\/loc>/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
