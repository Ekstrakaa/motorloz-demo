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
  const recordingState = document.querySelector('#assistant-recording-state');
  const voicePlayer = new Audio();
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const speechCache = new Map();
  const welcomeText = 'Hola, soy tu asistente MOTORLOZ. Contame qué notaste en tu auto y, si podés, la marca, el modelo y el kilometraje.';
  let history = [];
  let configured = false;
  let statusChecked = false;
  let busy = false;
  let closeTimer = null;
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
  let recognitionRestartTimer = null;
  let rapidRecognitionStops = 0;
  let recognitionStartedAt = 0;
  let voiceRequest = 0;
  let voiceUrl = '';
  let speechAbort = null;
  let activeSpeechButton = null;
  let audioContext = null;
  let audioSources = new Set();
  let nextAudioTime = 0;
  let streamFinished = false;
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  micButton.title = Recognition ? 'Dictar y enviar como texto' : 'Dictado no disponible en este navegador';
  hintEl.textContent = Recognition ? 'Dictá y tocá Terminar · se envía como texto' : 'Escribí o usá el dictado del teclado';

  function stopSpeech() {
    voiceRequest += 1;
    speechAbort?.abort();
    speechAbort = null;
    activeSpeechButton = null;
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
      if (!audioContext) {
        audioContext = new AudioContextClass();
        audioContext.addEventListener?.('statechange', () => {
          if (audioContext.state !== 'running' && activeSpeechButton && !panel.hidden) {
            audioContext.resume().catch(() => {});
          }
        });
      }
      if (audioContext.state !== 'running') {
        audioContext.resume().catch(() => {});
        const silent = audioContext.createBuffer(1, 1, 24000);
        const source = audioContext.createBufferSource();
        source.buffer = silent;
        source.connect(audioContext.destination);
        source.start(0);
      }
    } catch { audioContext = null; }
  }

  async function streamSpeech(text, button, request) {
    if (!audioContext || audioContext.state !== 'running') throw new Error('audio_context_unavailable');
    const controller = new AbortController();
    speechAbort = controller;
    let received = false;
    let oddByte = null;
    let pending = '';
    const firstAudioTimeout = setTimeout(() => { if (!received) controller.abort(); }, 9000);
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

  async function playSpeechPart(text, button, request, controller) {
    if (request !== voiceRequest || panel.hidden) return;
    const audio = await fetchSpeech(text, controller.signal);
    if (request !== voiceRequest || panel.hidden) return;
    if (voiceUrl) URL.revokeObjectURL(voiceUrl);
    voiceUrl = URL.createObjectURL(audio);
    voicePlayer.src = voiceUrl;
    voicePlayer.currentTime = 0;
    await voicePlayer.play();
    if (request !== voiceRequest) return;
    button?.classList.remove('is-loading');
    button?.classList.add('is-playing');
  }

  async function speakReply(text, button = null) {
    if (!configured) return;
    stopSpeech();
    unlockAudio();
    const request = voiceRequest;
    activeSpeechButton = button;
    button?.classList.add('is-loading');
    try {
      if (audioContext) {
        try {
          if (audioContext.state !== 'running') await Promise.race([
            audioContext.resume().catch(() => {}),
            new Promise(resolve => setTimeout(resolve, 1800))
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
      await playSpeechPart(text, button, request, controller);
    } catch (error) {
      if (request !== voiceRequest) return;
      if (error.name === 'NotAllowedError') {
        button?.setAttribute('aria-label', 'Tocá para escuchar esta respuesta');
      } else {
        button?.setAttribute('aria-label', 'Voz no disponible por ahora');
      }
    } finally {
      button?.classList.remove('is-loading');
    }
  }
  voicePlayer.addEventListener('ended', () => {
    activeSpeechButton?.classList.remove('is-playing');
    activeSpeechButton = null;
  });
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
    const greeting = bubble(welcomeText, 'assistant');
    if (statusChecked && !configured) bubble('La conexión con la inteligencia artificial todavía no está configurada. El formulario de consulta sigue disponible en la página.', 'assistant');
    messagesEl.scrollTop = 0;
    return greeting;
  }

  async function checkStatus() {
    try {
      const response = await fetch('/api/assistant/status', { cache: 'no-store' });
      const status = await response.json();
      const wasConfigured = configured;
      configured = Boolean(status.configured);
      statusEl.textContent = configured ? 'Disponible para conversar' : 'Falta conectar la IA';
      panel.classList.toggle('is-offline', !configured);
      input.disabled = !configured;
      sendButton.disabled = !configured;
      micButton.disabled = !configured;
      if (!configured) hintEl.textContent = 'El asistente se activa al configurar la conexión privada.';
      const refreshGreeting = !statusChecked || (!wasConfigured && configured && !history.length);
      statusChecked = true;
      if (refreshGreeting && !history.length) {
        const greeting = welcome();
        if (configured && panel.classList.contains('is-open')) speakReply(welcomeText, greeting.querySelector('.assistant-speak'));
      }
    } catch {
      statusEl.textContent = 'Conexión no disponible';
      configured = false;
      statusChecked = true;
      input.disabled = true;
      sendButton.disabled = true;
      micButton.disabled = true;
      if (!history.length) welcome();
    }
  }

  function setBusy(value) {
    busy = value;
    workingEl.hidden = !value;
    sendButton.disabled = value || !configured;
    micButton.disabled = value || !configured;
    form.setAttribute('aria-busy', String(value));
  }

  function maybeShowBooking(userMessage) {
    if (/\b(turno|reserv(a|ar|arlo|arme|ación)|agend(a|ar|arme)|coordinar una (visita|revisión)|llevar(lo|la)? al taller)\b/i.test(userMessage)) {
      reservationPrompt.hidden = false;
    }
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
      const replyText = String(result.reply || '').trim();
      if (!replyText) throw new Error('No pude responder en este momento.');
      history.push({ role: 'assistant', content: replyText });
      const reply = bubble(replyText, 'assistant');
      speakReply(replyText, reply.querySelector('.assistant-speak'));
      maybeShowBooking(userMessage);
    } catch (error) {
      pending.remove();
      history.pop();
      bubble(error.name === 'AbortError' ? 'La respuesta demoró demasiado. Probá de nuevo o escribinos por el formulario.' : error.message || 'No pude responder ahora. Probá de nuevo o escribinos por el formulario.', 'assistant');
    } finally {
      clearTimeout(timeout);
      setBusy(false);
    }
  }

  function sendText(value) {
    const text = String(value || '').trim();
    if (!text || busy || !configured) return;
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
    clearTimeout(recognitionRestartTimer);
    recognitionRestartTimer = null;
    document.querySelector('#assistant-recording').hidden = true;
    micButton.classList.remove('is-recording');
    hintEl.hidden = false;
    input.placeholder = 'Contame qué notaste…';
    recordingState.textContent = 'Escuchando';
  }

  function failDictation(message) {
    dictationSession += 1;
    dictating = false;
    finishingDictation = false;
    speechRecognition = null;
    clearDictationUi();
    showDictatedText();
    hintEl.textContent = message;
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
    unlockAudio();
    finishingDictation = true;
    const session = dictationSession;
    clearInterval(recordingTimer);
    clearTimeout(maxRecordTimer);
    clearTimeout(recognitionRestartTimer);
    if (!speechRecognition) { completeDictation(session); return; }
    try { speechRecognition?.stop(); } catch { completeDictation(session); return; }
    finishTimer = setTimeout(() => completeDictation(session), 1800);
  }

  function beginRecognition(session) {
    if (session !== dictationSession || !dictating || finishingDictation) return;
    const recognizer = new Recognition();
    recognizer.lang = 'es-UY';
    // Short recognition sessions work more reliably on mobile; each end starts a fresh one.
    recognizer.continuous = false;
    recognizer.interimResults = true;
    recognizer.maxAlternatives = 1;
    let endFallbackTimer = null;
    let transientFailure = false;
    speechRecognition = recognizer;
    recognitionStartedAt = Date.now();
    recognizer.addEventListener('start', () => {
      if (session === dictationSession) recordingState.textContent = 'Escuchando';
    });
    recognizer.addEventListener('result', event => {
      if (session !== dictationSession || speechRecognition !== recognizer) return;
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
    const onEnd = () => {
      clearTimeout(endFallbackTimer);
      if (session !== dictationSession || speechRecognition !== recognizer) return;
      speechRecognition = null;
      const hadWords = Boolean(recognitionFinal || recognitionInterim);
      dictationSegments.push(...[recognitionFinal, recognitionInterim].filter(Boolean));
      recognitionFinal = '';
      recognitionInterim = '';
      if (finishingDictation) { completeDictation(session); return; }
      if (!dictating) return;
      rapidRecognitionStops = hadWords || (!transientFailure && Date.now() - recognitionStartedAt > 1200) ? 0 : rapidRecognitionStops + 1;
      if (rapidRecognitionStops >= 4) {
        failDictation('El navegador cortó el micrófono. Revisá su permiso o usá el dictado del teclado.');
        return;
      }
      recordingState.textContent = 'Reconectando…';
      recognitionRestartTimer = setTimeout(() => beginRecognition(session), 240 + rapidRecognitionStops * 180);
    };
    recognizer.addEventListener('error', event => {
      if (session !== dictationSession || speechRecognition !== recognizer) return;
      if (['no-speech', 'aborted', 'network'].includes(event.error)) {
        transientFailure = event.error === 'network';
        endFallbackTimer = setTimeout(onEnd, 800);
        return;
      }
      failDictation(['not-allowed', 'service-not-allowed'].includes(event.error)
        ? 'Permití el micrófono para dictar, o usá el del teclado.'
        : event.error === 'audio-capture'
          ? 'No encontré el micrófono. Revisá el permiso del navegador o usá el del teclado.'
          : 'Se cortó el dictado. El texto visible queda listo para enviar.');
    });
    recognizer.addEventListener('end', onEnd);
    try { recognizer.start(); }
    catch { failDictation('No pude iniciar el dictado. Revisá el permiso o usá el micrófono del teclado.'); }
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
    rapidRecognitionStops = 0;
    recordingDraft = input.value.trim();
    dictationSegments = [];
    recognitionFinal = '';
    recognitionInterim = '';
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
    beginRecognition(session);
  }

  function cancelDictation() {
    dictationSession += 1;
    dictating = false;
    finishingDictation = false;
    try { speechRecognition?.abort(); } catch {}
    speechRecognition = null;
    clearDictationUi();
  }

  function syncViewport() {
    if (panel.hidden) return;
    const viewport = window.visualViewport;
    const visibleHeight = viewport?.height || window.innerHeight;
    if (!visibleHeight) return;
    const coveredHeight = viewport ? Math.max(0, (window.innerHeight || visibleHeight) - viewport.height - viewport.offsetTop) : 0;
    panel.style.setProperty?.('--assistant-visible-height', `${visibleHeight}px`);
    panel.style.setProperty?.('--assistant-keyboard-offset', `${coveredHeight}px`);
  }

  function open() {
    clearTimeout(closeTimer);
    unlockAudio();
    panel.hidden = false;
    document.documentElement?.classList.add('assistant-chat-open');
    document.body?.classList.add('assistant-chat-open');
    syncViewport();
    requestAnimationFrame(() => panel.classList.add('is-open'));
    panel.setAttribute('aria-hidden', 'false');
    launcher.setAttribute('aria-expanded', 'true');
    checkStatus();
    window.setTimeout(() => {
      if (panel.hidden) return;
      const mobile = window.innerWidth && window.innerWidth <= 600;
      (configured && !mobile ? input : document.querySelector('#assistant-close')).focus({ preventScroll: true });
    }, 90);
  }

  function close() {
    stopSpeech();
    cancelDictation();
    document.documentElement?.classList.remove('assistant-chat-open');
    document.body?.classList.remove('assistant-chat-open');
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    launcher.setAttribute('aria-expanded', 'false');
    resetDialog.hidden = true;
    closeTimer = window.setTimeout(() => { panel.hidden = true; }, 220);
    launcher.focus({ preventScroll: true });
  }

  launcher.addEventListener('click', () => panel.classList.contains('is-open') ? close() : open());
  document.querySelector('#assistant-close').addEventListener('click', close);
  document.querySelector('#assistant-new').addEventListener('click', () => { resetDialog.hidden = false; });
  document.querySelector('#assistant-reset-no').addEventListener('click', () => { resetDialog.hidden = true; });
  document.querySelector('#assistant-reset-yes').addEventListener('click', () => { resetDialog.hidden = true; stopSpeech(); cancelDictation(); const greeting = welcome(); if (configured) speakReply(welcomeText, greeting.querySelector('.assistant-speak')); input.focus(); });
  document.querySelector('#assistant-stop-recording').addEventListener('click', finishDictation);
  document.querySelector('#assistant-mic').addEventListener('click', () => dictating ? finishDictation() : startDictation());
  document.querySelector('#assistant-privacy-link').addEventListener('click', event => { event.preventDefault(); close(); document.querySelector('#turno').scrollIntoView({ behavior: 'smooth' }); });
  document.querySelector('#assistant-booking-close').addEventListener('click', () => { booking.hidden = true; messagesEl.scrollTop = messagesEl.scrollHeight; });
  form.addEventListener('submit', event => { event.preventDefault(); if (dictating) finishDictation(); else sendText(input.value); });
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 112)}px`; });
  input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); } });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) close(); });
  window.visualViewport?.addEventListener('resize', syncViewport);
  window.visualViewport?.addEventListener('scroll', syncViewport);
  window.addEventListener?.('resize', syncViewport);

  document.querySelector('#assistant-reserve-start').addEventListener('click', () => {
    reservationPrompt.hidden = true;
    booking.hidden = false;
    booking.scrollTop = 0;
    bookingForm.querySelector('[name="name"]').focus({ preventScroll: true });
  });
  document.querySelector('#assistant-reserve-later').addEventListener('click', () => {
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
