const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync(`${__dirname}/../index.html`, 'utf8');
const entryScript = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];

test('the brand intro appears on a fresh page load even with a section link', () => {
  const classes = new Set();
  vm.runInNewContext(entryScript, {
    document: { documentElement: { classList: { add: name => classes.add(name) } } },
    location: { hash: '#hyundai', search: '' },
    sessionStorage: { getItem: () => 'seen' },
    matchMedia: () => ({ matches: false })
  });
  assert.ok(classes.has('brand-intro-active'));
});

test('the brand intro respects reduced-motion settings', () => {
  const classes = new Set();
  vm.runInNewContext(entryScript, {
    document: { documentElement: { classList: { add: name => classes.add(name) } } },
    matchMedia: () => ({ matches: true })
  });
  assert.equal(classes.size, 0);
});
