const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function element() {
  const listeners = {};
  const classes = new Set();
  const styleValues = new Map();
  return {
    hidden: true, disabled: false, value: '', children: [], listeners, focusCount: 0,
    style: { setProperty: (key, value) => styleValues.set(key, value), getPropertyValue: key => styleValues.get(key) },
    classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name), toggle: () => {} },
    addEventListener: (name, listener) => { listeners[name] = listener; },
    setAttribute() {}, removeAttribute() {},
    focus() { this.focusCount += 1; },
    append(...items) { this.children.push(...items); },
    replaceChildren() { this.children = []; },
    querySelector(selector) { return selector === '.assistant-speak' ? this.children.find(item => item.className === 'assistant-speak') || null : null; },
    querySelectorAll() { return []; },
    remove() {},
    scrollHeight: 30, scrollTop: 0
  };
}

test('two successive replies speak their own text and a greeting does not trigger booking', async () => {
  const nodes = new Map();
  const get = selector => {
    if (!nodes.has(selector)) nodes.set(selector, element());
    return nodes.get(selector);
  };
  const spokenTexts = [];
  const chatHistories = [];
  const contexts = [];
  class AudioContext {
    constructor() { this.state = 'suspended'; this.currentTime = 0; this.destination = {}; this.resumes = 0; contexts.push(this); }
    addEventListener() {}
    resume() { this.state = 'running'; this.resumes += 1; return Promise.resolve(); }
    createBuffer(_channels, samples) { return { duration: .01, getChannelData: () => new Float32Array(samples) }; }
    createBufferSource() { return { connect() {}, start() {}, stop() {} }; }
  }
  class Audio {
    addEventListener() {} pause() {} removeAttribute() {} load() {}
    async play() { throw new Error('stream should be used'); }
  }
  const replies = {
    Hola: '¡Hola! ¿Qué está pasando con tu auto?',
    'Se encendió una luz en el tablero': 'Entiendo. ¿Qué luz se encendió y cuándo apareció?',
    'Quiero reservar un turno': 'Claro, podemos preparar una consulta para coordinarlo.'
  };
  const fetch = async (url, options) => {
    if (url.endsWith('/status')) return { ok: true, json: async () => ({ configured: true }) };
    if (url.endsWith('/chat')) {
      const messages = JSON.parse(options.body).messages;
      chatHistories.push(messages);
      const message = messages.at(-1).content;
      return { ok: true, json: async () => ({ reply: replies[message] }) };
    }
    if (url.endsWith('/speech-stream')) {
      const text = JSON.parse(options.body).text;
      spokenTexts.push(text);
      const event = new TextEncoder().encode(`data: ${JSON.stringify({ event_type: 'step.delta', delta: { type: 'audio', data: 'AAAA' } })}\n\n`);
      let sent = false;
      return { ok: true, body: { getReader: () => ({ read: async () => sent ? { done: true } : (sent = true, { value: event, done: false }) }) } };
    }
    throw new Error(`Unexpected URL: ${url}`);
  };
  const context = {
    document: { querySelector: get, createElement: element, documentElement: element(), body: element(), addEventListener() {} },
    window: { AudioContext, SpeechRecognition: null, innerWidth: 393, innerHeight: 800,
      visualViewport: { height: 500, offsetTop: 0, addEventListener() {} }, setTimeout, addEventListener() {} },
    Audio, location: { search: '' }, URLSearchParams, URL: { revokeObjectURL() {} },
    fetch, setTimeout, clearTimeout, setInterval, clearInterval,
    requestAnimationFrame: callback => callback(), AbortController, TextDecoder, atob
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assistant-widget.js'), 'utf8'), context);
  get('#assistant-launcher').listeners.click();
  await new Promise(resolve => setTimeout(resolve, 120));
  assert.equal(get('#assistant-input').focusCount, 0, 'mobile opening leaves the keyboard closed');
  assert.equal(get('#assistant-window').style.getPropertyValue('--assistant-keyboard-offset'), '300px');

  const send = async message => {
    get('#assistant-input').value = message;
    get('#assistant-composer').listeners.submit({ preventDefault() {} });
    await new Promise(resolve => setTimeout(resolve, 25));
  };
  await send('Hola');
  assert.equal(spokenTexts.at(-1), replies.Hola);
  assert.equal(get('#assistant-reservation-prompt').hidden, true);
  assert.equal(get('#assistant-input').focusCount, 0, 'answer does not refocus and move the page');

  const spokenBeforeReopen = spokenTexts.length;
  get('#assistant-launcher').listeners.click();
  await new Promise(resolve => setTimeout(resolve, 240));
  get('#assistant-launcher').listeners.click();
  await new Promise(resolve => setTimeout(resolve, 120));
  assert.equal(spokenTexts.length, spokenBeforeReopen, 'reopening does not restart the welcome audio');

  contexts[0].state = 'interrupted';
  await send('Se encendió una luz en el tablero');
  assert.equal(spokenTexts.at(-1), replies['Se encendió una luz en el tablero']);
  assert.deepEqual(chatHistories.at(-1).map(item => item.content), ['Hola', replies.Hola, 'Se encendió una luz en el tablero']);
  assert.ok(contexts[0].resumes >= 2, 'the next user gesture resumes interrupted audio');
  assert.equal(get('#assistant-reservation-prompt').hidden, true);

  await send('Quiero reservar un turno');
  assert.equal(spokenTexts.at(-1), replies['Quiero reservar un turno']);
  assert.equal(get('#assistant-reservation-prompt').hidden, false);
});
