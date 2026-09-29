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
  const welcomeText = 'Hola, soy tu asistente MOTORLOZ. Estoy acá para escucharte. Mandame un audio corto con la marca, el modelo y el kilometraje del auto, y contame qué notaste. Así entiendo mejor la historia y te oriento con el próximo paso.';
  let history = [];
  let configured = false;
  let busy = false;
  let mediaRecorder = null;
  let audioChunks = [];
  let speechRecognition = null;
  let recognitionActive = false;
  let recognitionFinal = '';
  let recognitionInterim = '';
  let recordingDraft = '';
  let recordingStart = 0;
  let recordingTimer = null;
  let maxRecordTimer = null;
  let reservationDismissedAt = 0;
  let voiceEnabled = true;
  let voiceNeedsGesture = false;
  let voiceRequest = 0;
  let voiceUrl = '';
  let audioContext = null;
  let speechAbort = null;
  let audioSources = new Set();
  let nextAudioTime = 0;
  let streamFinished = false;
  try { voiceEnabled = localStorage.getItem('motorloz-voice') !== 'off'; } catch {}
  if (window.SpeechRecognition || window.webkitSpeechRecognition) {
    micButton.setAttribute('aria-label', 'Dictar consulta de hasta 60 segundos');
    micButton.title = 'Dictar consulta';
    hintEl.textContent = 'Podés escribir o dictar · máximo 60 segundos';
  }

  const esc = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
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

  async function streamReply(text, button, request) {
    if (!audioContext || audioContext.state !== 'running') throw new Error('audio_context_unavailable');
    const controller = new AbortController();
    speechAbort = controller;
    const response = await fetch('/api/assistant/speech-stream', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }), signal: controller.signal
    });
    if (!response.ok || !response.body) throw new Error('speech_stream_unavailable');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = '';
    let oddByte = null;
    let receivedAudio = false;
    const handleEvent = block => {
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
      const samples = Math.floor(bytes.length / 2);
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
      const start = Math.max(nextAudioTime, audioContext.currentTime + 0.04);
      source.start(start);
      nextAudioTime = start + buffer.duration;
      audioSources.add(source);
      source.onended = () => {
        audioSources.delete(source);
        if (streamFinished && !audioSources.size) button?.classList.remove('is-playing');
      };
      receivedAudio = true;
      button?.classList.remove('is-loading');
      button?.classList.add('is-playing');
    };
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (request !== voiceRequest) return;
        pending += decoder.decode(value, { stream: true });
        const blocks = pending.split(/\r?\n\r?\n/);
        pending = blocks.pop() || '';
        blocks.forEach(handleEvent);
      }
      if (pending.trim()) handleEvent(pending);
      if (!receivedAudio) throw new Error('speech_stream_empty');
      streamFinished = true;
      if (!audioSources.size) button?.classList.remove('is-playing');
    } finally {
      if (speechAbort === controller) speechAbort = null;
    }
  }

  async function speakReply(text, button = null, automatic = false) {
    if (!configured || (automatic && !voiceEnabled)) return;
    stopSpeech();
    unlockAudio();
    const request = voiceRequest;
    button?.classList.add('is-loading');
    try {
      let audio = speechCache.get(text);
      if (!audio && audioContext?.state === 'running') {
        try {
          await streamReply(text, button, request);
          return;
        } catch (error) {
          if (request !== voiceRequest) return;
          if (audioSources.size) { streamFinished = true; return; }
        }
      }
      if (!audio) {
        const response = await fetch('/api/assistant/speech', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        if (!response.ok) throw new Error('speech_unavailable');
        audio = await response.blob();
        if (audio.type !== 'audio/wav' || audio.size < 44) throw new Error('speech_invalid');
        speechCache.set(text, audio);
        if (speechCache.size > 10) speechCache.delete(speechCache.keys().next().value);
      }
      if (request !== voiceRequest || panel.hidden) return;
      voiceUrl = URL.createObjectURL(audio);
      voicePlayer.src = voiceUrl;
      voicePlayer.currentTime = 0;
      await voicePlayer.play();
      voiceNeedsGesture = false;
      updateVoiceToggle();
      button?.classList.add('is-playing');
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
  voicePlayer.addEventListener('ended', () => panel.querySelectorAll('.assistant-speak.is-playing').forEach(button => button.classList.remove('is-playing')));
  updateVoiceToggle();

  function bubble(text, role, extra = {}) {
    const row = document.createElement('div');
    row.className = `assistant-message assistant-message-${role}`;
    if (extra.audio) {
      row.innerHTML = `<span class="assistant-audio-pill"><span class="assistant-audio-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><span>Nota de voz · ${esc(extra.duration || 'audio')}</span></span>`;
    } else {
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

  async function requestReply(userMessage, endpoint = '/api/assistant/chat', audioPayload = null) {
    if (!configured || busy) return;
    history.push({ role: 'user', content: userMessage });
    const pending = bubble('Dame un momento, ya te leo…', 'assistant', { pending: true });
    setBusy(true);
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(audioPayload ? { messages: history.slice(0, -1), audio: audioPayload } : { messages: history })
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
      bubble(error.message || 'No pude responder ahora. Probá de nuevo o escribinos por el formulario.', 'assistant');
    } finally {
      setBusy(false);
      input.focus({ preventScroll: true });
    }
  }

  function sendText(value) {
    const text = String(value || '').trim();
    if (!text || busy) return;
    bubble(text, 'user');
    input.value = '';
    input.style.height = 'auto';
    requestReply(text);
  }

  function encodeWav(audioBuffer) {
    const targetRate = 24000;
    const ratio = audioBuffer.sampleRate / targetRate;
    const count = Math.max(1, Math.floor(audioBuffer.length / ratio));
    const pcm = new Int16Array(count);
    const channels = Array.from({ length: audioBuffer.numberOfChannels }, (_, index) => audioBuffer.getChannelData(index));
    for (let i = 0; i < count; i += 1) {
      const from = Math.floor(i * ratio);
      const to = Math.min(audioBuffer.length, Math.floor((i + 1) * ratio));
      let sample = 0;
      let samples = 0;
      for (let source = from; source < to; source += 1) {
        for (const channel of channels) sample += channel[source] || 0;
        samples += channels.length;
      }
      sample = samples ? sample / samples : 0;
      pcm[i] = Math.max(-1, Math.min(1, sample)) * (sample < 0 ? 32768 : 32767);
    }
    const wav = new ArrayBuffer(44 + pcm.length * 2);
    const view = new DataView(wav);
    const write = (offset, value) => { for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i)); };
    write(0, 'RIFF'); view.setUint32(4, 36 + pcm.length * 2, true); write(8, 'WAVE'); write(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, targetRate, true); view.setUint32(28, targetRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, pcm.length * 2, true);
    new Uint8Array(wav, 44).set(new Uint8Array(pcm.buffer));
    return new Blob([wav], { type: 'audio/wav' });
  }

  async function finishRecording() {
    clearInterval(recordingTimer);
    clearTimeout(maxRecordTimer);
    const recorder = mediaRecorder;
    mediaRecorder = null;
    document.querySelector('#assistant-recording').hidden = true;
    micButton.classList.remove('is-recording');
    if (!recorder) return;
    if (speechRecognition) {
      const recognizer = speechRecognition;
      if (recognitionActive) {
        await new Promise(resolve => {
          const timeout = setTimeout(resolve, 650);
          recognizer.addEventListener('end', () => { clearTimeout(timeout); resolve(); }, { once: true });
          try { recognizer.stop(); } catch { clearTimeout(timeout); resolve(); }
        });
      } else try { recognizer.abort(); } catch {}
      speechRecognition = null;
      recognitionActive = false;
    }
    await new Promise(resolve => {
      recorder.addEventListener('stop', resolve, { once: true });
      if (recorder.state !== 'inactive') recorder.stop(); else resolve();
    });
    recorder.stream.getTracks().forEach(track => track.stop());
    hintEl.hidden = false;
    input.placeholder = 'Contame qué notaste…';
    const transcript = [recognitionFinal, recognitionInterim].filter(Boolean).join(' ').trim().slice(0, 1200);
    recognitionFinal = '';
    recognitionInterim = '';
    if (transcript) {
      audioChunks = [];
      sendText([recordingDraft, transcript].filter(Boolean).join(' '));
      recordingDraft = '';
      return;
    }
    input.value = recordingDraft;
    recordingDraft = '';
    if (!audioChunks.length) return;
    setBusy(true);
    const duration = Math.max(1, Math.round((Date.now() - recordingStart) / 1000));
    bubble('', 'user', { audio: true, duration: `00:${String(duration).padStart(2, '0')}` });
    bubble('Estoy escuchando tu nota de voz…', 'assistant', { pending: true });
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const raw = await new Blob(audioChunks).arrayBuffer();
      const decoded = await audioContext.decodeAudioData(raw);
      const wav = encodeWav(decoded);
      await audioContext.close();
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(wav);
      });
      const pending = messagesEl.querySelector('.assistant-message.is-pending:last-child');
      const voiceMarker = `[La persona mandó una nota de voz de ${duration} segundos. Respondé usando el contenido que escuchaste.]`;
      history.push({ role: 'user', content: voiceMarker });
      const historyForVoice = history.slice(0, -1);
      const response = await fetch('/api/assistant/voice', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: historyForVoice, audio: base64 })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'No pude escuchar ese audio. Probá grabarlo otra vez.');
      pending?.remove();
      history.push({ role: 'assistant', content: result.reply });
      const reply = bubble(result.reply, 'assistant');
      speakReply(result.reply, reply.querySelector('.assistant-speak'), true);
      maybeShowBooking();
    } catch (error) {
      messagesEl.querySelector('.assistant-message.is-pending:last-child')?.remove();
      if (history.at(-1)?.role === 'user' && history.at(-1).content.startsWith('[La persona mandó una nota')) history.pop();
      bubble(error.message || 'No pude procesar la nota de voz. Probá de nuevo o escribí tu consulta.', 'assistant');
    } finally {
      audioChunks = [];
      setBusy(false);
      input.focus({ preventScroll: true });
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      bubble('Este navegador no permite grabar audio. Podés escribir tu consulta en el chat.', 'assistant');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const candidates = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'];
      const mimeType = candidates.find(type => MediaRecorder.isTypeSupported(type));
      mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunks = [];
      mediaRecorder.addEventListener('dataavailable', event => { if (event.data.size) audioChunks.push(event.data); });
      mediaRecorder.start();
      recordingDraft = input.value.trim();
      recognitionFinal = '';
      recognitionInterim = '';
      const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (Recognition) {
        try {
          const recognizer = new Recognition();
          recognizer.lang = 'es-UY';
          recognizer.continuous = true;
          recognizer.interimResults = true;
          recognizer.maxAlternatives = 1;
          recognizer.addEventListener('start', () => { recognitionActive = true; });
          recognizer.addEventListener('end', () => { recognitionActive = false; });
          recognizer.addEventListener('result', event => {
            const final = [];
            const interim = [];
            for (const result of Array.from(event.results)) {
              const phrase = result[0]?.transcript?.trim();
              if (phrase) (result.isFinal ? final : interim).push(phrase);
            }
            recognitionFinal = final.join(' ');
            recognitionInterim = interim.join(' ');
            input.value = [recordingDraft, recognitionFinal, recognitionInterim].filter(Boolean).join(' ').slice(0, 1200);
            input.style.height = 'auto';
            input.style.height = `${Math.min(input.scrollHeight, 112)}px`;
          });
          recognizer.start();
          speechRecognition = recognizer;
          input.placeholder = 'Transcribiendo mientras hablás…';
        } catch { speechRecognition = null; }
      }
      recordingStart = Date.now();
      micButton.classList.add('is-recording');
      document.querySelector('#assistant-recording').hidden = false;
      hintEl.hidden = true;
      recordingTimer = setInterval(() => {
        const seconds = Math.min(60, Math.floor((Date.now() - recordingStart) / 1000));
        document.querySelector('#assistant-recording-time').textContent = `00:${String(seconds).padStart(2, '0')}`;
      }, 250);
      maxRecordTimer = setTimeout(finishRecording, 60_000);
    } catch {
      bubble('No pude acceder al micrófono. Revisá el permiso del navegador o escribí tu consulta.', 'assistant');
    }
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
    try { speechRecognition?.abort(); } catch {}
    speechRecognition = null;
    recognitionActive = false;
    if (mediaRecorder) {
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
      mediaRecorder = null;
    }
    clearInterval(recordingTimer);
    clearTimeout(maxRecordTimer);
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    launcher.setAttribute('aria-expanded', 'false');
    resetDialog.hidden = true;
    window.setTimeout(() => { panel.hidden = true; welcome(); }, 220);
    launcher.focus({ preventScroll: true });
  }

  launcher.addEventListener('click', () => panel.hidden ? open() : close());
  voiceToggle.addEventListener('click', async () => {
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
  document.querySelector('#assistant-reset-yes').addEventListener('click', () => { resetDialog.hidden = true; stopSpeech(); const greeting = welcome(); if (configured && voiceEnabled) speakReply(welcomeText, greeting.querySelector('.assistant-speak'), true); input.focus(); });
  document.querySelector('#assistant-stop-recording').addEventListener('click', finishRecording);
  document.querySelector('#assistant-mic').addEventListener('click', () => mediaRecorder ? finishRecording() : startRecording());
  document.querySelector('#assistant-privacy-link').addEventListener('click', event => { event.preventDefault(); close(); document.querySelector('#turno').scrollIntoView({ behavior: 'smooth' }); });
  document.querySelector('#assistant-booking-close').addEventListener('click', () => { booking.hidden = true; messagesEl.scrollTop = messagesEl.scrollHeight; });
  form.addEventListener('submit', event => { event.preventDefault(); sendText(input.value); });
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
