(() => {
  const launcher = document.querySelector('#assistant-launcher');
  const panel = document.querySelector('#assistant-window');
  if (!launcher || !panel) return;

  const messagesEl = document.querySelector('#assistant-messages');
  const form = document.querySelector('#assistant-composer');
  const input = document.querySelector('#assistant-input');
  const sendButton = document.querySelector('.assistant-submit');
  const micButton = document.querySelector('#assistant-mic');
  const statusEl = document.querySelector('#assistant-status');
  const workingEl = document.querySelector('#assistant-working');
  const hintEl = document.querySelector('#assistant-composer-hint');
  const booking = document.querySelector('#assistant-booking');
  const reservationPrompt = document.querySelector('#assistant-reservation-prompt');
  const bookingForm = document.querySelector('#assistant-booking-form');
  const resetDialog = document.querySelector('#assistant-reset-confirm');
  const voiceToggle = document.querySelector('#assistant-voice-toggle');
  const voicePlayer = new Audio();
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const speechCache = new Map();
  const welcomeText = 'Hola, soy tu asistente MOTORLOZ. Contame qué notaste en tu auto y, si podés, la marca, el modelo y el kilometraje.';
  let history = [];
  let configured = false;
  let busy = false;
  let speechRecognition = null;
  let dictating = false;
  let finishingDictation = false;
  let dictationSession = 0;
  let dictationSegments = [];
  let recognitionFinal = '';
  let recognitionInterim = '';
  let recordingDraft = '';
  let recordingStart = 0;
  let recordingTimer = null;
  let maxRecordTimer = null;
  let finishTimer = null;
  let reservationDismissedAt = 0;
  let voiceEnabled = true;
  let voiceNeedsGesture = false;
  let voiceRequest = 0;
  let voiceUrl = '';
  let speechAbort = null;
  let speechQueue = [];
  let audioContext = null;
  let audioSources = new Set();
  let nextAudioTime = 0;
  let streamFinished = false;
  try { voiceEnabled = localStorage.getItem('motorloz-voice') !== 'off'; } catch {}
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  micButton.title = Recognition ? 'Dictar y enviar como texto' : 'Dictado no disponible en este navegador';
  hintEl.textContent = Recognition ? 'Dictá y tocá Terminar · se envía como texto' : 'Escribí o usá el dictado del teclado';
  const getMessageCount = () => history.filter(item => item.role === 'user').length;

  function updateVoiceToggle() {
    voiceToggle.classList.toggle('is-active', voiceEnabled);
    voiceToggle.classList.toggle('needs-gesture', voiceNeedsGesture);
    voiceToggle.setAttribute('aria-pressed', String(voiceEnabled));
    voiceToggle.setAttribute('aria-label', voiceNeedsGesture ? 'Tocá para activar la voz' : voiceEnabled ? 'Desactivar lectura automática' : 'Activar lectura automática');
    voiceToggle.title = voiceNeedsGesture ? 'Tocá para escuchar' : voiceEnabled ? 'Voz automática activada' : 'Voz automática desactivada';
  }

  function stopSpeech() {
    voiceRequest += 1;
    speechAbort?.abort();
    speechAbort = null;
    speechQueue = [];
    for (const source of audioSources) { try { source.stop(); } catch {} }
    audioSources.clear();
    nextAudioTime = 0;
    streamFinished = false;
    voicePlayer.pause();
    voicePlayer.removeAttribute('src');
    voicePlayer.load();
    if (voiceUrl) URL.revokeObjectURL(voiceUrl);
    voiceUrl = '';
    panel.querySelectorAll('.assistant-speak.is-playing,.assistant-speak.is-loading').forEach(button => button.classList.remove('is-playing', 'is-loading'));
  }

  function unlockAudio() {
    if (!AudioContextClass) return;
    try {
      audioContext ||= new AudioContextClass();
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    } catch { audioContext = null; }
  }

  async function streamSpeech(text, button, request) {
    if (!audioContext || audioContext.state !== 'running') throw new Error('audio_context_unavailable');
    const controller = new AbortController();
    speechAbort = controller;
    let received = false;
    let oddByte = null;
    let pending = '';
    const firstAudioTimeout = setTimeout(() => { if (!received) controller.abort(); }, 3200);
    const handleBlock = block => {
      const data = block.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
      if (!data || data === '[DONE]') return;
      let event;
      try { event = JSON.parse(data); } catch { return; }
      if (event.event_type !== 'step.delta' || event.delta?.type !== 'audio' || !event.delta.data) return;
      const raw = atob(event.delta.data);
      const bytes = new Uint8Array(raw.length + (oddByte === null ? 0 : 1));
      if (oddByte !== null) bytes[0] = oddByte;
      for (let i = 0; i < raw.length; i += 1) bytes[i + (oddByte === null ? 0 : 1)] = raw.charCodeAt(i);
      oddByte = bytes.length % 2 ? bytes.at(-1) : null;
      const samples = bytes.length >> 1;
      if (!samples || request !== voiceRequest) return;
      const buffer = audioContext.createBuffer(1, samples, 24000);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < samples; i += 1) {
        const value = bytes[i * 2] | (bytes[i * 2 + 1] << 8);
        channel[i] = (value >= 32768 ? value - 65536 : value) / 32768;
      }
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      const start = Math.max(nextAudioTime, audioContext.currentTime + .035);
      source.start(start);
      nextAudioTime = start + buffer.duration;
      audioSources.add(source);
      source.onended = () => {
        audioSources.delete(source);
        if (streamFinished && !audioSources.size) button?.classList.remove('is-playing');
      };
      received = true;
      clearTimeout(firstAudioTimeout);
      button?.classList.remove('is-loading');
      button?.classList.add('is-playing');
    };
    try {
      const response = await fetch('/api/assistant/speech-stream', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({text}), signal:controller.signal
      });
      if (!response.ok || !response.body) throw new Error('speech_stream_unavailable');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done || request !== voiceRequest) break;
        pending += decoder.decode(value,{stream:true});
        const blocks = pending.split(/\r?\n\r?\n/);
        pending = blocks.pop() || '';
        blocks.forEach(handleBlock);
      }
      if (pending.trim()) handleBlock(pending);
      if (!received) throw new Error('speech_stream_empty');
      streamFinished = true;
      if (!audioSources.size) button?.classList.remove('is-playing');
      return true;
    } catch (error) {
      if (received) { streamFinished = true; return true; }
      throw error;
    } finally {
      clearTimeout(firstAudioTimeout);
      if (speechAbort === controller) speechAbort = null;
    }
  }

  function speechParts(text) {
    const sentences = text.match(/[^.!?]+[.!?]?/g) || [text];
    const parts = [];
    for (const sentence of sentences) {
      let value = sentence.trim();
      if (!value) continue;
      while (value.length > 125) {
        const clause = Math.max(value.lastIndexOf(', ', 112), value.lastIndexOf('; ', 112));
        const cut = clause >= 55 ? clause + 1 : Math.max(55, value.lastIndexOf(' ', 112));
        parts.push(value.slice(0, cut).trim());
        value = value.slice(cut).trim();
      }
      if (!value) continue;
      if (parts.length && `${parts.at(-1)} ${value}`.length <= 115) parts[parts.length - 1] += ` ${value}`;
      else parts.push(value);
    }
    return parts.length ? parts : [text];
  }

  async function fetchSpeech(text, signal) {
    if (speechCache.has(text)) return speechCache.get(text);
    const response = await fetch('/api/assistant/speech', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }), signal
    });
    if (!response.ok) throw new Error('speech_unavailable');
    const audio = await response.blob();
    if (audio.type !== 'audio/wav' || audio.size < 44) throw new Error('speech_invalid');
    speechCache.set(text, audio);
    if (speechCache.size > 16) speechCache.delete(speechCache.keys().next().value);
    return audio;
  }

  async function playSpeechPart(part, button, request) {
    if (request !== voiceRequest || panel.hidden) return;
    const audio = await part;
    if (request !== voiceRequest || panel.hidden) return;
    if (voiceUrl) URL.revokeObjectURL(voiceUrl);
    voiceUrl = URL.createObjectURL(audio);
    voicePlayer.src = voiceUrl;
    voicePlayer.currentTime = 0;
    await voicePlayer.play();
    voiceNeedsGesture = false;
    updateVoiceToggle();
    button?.classList.remove('is-loading');
    button?.classList.add('is-playing');
  }

  async function speakReply(text, button = null, automatic = false) {
    if (!configured || (automatic && !voiceEnabled)) return;
    stopSpeech();
    unlockAudio();
    const request = voiceRequest;
    button?.classList.add('is-loading');
    try {
      if (audioContext) {
        try {
          if (audioContext.state === 'suspended') await Promise.race([
            audioContext.resume().catch(() => {}),
            new Promise(resolve => setTimeout(resolve, 500))
          ]);
          await streamSpeech(text, button, request);
          return;
        } catch {
          if (request !== voiceRequest) return;
          if (audioSources.size) { streamFinished = true; return; }
        }
      }
      const controller = new AbortController();
      speechAbort = controller;
      speechQueue = speechParts(text).map(part => fetchSpeech(part, controller.signal));
      await playSpeechPart(speechQueue.shift(), button, request);
    } catch (error) {
      if (request !== voiceRequest) return;
      if (error.name === 'NotAllowedError') {
        voiceNeedsGesture = true;
        updateVoiceToggle();
        button?.setAttribute('aria-label', 'Tocá para escuchar esta respuesta');
      } else {
        button?.setAttribute('aria-label', 'Voz no disponible por ahora');
        voiceToggle.title = 'Voz no disponible por ahora';
      }
    } finally {
      button?.classList.remove('is-loading');
    }
  }
  voicePlayer.addEventListener('ended', async () => {
    if (!speechQueue.length) {
      panel.querySelectorAll('.assistant-speak.is-playing').forEach(button => button.classList.remove('is-playing'));
      return;
    }
    const next = speechQueue.shift();
    const button = panel.querySelector('.assistant-speak.is-playing');
    try { await playSpeechPart(next, button, voiceRequest); }
    catch { button?.classList.remove('is-playing'); }
  });
  updateVoiceToggle();

  function bubble(text, role, extra = {}) {
    const row = document.createElement('div');
    row.className = `assistant-message assistant-message-${role}`;
    const copy = document.createElement('p');
    copy.textContent = text;
    row.append(copy);
    if (role === 'assistant' && !extra.pending && configured) {
      const speakButton = document.createElement('button');
      speakButton.className = 'assistant-speak';
      speakButton.type = 'button';
      speakButton.setAttribute('aria-label', 'Escuchar respuesta');
      speakButton.title = 'Escuchar respuesta';
      speakButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"></path><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"></path></svg>';
      speakButton.addEventListener('click', () => speakReply(text, speakButton));
      row.append(speakButton);
    }
    if (extra.pending) row.classList.add('is-pending');
    messagesEl.append(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return row;
  }

  function welcome() {
    messagesEl.replaceChildren();
    booking.hidden = true;
    reservationPrompt.hidden = true;
    history = [];
    reservationDismissedAt = 0;
    const greeting = bubble(welcomeText, 'assistant');
    if (!configured) bubble('La conexión con la inteligencia artificial todavía no está configurada. El formulario de consulta sigue disponible en la página.', 'assistant');
    messagesEl.scrollTop = 0;
    return greeting;
  }

  async function checkStatus() {
    try {
      const response = await fetch('/api/assistant/status', { cache: 'no-store' });
      const status = await response.json();
      configured = Boolean(status.configured);
      statusEl.textContent = configured ? 'Disponible para conversar' : 'Falta conectar la IA';
      panel.classList.toggle('is-offline', !configured);
      input.disabled = !configured;
      sendButton.disabled = !configured;
      micButton.disabled = !configured;
      if (!configured) hintEl.textContent = 'El asistente se activa al configurar la conexión privada.';
      const greeting = welcome();
      if (configured && voiceEnabled && !panel.hidden) speakReply(welcomeText, greeting.querySelector('.assistant-speak'), true);
    } catch {
      statusEl.textContent = 'Conexión no disponible';
      configured = false;
      input.disabled = true;
      sendButton.disabled = true;
      micButton.disabled = true;
      welcome();
    }
  }

  function setBusy(value) {
    busy = value;
    workingEl.hidden = !value;
    sendButton.disabled = value || !configured;
    micButton.disabled = value || !configured;
    input.disabled = value || !configured;
  }

  function maybeShowBooking() {
    const count = getMessageCount();
    if (count >= 1 && (reservationDismissedAt === 0 || count >= reservationDismissedAt + 2)) reservationPrompt.hidden = false;
  }

  async function requestReply(userMessage) {
    if (!configured || busy) return;
    history.push({ role: 'user', content: userMessage });
    const pending = bubble('Dame un momento, ya te leo…', 'assistant', { pending: true });
    setBusy(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 22_000);
    try {
      const response = await fetch('/api/assistant/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }), signal:controller.signal
      });
      const result = await response.json();
      pending.remove();
      if (!response.ok) throw new Error(result.message || 'No pude responder en este momento.');
      history.push({ role: 'assistant', content: result.reply });
      const reply = bubble(result.reply, 'assistant');
      speakReply(result.reply, reply.querySelector('.assistant-speak'), true);
      maybeShowBooking();
    } catch (error) {
      pending.remove();
      history.pop();
      bubble(error.name === 'AbortError' ? 'La respuesta demoró demasiado. Probá de nuevo o escribinos por el formulario.' : error.message || 'No pude responder ahora. Probá de nuevo o escribinos por el formulario.', 'assistant');
    } finally {
      clearTimeout(timeout);
      setBusy(false);
      input.focus({ preventScroll: true });
    }
  }

  function sendText(value) {
    const text = String(value || '').trim();
    if (!text || busy) return;
    stopSpeech();
    unlockAudio();
    bubble(text, 'user');
    input.value = '';
    input.style.height = 'auto';
    requestReply(text);
  }

  function dictatedText() {
    return [recordingDraft, ...dictationSegments, recognitionFinal, recognitionInterim].filter(Boolean).join(' ').trim().slice(0, 1200);
  }

  function showDictatedText() {
    input.value = dictatedText();
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 112)}px`;
  }

  function clearDictationUi() {
    clearInterval(recordingTimer);
    clearTimeout(maxRecordTimer);
    clearTimeout(finishTimer);
    document.querySelector('#assistant-recording').hidden = true;
    micButton.classList.remove('is-recording');
    hintEl.hidden = false;
    input.placeholder = 'Contame qué notaste…';
  }

  function completeDictation(session) {
    if (session !== dictationSession || !finishingDictation) return;
    const text = dictatedText();
    dictating = false;
    finishingDictation = false;
    speechRecognition = null;
    clearDictationUi();
    recordingDraft = '';
    dictationSegments = [];
    recognitionFinal = '';
    recognitionInterim = '';
    if (text) sendText(text);
    else { input.value = ''; hintEl.textContent = 'No se detectó voz. Probá otra vez o escribí tu consulta.'; }
  }

  function finishDictation() {
    if (!dictating || finishingDictation) return;
    finishingDictation = true;
    const session = dictationSession;
    clearInterval(recordingTimer);
    clearTimeout(maxRecordTimer);
    try { speechRecognition?.stop(); } catch { completeDictation(session); return; }
    finishTimer = setTimeout(() => completeDictation(session), 1800);
  }

  function startDictation() {
    if (!Recognition) {
      bubble('Este navegador no ofrece dictado en la página. Usá el micrófono del teclado o escribí tu consulta; al asistente solo le llega texto.', 'assistant');
      input.focus({ preventScroll:true });
      return;
    }
    if (busy || dictating) return;
    stopSpeech();
    unlockAudio();
    const session = ++dictationSession;
    dictating = true;
    finishingDictation = false;
    recordingDraft = input.value.trim();
    dictationSegments = [];
    recognitionFinal = '';
    recognitionInterim = '';
    const recognizer = new Recognition();
    recognizer.lang = 'es-UY';
    recognizer.continuous = true;
    recognizer.interimResults = true;
    recognizer.maxAlternatives = 1;
    recognizer.addEventListener('result', event => {
      if (session !== dictationSession) return;
      const final = [];
      const interim = [];
      for (const result of Array.from(event.results)) {
        const phrase = result[0]?.transcript?.trim();
        if (phrase) (result.isFinal ? final : interim).push(phrase);
      }
      recognitionFinal = final.join(' ');
      recognitionInterim = interim.join(' ');
      showDictatedText();
    });
    recognizer.addEventListener('error', event => {
      if (session !== dictationSession || ['no-speech', 'aborted'].includes(event.error)) return;
      dictationSession += 1;
      dictating = false;
      finishingDictation = false;
      speechRecognition = null;
      clearDictationUi();
      showDictatedText();
      hintEl.textContent = event.error === 'not-allowed' ? 'Permití el micrófono para dictar, o escribí tu consulta.' : 'No pude seguir el dictado. El texto visible queda listo para enviar.';
    });
    recognizer.addEventListener('end', () => {
      if (session !== dictationSession) return;
      if (finishingDictation) { completeDictation(session); return; }
      if (!dictating) return;
      dictationSegments.push(...[recognitionFinal, recognitionInterim].filter(Boolean));
      recognitionFinal = '';
      recognitionInterim = '';
      setTimeout(() => {
        if (session !== dictationSession || !dictating || finishingDictation) return;
        try { recognizer.start(); }
        catch { finishDictation(); }
      }, 150);
    });
    try { recognizer.start(); }
    catch {
      dictationSession += 1;
      dictating = false;
      hintEl.textContent = 'No pude iniciar el dictado. Probá el micrófono del teclado o escribí.';
      return;
    }
    speechRecognition = recognizer;
    recordingStart = Date.now();
    micButton.classList.add('is-recording');
    document.querySelector('#assistant-recording').hidden = false;
    hintEl.hidden = true;
    input.placeholder = 'Tus palabras aparecen acá…';
    recordingTimer = setInterval(() => {
      const seconds = Math.min(60, Math.floor((Date.now() - recordingStart) / 1000));
      document.querySelector('#assistant-recording-time').textContent = `00:${String(seconds).padStart(2, '0')}`;
    }, 250);
    maxRecordTimer = setTimeout(finishDictation, 60_000);
  }

  function cancelDictation() {
    dictationSession += 1;
    dictating = false;
    finishingDictation = false;
    try { speechRecognition?.abort(); } catch {}
    speechRecognition = null;
    clearDictationUi();
  }

  function open() {
    unlockAudio();
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add('is-open'));
    panel.setAttribute('aria-hidden', 'false');
    launcher.setAttribute('aria-expanded', 'true');
    checkStatus();
    window.setTimeout(() => (configured ? input : document.querySelector('#assistant-close')).focus({ preventScroll: true }), 90);
  }

  function close() {
    stopSpeech();
    cancelDictation();
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    launcher.setAttribute('aria-expanded', 'false');
    resetDialog.hidden = true;
    window.setTimeout(() => { panel.hidden = true; welcome(); }, 220);
    launcher.focus({ preventScroll: true });
  }

  launcher.addEventListener('click', () => panel.hidden ? open() : close());
  voiceToggle.addEventListener('click', async () => {
    unlockAudio();
    if (voiceNeedsGesture && voicePlayer.src) {
      try { await voicePlayer.play(); voiceNeedsGesture = false; updateVoiceToggle(); return; } catch {}
    }
    voiceEnabled = !voiceEnabled;
    voiceNeedsGesture = false;
    if (!voiceEnabled) stopSpeech();
    try { localStorage.setItem('motorloz-voice', voiceEnabled ? 'on' : 'off'); } catch {}
    updateVoiceToggle();
  });
  document.querySelector('#assistant-close').addEventListener('click', close);
  document.querySelector('#assistant-new').addEventListener('click', () => { resetDialog.hidden = false; });
  document.querySelector('#assistant-reset-no').addEventListener('click', () => { resetDialog.hidden = true; });
  document.querySelector('#assistant-reset-yes').addEventListener('click', () => { resetDialog.hidden = true; stopSpeech(); cancelDictation(); const greeting = welcome(); if (configured && voiceEnabled) speakReply(welcomeText, greeting.querySelector('.assistant-speak'), true); input.focus(); });
  document.querySelector('#assistant-stop-recording').addEventListener('click', finishDictation);
  document.querySelector('#assistant-mic').addEventListener('click', () => dictating ? finishDictation() : startDictation());
  document.querySelector('#assistant-privacy-link').addEventListener('click', event => { event.preventDefault(); close(); document.querySelector('#turno').scrollIntoView({ behavior: 'smooth' }); });
  document.querySelector('#assistant-booking-close').addEventListener('click', () => { booking.hidden = true; messagesEl.scrollTop = messagesEl.scrollHeight; });
  form.addEventListener('submit', event => { event.preventDefault(); if (dictating) finishDictation(); else sendText(input.value); });
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 112)}px`; });
  input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); } });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) close(); });

  document.querySelector('#assistant-reserve-start').addEventListener('click', () => {
    reservationPrompt.hidden = true;
    booking.hidden = false;
    booking.scrollTop = 0;
    bookingForm.querySelector('[name="name"]').focus({ preventScroll: true });
  });
  document.querySelector('#assistant-reserve-later').addEventListener('click', () => {
    reservationDismissedAt = getMessageCount();
    reservationPrompt.hidden = true;
  });
  bookingForm.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(bookingForm);
    const values = Object.fromEntries(data.entries());
    const submitButton = bookingForm.querySelector('.assistant-send-whatsapp');
    const originalButtonText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.textContent = 'Ordenando la consulta…';
    let issueSummary = '';
    try {
      const response = await fetch('/api/assistant/summary', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history })
      });
      const result = await response.json();
      if (response.ok) issueSummary = String(result.summary || '').trim();
    } catch {}
    if (!issueSummary) {
      issueSummary = history.filter(item => item.role === 'assistant').slice(-2).map(item => item.content).join(' ').slice(0, 420);
    }
    const lines = [
      'Hola, quiero coordinar una revisión con MOTORLOZ.',
      `Nombre: ${values.name}`,
      `Teléfono: ${values.phone}`,
      `Coordinación: ${values.priority}`,
      values.availability ? `Disponibilidad: ${values.availability}` : '',
      `Resumen para el mecánico: ${issueSummary.slice(0, 600)}`,
      'Resumen inicial basado en lo relatado; no es un diagnóstico confirmado.'
    ].filter(Boolean);
    const url = `https://wa.me/${window.MOTORLOZ?.whatsapp || '59891888288'}?text=${encodeURIComponent(lines.join('\n'))}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    booking.hidden = true;
    bookingForm.reset();
    submitButton.disabled = false;
    submitButton.innerHTML = originalButtonText;
  });

  welcome();
  if (new URLSearchParams(location.search).get('asistente') === '1') open();
})();
