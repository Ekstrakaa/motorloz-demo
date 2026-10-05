const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function node(tag = 'div') {
  const classes = new Set();
  const listeners = new Map();
  return {
    tag, children: [], dataset: {}, style: { setProperty() {} }, currentTime: 0,
    classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) },
    append(child) { child.parent = this; this.children.push(child); },
    replaceChildren() { this.children.forEach(child => { child.parent = null; }); this.children = []; },
    querySelector(selector) { return this.children.find(child => child.tag === selector) || null; },
    querySelectorAll(selector) { return selector === '.cinema-frame' ? this.frames : []; },
    setAttribute() {}, removeAttribute() {},
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type) { listeners.delete(type); },
    dispatch(type) { listeners.get(type)?.(); },
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); },
    play() { this.plays = (this.plays || 0) + 1; return Promise.resolve(); },
    pause() { this.pauses = (this.pauses || 0) + 1; },
    load() {}, decode() { return Promise.resolve(); }
  };
}
function setup() {
  const frames = [node(), node()];
  const root = node();
  root.frames = frames;
  frames[0].classList.add('is-current');
  const timers = new Map();
  let id = 0;
  const setTimeout = (fn, ms) => { timers.set(++id, { fn, ms }); return id; };
  const clearTimeout = timer => timers.delete(timer);
  const document = {
    hidden: false, documentElement: { classList: { contains: () => false } },
    querySelector: selector => selector === '.hero-cinema' ? root : node(),
    createElement: node, addEventListener() {}
  };
  const window = { setTimeout, addEventListener() {} };
  vm.runInNewContext(fs.readFileSync(__dirname + '/../hero-cinema.js', 'utf8'), {
    document, window, clearTimeout, location: { search: '' }, URLSearchParams,
    Image: class { constructor() { return node('img'); } },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    IntersectionObserver: class { observe() {} }
  });
  return { frames, root, timers, fire(ms) {
    const entry = [...timers].find(([, value]) => value.ms === ms);
    assert.ok(entry, `expected timer ${ms}ms`);
    timers.delete(entry[0]);
    entry[1].fn();
  } };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

test('the next home video is ready before the outgoing footage fades', async () => {
  const h = setup();
  const first = h.frames[0].querySelector('video');
  assert.equal(first.src, 'assets/cinema-hyundai-natural.mp4');
  assert.equal(first.playbackRate, 1);
  first.dispatch('loadeddata');
  await flush();
  assert.equal(h.root.classList.contains('is-ready'), true);
  h.fire(8700);
  const second = h.frames[1].querySelector('video');
  assert.equal(second.src, 'assets/cinema-workshop-panorama.mp4');
  assert.equal(h.frames[0].classList.contains('is-current'), true);
  assert.equal(h.frames[1].classList.contains('is-current'), false);
  second.dispatch('loadeddata');
  await flush();
  assert.equal(h.frames[1].classList.contains('is-current'), true);
  assert.equal(h.frames[0].classList.contains('is-current'), false);
  h.fire(1310);
  assert.ok(first.pauses > 0);
  assert.equal(h.frames[0].children.length, 0);
  assert.ok([...h.timers.values()].some(timer => timer.ms === 3800));
});

test('the home sequence moves from a video to a photo with a three-second hold', async () => {
  const h = setup();
  h.frames[0].querySelector('video').dispatch('loadeddata');
  await flush();
  h.fire(8700);
  h.frames[1].querySelector('video').dispatch('loadeddata');
  await flush();
  h.fire(1310);
  h.fire(3800);
  await flush();
  assert.equal(h.frames[0].dataset.kind, 'image');
  h.fire(1310);
  assert.ok([...h.timers.values()].some(timer => timer.ms === 3000));
});

test('Hyundai official section has one film, outside the photo rail', () => {
  const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
  const official = html.match(/<div class="hyundai-gallery"[\s\S]*?<\/div>/)?.[0] || '';
  assert.equal((official.match(/<video\b/g) || []).length, 1);
  assert.equal((official.match(/hyundai-video-slide/g) || []).length, 1);
  assert.ok(official.includes('hyundai-service-reveal.mp4'));
});
