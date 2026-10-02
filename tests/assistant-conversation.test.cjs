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
    classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name), toggle: (name, force) => force === undefined ? (classes.has(name) ? classes.delete(name) : classes.add(name)) : force ? classes.add(name) : classes.delete(name) },
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

test('the first greeting and successive replies speak in the same voice flow without triggering booking', async () => {
  const nodes = new Map();
  const get = selector => {
    if (!nodes.has(selector)) nodes.set(selector, element());
    return nodes.get(selector);
  };
  const spokenTexts = [];
  const chatHistories = [];
  const contexts = [];
  let failSpeech = false;
  let speechFailureReason = 'limite_proveedor_voz';
  let transientSpeechFailures = 0;
  let deviceVoiceCalls = 0;
  let wavCalls = 0;
  let speechAttempts = 0;
  const popup = { location: { href: '' }, opener: null };
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
    'Desde que pasé un pozo vibra la caja y se enciende la luz del motor al acelerar': 'Entiendo. Esa combinación merece revisión; Pablo o Bruno pueden evaluar el auto. ¿Querés que preparemos la consulta para WhatsApp?',
    'Puede esperar una fecha, no es urgente': 'Perfecto, lo dejo como una consulta que puede esperar una fecha coordinada.',
    'Prepará la consulta para WhatsApp': 'Claro, podés revisar el mensaje antes de enviarlo.',
    '¿Y si falla la voz?': 'Te sigo respondiendo por escrito.',
    'Probá otra vez la voz': 'Ahora sí, te escucho.',
    '¿Qué pasó con el cupo?': 'El chat sigue disponible por texto.'
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
      speechAttempts += 1;
      if (failSpeech) return { ok:false, status:429, json:async () => ({ error:speechFailureReason }) };
      if (transientSpeechFailures > 0) { transientSpeechFailures -= 1; return { ok:false, status:503 }; }
      const text = JSON.parse(options.body).text;
      spokenTexts.push(text);
      const event = new TextEncoder().encode(`data: ${JSON.stringify({ event_type: 'step.delta', delta: { type: 'audio', data: 'AAAA' } })}\n\n`);
      let sent = false;
      return { ok: true, body: { getReader: () => ({ read: async () => sent ? { done: true } : (sent = true, { value: event, done: false }) }) } };
    }
    if (url.endsWith('/speech')) { wavCalls += 1; return { ok:false, status:failSpeech ? 429 : 503 }; }
    throw new Error(`Unexpected URL: ${url}`);
  };
  const context = {
    document: { querySelector: get, createElement: element, createTextNode: text => ({ textContent:text }), documentElement: element(), body: element(), addEventListener() {} },
    window: { AudioContext, SpeechRecognition: null, speechSynthesis: { speak: () => { deviceVoiceCalls += 1; }, cancel() {}, getVoices: () => [{ lang:'es-UY' }] }, SpeechSynthesisUtterance: class {}, innerWidth: 393, innerHeight: 800, open: () => popup, sessionStorage: { getItem:key=>session.get(key), setItem:(key,value)=>session.set(key,value), removeItem:key=>session.delete(key) },
      visualViewport: { height: 500, offsetTop: 0, addEventListener() {} }, setTimeout, addEventListener() {} },
    Audio, location: { search: '' }, URLSearchParams, URL: { revokeObjectURL() {} },
    fetch, setTimeout: (callback, delay) => setTimeout(callback, delay >= 700 ? 45 : delay), clearTimeout, setInterval, clearInterval,
    requestAnimationFrame: callback => callback(), AbortController, TextDecoder, atob
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assistant-widget.js'), 'utf8'), context);
  get('#assistant-launcher').listeners.click();
  await new Promise(resolve => setTimeout(resolve, 120));
  assert.equal(spokenTexts.length, 1, 'opening the chat speaks the visible greeting');
  assert.match(spokenTexts[0], /^Hola, soy tu asistente de MOTORLOZ\. Contame qué notaste en el auto/);
  assert.equal(get('#assistant-input').focusCount, 0, 'mobile opening leaves the keyboard closed');
  assert.equal(get('#assistant-window').style.getPropertyValue('--assistant-keyboard-offset'), '0px', 'the keyboard is handled by the visual viewport without a second bottom offset');
  context.document.activeElement = get('#assistant-input');
  get('#assistant-input').listeners.focus();
  await new Promise(resolve => setTimeout(resolve, 70));
  assert.equal(get('#assistant-window').classList.contains('is-keyboard-open'), true, 'focused input enables the compact keyboard-safe layout');
  context.document.activeElement = null;

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
  assert.equal(get('#assistant-reservation-prompt').hidden, true, 'symptom details alone do not push the customer toward WhatsApp');
  await send('Puede esperar una fecha, no es urgente');
  assert.equal(get('#assistant-reservation-prompt').hidden, false, 'the WhatsApp option appears as soon as the last missing detail arrives after a turn request');
  await send('Prepará la consulta para WhatsApp');
  assert.equal(get('#assistant-reservation-prompt').hidden, false, 'the WhatsApp option appears when the customer asks for it');
  const summaryCards = get('#assistant-messages').children.filter(item => item.className === 'assistant-summary-card');
  assert.ok(summaryCards.length, 'the conversation renders a real-data consultation summary before WhatsApp');
  const summaryValues = summaryCards.at(-1).children[1].children.map(row => row.children[1].textContent);
  assert.ok(summaryValues.some(value => /Subaru/.test(value)), 'the summary includes the discussed vehicle');
  assert.ok(summaryValues.some(value => /200\.000 km/.test(value)), 'the summary includes the discussed mileage');

  await get('#assistant-reserve-start').listeners.click();
  const draft = new URL(popup.location.href).searchParams.get('text');
  assert.match(draft, /\*CONSULTA MOTORLOZ\*\nPreparada desde el asistente\n\n\*01 · CLIENTE\*/);
  assert.doesNotMatch(draft, /Tel[eé]fono|099000000/);
  assert.match(draft, /- Nombre: Ana/);
  assert.match(draft, /\n\n\*02 · VEHÍCULO\*\n- Marca y modelo: Subaru\n- Kilometraje: 200\.000 km aprox\./);
  assert.match(draft, /\n\n\*03 · QUÉ NECESITA\*\nLa luz del tablero se encendió y el cliente quiere revisar el auto\./);
  assert.match(draft, /\n\n\*04 · PRIORIDAD\*\n- Puede esperar una fecha coordinada/);
  assert.match(draft, /\n\n\*05 · COORDINACIÓN\*/);
  assert.doesNotMatch(draft, /�/);
  assert.equal(get('#assistant-wa-retry').href, popup.location.href);
  assert.equal(get('#assistant-reservation-prompt').hidden, false, 'the conversation stays available while WhatsApp opens');

  failSpeech = true;
  await send('¿Y si falla la voz?');
  assert.equal(deviceVoiceCalls, 0, 'a quota failure never switches to a different phone voice');
  assert.equal(wavCalls, 0, 'a quota failure does not make another request for the same model');
  assert.equal(get('#assistant-status').textContent, 'Reconectando voz…');
  const attemptsBeforeRecovery = speechAttempts;
  failSpeech = false;
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.ok(speechAttempts > attemptsBeforeRecovery, 'the selected voice retries after a temporary rate limit');
  assert.equal(spokenTexts.at(-1), replies['¿Y si falla la voz?']);
  assert.equal(get('#assistant-status').textContent, 'Disponible');

  transientSpeechFailures = 1;
  await send('Probá otra vez la voz');
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.equal(spokenTexts.at(-1), replies['Probá otra vez la voz'], 'a transient voice failure retries the selected voice');
  assert.equal(get('#assistant-status').textContent, 'Disponible');

  failSpeech = true;
  speechFailureReason = 'limite_temporal';
  await send('¿Qué pasó con el cupo?');
  assert.equal(get('#assistant-status').textContent, 'Voz sin cupo');
  const attemptsAtSiteLimit = speechAttempts;
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.equal(speechAttempts, attemptsAtSiteLimit, 'a site limit does not trigger futile short retries');

  speechFailureReason = 'saldo_openai_agotado';
  await send('¿Qué pasó con el cupo?');
  assert.equal(get('#assistant-status').textContent, 'Voz sin saldo');
  const attemptsAtEmptyBalance = speechAttempts;
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.equal(speechAttempts, attemptsAtEmptyBalance, 'an exhausted balance does not make repeated billable requests');
  assert.equal(deviceVoiceCalls, 0, 'OpenAI balance errors never select a phone voice');

});
