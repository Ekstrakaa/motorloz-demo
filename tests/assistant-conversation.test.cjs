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
    hidden: true, disabled: false, value: '', children: [], listeners, focusCount: 0, dataset: {},
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
  get('#assistant-booking-form').elements = Object.fromEntries(['name', 'issue', 'vehicle', 'year', 'mileage'].map(name => [name, element()]));
  get('#assistant-booking-form').querySelector = () => element();
  const spokenTexts = [];
  const chatHistories = [];
  const contexts = [];
  let openedUrl = '';
  const session = new Map();
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
    'Tengo un Subaru, unos 200 mil kilómetros y anda mal': 'Entiendo. ¿Qué notás exactamente y desde cuándo empezó?',
    'Quiero reservar un turno': 'Claro, podemos preparar una consulta para coordinarlo.',
    'Me llamo Ana': 'Gracias, Ana. Contame un poco más de la falla.',
    'Desde que pasé un pozo vibra la caja y se enciende la luz del motor al acelerar': 'Entiendo. Esa combinación merece revisión; Pablo o Bruno pueden evaluar el auto. ¿Querés que preparemos la consulta para WhatsApp?'
  };
  const fetch = async (url, options) => {
    if (url.endsWith('/status')) return { ok: true, json: async () => ({ configured: true }) };
    if (url.endsWith('/chat')) {
      const messages = JSON.parse(options.body).messages;
      chatHistories.push(messages);
      const message = messages.at(-1).content;
      return { ok: true, json: async () => ({ reply: replies[message] }) };
    }
    if (url.endsWith('/summary')) return { ok:true, json:async () => ({ summary:'La luz del tablero se encendió y el cliente quiere revisar el auto.' }) };
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
    document: { querySelector: get, createElement: element, createTextNode: text => ({ textContent:text }), documentElement: element(), body: element(), addEventListener() {} },
    window: { AudioContext, SpeechRecognition: null, innerWidth: 393, innerHeight: 800, open: url => { openedUrl = url; }, sessionStorage: { getItem:key=>session.get(key), setItem:(key,value)=>session.set(key,value), removeItem:key=>session.delete(key) },
      visualViewport: { height: 500, offsetTop: 0, addEventListener() {} }, setTimeout, addEventListener() {} },
    Audio, location: { search: '' }, URLSearchParams, URL: { revokeObjectURL() {} },
    FormData: class { entries() { return Object.entries({ name:'Prueba', vehicle:'Subaru Forester', year:'2014', mileage:'130.000 km', issue:'Se encendió la luz del motor al acelerar.', availability:'', priority:'Consulta coordinada' }); } },
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
  assert.equal(JSON.parse(session.get('motorloz-assistant-conversation-v1'))[0].content, 'Hola');
  assert.equal(get('#assistant-input').focusCount, 0, 'answer does not refocus and move the page');

  const spokenBeforeReopen = spokenTexts.length;
  get('#assistant-launcher').listeners.click();
  await new Promise(resolve => setTimeout(resolve, 240));
  get('#assistant-launcher').listeners.click();
  await new Promise(resolve => setTimeout(resolve, 120));
  assert.equal(spokenTexts.length, spokenBeforeReopen, 'reopening does not restart the welcome audio');

  contexts[0].state = 'interrupted';
  await send('Tengo un Subaru, unos 200 mil kilómetros y anda mal');
  assert.equal(spokenTexts.at(-1), replies['Tengo un Subaru, unos 200 mil kilómetros y anda mal']);
  assert.deepEqual(chatHistories.at(-1).map(item => item.content), ['Hola', replies.Hola, 'Tengo un Subaru, unos 200 mil kilómetros y anda mal']);
  assert.ok(contexts[0].resumes >= 2, 'the next user gesture resumes interrupted audio');
  assert.equal(get('#assistant-reservation-prompt').hidden, true);

  get('#assistant-mute').listeners.click();
  const beforeMuteReply = spokenTexts.length;
  await send('Quiero reservar un turno');
  assert.equal(spokenTexts.length, beforeMuteReply, 'muting the header silences the next answer');
  assert.equal(get('#assistant-reservation-prompt').hidden, true, 'asking for a turn is too early without useful symptom details');
  get('#assistant-mute').listeners.click();
  assert.equal(spokenTexts.at(-1), replies['Quiero reservar un turno'], 'unmuting reads the current answer');

  await send('Me llamo Ana');
  assert.equal(get('#assistant-reservation-prompt').hidden, true);
  await send('Desde que pasé un pozo vibra la caja y se enciende la luz del motor al acelerar');
  assert.equal(get('#assistant-reservation-prompt').hidden, false, 'the WhatsApp option appears after a substantive follow-up');

  get('#assistant-reserve-start').listeners.click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(get('#assistant-booking-form').elements.name.value, 'Ana');
  assert.equal(get('#assistant-booking-form').elements.vehicle.value, 'Subaru');
  assert.equal(get('#assistant-booking-form').elements.mileage.value, '200.000 km aprox.');
  assert.equal(get('#assistant-booking-form').elements.issue.value, 'La luz del tablero se encendió y el cliente quiere revisar el auto.');
  get('#assistant-booking-form').listeners.submit({ preventDefault() {} });
  const draft = new URL(openedUrl).searchParams.get('text');
  assert.match(draft, /\*CONSULTA MOTORLOZ\*\nPreparada desde el asistente\n\n\*01 · CLIENTE\*/);
  assert.doesNotMatch(draft, /Tel[eé]fono|099000000/);
  assert.match(draft, /\n\n\*02 · VEHÍCULO\*\n- Marca y modelo: Subaru Forester/);
  assert.match(draft, /\n\n\*03 · QUÉ OCURRE\*\nSe encendió la luz del motor al acelerar\./);
  assert.match(draft, /\n\n\*04 · COORDINACIÓN\*/);
  assert.doesNotMatch(draft, /�/);
  assert.equal(get('#assistant-wa-retry').href, openedUrl);

});
