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
  const reservationPrompt = document.querySelector('#assistant-reservation-prompt');
  const reserveButton = document.querySelector('#assistant-reserve-start');
  const retryLink = document.querySelector('#assistant-wa-retry');
  const resetDialog = document.querySelector('#assistant-reset-confirm');
  const recordingState = document.querySelector('#assistant-recording-state');
  const muteButton = document.querySelector('#assistant-mute');
  const voicePlayer = new Audio();
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const speechCache = new Map();
  const welcomeText = 'Hola, soy tu asistente MOTORLOZ. Contame qué notaste en tu auto o qué mantenimiento o servicio buscás. Si sabés la marca, el modelo y el kilometraje, decímelos también. Podés escribir o tocar el micrófono; al terminar, tocá Terminar y enviar.';
  const conversationKey = 'motorloz-assistant-conversation-v1';
  let history = [];
  let bookingDismissed = false;
  let handoffHistoryKey = '';
  let handoffSummaryPromise = null;
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
  let speechRetryTimer = null;
  let activeSpeechButton = null;
  let muted = false;
  let lastSpokenText = '';
  let welcomeSpoken = false;
  let welcomePlayed = false;
  let openSession = 0;
  let audioContext = null;
  let audioSources = new Set();
  let nextAudioTime = 0;
  let streamFinished = false;
  let pageScrollY = 0;
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  micButton.title = Recognition ? 'Dictar y enviar como texto' : 'Dictado no disponible en este navegador';
  hintEl.textContent = Recognition ? 'Tocá el micrófono para dictar · se enviará solo texto' : 'Escribí o usá el dictado del teclado';

  function stopSpeech() {
    voiceRequest += 1;
    clearTimeout(speechRetryTimer);
    speechRetryTimer = null;
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
    muteButton.classList.remove('is-speaking', 'is-loading');
  }

  function updateMuteButton() {
    muteButton.classList.toggle('is-muted', muted);
    muteButton.setAttribute('aria-pressed', String(muted));
    muteButton.setAttribute('aria-label', muted ? 'Activar voz' : 'Silenciar voz');
    muteButton.title = muted ? 'Activar voz' : 'Silenciar voz';
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
    const firstAudioTimeout = setTimeout(() => { if (!received) controller.abort(); }, 5000);
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
      if (text === welcomeText) welcomePlayed = true;
      nextAudioTime = start + buffer.duration;
      audioSources.add(source);
      source.onended = () => {
        audioSources.delete(source);
        if (streamFinished && !audioSources.size && request === voiceRequest) {
          muteButton.classList.remove('is-speaking');
          activeSpeechButton = null;
        }
      };
      received = true;
      clearTimeout(firstAudioTimeout);
      statusEl.textContent = 'Disponible para conversar';
      muteButton.classList.remove('is-loading');
      muteButton.classList.add('is-speaking');
    };
    try {
      const response = await fetch('/api/assistant/speech-stream', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({text}), signal:controller.signal
      });
      if (!response.ok || !response.body) {
        const error = new Error('speech_stream_unavailable');
        error.status = response.status;
        throw error;
      }
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
      if (!audioSources.size) { muteButton.classList.remove('is-speaking'); activeSpeechButton = null; }
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
    if (!response.ok) {
      const error = new Error('speech_unavailable');
      error.status = response.status;
      throw error;
    }
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
    if (text === welcomeText) welcomePlayed = true;
    if (request !== voiceRequest) return;
    statusEl.textContent = 'Disponible para conversar';
    muteButton.classList.remove('is-loading');
    muteButton.classList.add('is-speaking');
  }

  async function speakReply(text, button = null, retryCount = 0) {
    if (!configured || muted || !text) return;
    stopSpeech();
    unlockAudio();
    const request = voiceRequest;
    activeSpeechButton = muteButton;
    lastSpokenText = text;
    muteButton.classList.add('is-loading');
    let retryScheduled = false;
    try {
      if (audioContext) {
        try {
          if (audioContext.state !== 'running') await Promise.race([
            audioContext.resume().catch(() => {}),
            new Promise(resolve => setTimeout(resolve, 1800))
          ]);
          await streamSpeech(text, muteButton, request);
          return;
        } catch (error) {
          if (request !== voiceRequest) return;
          if (audioSources.size) { streamFinished = true; return; }
          if (error.status === 429) throw error;
        }
      }
      const controller = new AbortController();
      speechAbort = controller;
      await playSpeechPart(text, muteButton, request, controller);
    } catch (error) {
      if (request !== voiceRequest) return;
      activeSpeechButton = null;
      muteButton.classList.remove('is-speaking');
      if (error.status === 429 && retryCount < 2 && !muted && !panel.hidden) {
        statusEl.textContent = 'Voz ocupada · reintentando';
        retryScheduled = true;
        speechRetryTimer = setTimeout(() => {
          speechRetryTimer = null;
          if (request === voiceRequest && !muted && !panel.hidden) speakReply(text, button, retryCount + 1);
        }, [7000, 18000][retryCount]);
      } else if (error.status === 429) {
        statusEl.textContent = 'Chat disponible · voz sin cupo por ahora';
      }
      if (text === welcomeText && !retryScheduled) welcomeSpoken = welcomePlayed;
    } finally {
      if (request === voiceRequest && !retryScheduled) muteButton.classList.remove('is-loading');
    }
  }
  voicePlayer.addEventListener('ended', () => {
    muteButton.classList.remove('is-speaking');
    activeSpeechButton = null;
  });
  function bubble(text, role, extra = {}) {
    const row = document.createElement('div');
    row.className = `assistant-message assistant-message-${role}`;
    if (extra.welcome) {
      row.classList.add('assistant-message-welcome');
      const kicker = document.createElement('span');
      kicker.className = 'assistant-welcome-kicker';
      kicker.textContent = 'RECEPCIÓN DIGITAL  /  MOTORLOZ';
      const heading = document.createElement('p');
      heading.className = 'assistant-welcome-heading';
      heading.append(document.createTextNode('Hola, soy tu asistente '));
      const brand = document.createElement('strong');
      brand.textContent = 'MOTORLOZ.';
      heading.append(brand);
      const description = document.createElement('p');
      description.className = 'assistant-welcome-description';
      description.textContent = 'Contame qué notaste en tu auto o qué mantenimiento o servicio buscás. Si sabés la marca, el modelo y el kilometraje, decímelos también.';
      const voiceTip = document.createElement('div');
      voiceTip.className = 'assistant-welcome-voice';
      voiceTip.textContent = '⌁  Podés escribir o tocar el micrófono. Al terminar, tocá “Terminar y enviar”.';
      row.append(kicker, heading, description, voiceTip);
      messagesEl.append(row);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return row;
    }
    const copy = document.createElement('p');
    copy.textContent = text;
    row.append(copy);
    if (extra.pending) row.classList.add('is-pending');
    messagesEl.append(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return row;
  }

  function welcome() {
    messagesEl.replaceChildren();
    reservationPrompt.hidden = true;
    retryLink.hidden = true;
    history = [];
    bookingDismissed = false;
    handoffHistoryKey = '';
    handoffSummaryPromise = null;
    lastSpokenText = welcomeText;
    const greeting = bubble(welcomeText, 'assistant', { welcome:true });
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
        welcome();
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

  function saveConversation() {
    try { window.sessionStorage?.setItem(conversationKey, JSON.stringify(history.slice(-20))); } catch {}
  }

  function restoreConversation() {
    try {
      const stored = JSON.parse(window.sessionStorage?.getItem(conversationKey) || '[]');
      if (!Array.isArray(stored)) return;
      const restored = stored.slice(-20).filter(item => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string' && item.content.trim()).map(item => ({ role:item.role, content:item.content.slice(0, 1200) }));
      if (!restored.length) return;
      history = restored;
      for (const item of restored) bubble(item.content, item.role);
      lastSpokenText = restored.filter(item => item.role === 'assistant').at(-1)?.content || welcomeText;
      maybeShowBooking();
    } catch {}
  }

  function maybeShowBooking() {
    if (bookingDismissed) {
      if (!/\b(?:turno|reservar|agendar|coordinar)\b/i.test(history.at(-2)?.content || '')) return;
      bookingDismissed = false;
    }
    const customerTurns = history.filter(item => item.role === 'user');
    const issueTurns = customerTurns.filter(item => {
      const words = item.content.trim();
      return words.length >= 22 && !/^(?:hola|buen(?:os|as)|me llamo|mi nombre es)\b/i.test(words) && !/^(?:(?:quiero|necesito) (?:(?:un )?turno|(?:reservar|agendar|coordinar)(?: (?:un )?turno)?)|reservame|agendame)[.!?\s]*$/i.test(words);
    });
    const customerText = customerTurns.map(item => item.content).join(' ');
    const hasVehicle = /\b(?:Subaru|Toyota|Honda|Hyundai|Volkswagen|VW|BMW|Mercedes|Nissan|Mazda|Suzuki|Mitsubishi|Kia|Chevrolet|Peugeot|Audi|Renault|Ford|Jeep|Fiat|Volvo|Citro[eë]n|Dodge|Ferrari|Porsche|Alfa Romeo|auto|coche|camioneta|veh[ií]culo)\b/i.test(customerText);
    const discussedProblem = issueTurns.some(item => /\b(?:ruido|vibra|luz|humo|frena|freno|arranca|motor|caja|pierde|calienta|golpe|pozo|mantenimiento|service|aceite|pastillas|alineaci[oó]n|filtros|cambio|revisi[oó]n)\b/i.test(item.content));
    if (hasVehicle && discussedProblem && customerTurns.length >= 2 && customerName()) {
      reservationPrompt.hidden = false;
      if (!handoffSummaryPromise) {
        handoffHistoryKey = customerText;
        handoffSummaryPromise = handoffSummary(handoffDetails().issue);
      }
    }
  }

  function customerName() {
    for (let index = history.length - 1; index >= 0; index -= 1) {
      const item = history[index];
      if (item.role !== 'user') continue;
      const explicit = item.content.match(/\b(?:me llamo|mi nombre es|soy)\s+([\p{L}]+(?:\s+[\p{L}]+){0,2})/iu);
      if (explicit) {
        const name = explicit[1].split(/\s+(?:y|tengo|soy|con|de)\b/i)[0].trim();
        if (!/^(?:de|del|un|una|el|la)$/i.test(name)) return name;
      }
      const previous = history[index - 1];
      const answer = item.content.trim().replace(/[.!?]+$/, '');
      if (previous?.role === 'assistant' && /(?:c[oó]mo te llam[aá]s|tu nombre)/i.test(previous.content) && /^[\p{L}]+(?:\s+[\p{L}]+){0,2}$/u.test(answer)) return answer;
    }
    return '';
  }

  function simpleServiceSummary(customerText) {
    if (/\b(?:ruido|vibra|luz|humo|falla|anda mal|golpe|pozo|pierde|calienta|no arranca)\b/i.test(customerText)) return '';
    const services = [];
    if (/\b(?:cambio de aceite|cambiar (?:el )?aceite|service de aceite)\b/i.test(customerText)) services.push('cambio de aceite');
    if (/\b(?:pastillas? de freno|cambio de pastillas)\b/i.test(customerText)) services.push('revisión o cambio de pastillas de freno');
    if (/\balineaci[oó]n\b/i.test(customerText)) services.push('alineación');
    if (/\bbalanceo\b/i.test(customerText)) services.push('balanceo');
    return services.length ? `Solicita ${services.join(' y ')}.` : '';
  }

  function handoffDetails() {
    const customerTurns = history.filter(item => item.role === 'user').map(item => item.content.trim());
    const words = customerTurns.join(' ');
    const vehicle = words.match(/\b(Subaru|Toyota|Honda|Hyundai|Volkswagen|VW|BMW|Mercedes(?:-Benz)?|Nissan|Mazda|Suzuki|Mitsubishi|Kia|Chevrolet|Peugeot|Audi|Renault|Ford|Jeep|Fiat|Volvo|Citro[eë]n|Dodge|Ferrari|Porsche|Alfa Romeo)\b(?:\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9-]+))?/i);
    const model = vehicle?.[2] && !/^(?:de|del|con|a|al|en|me|anda|tiene|unos?|aprox|kil[oó]metros)$/i.test(vehicle[2]) ? ` ${vehicle[2]}` : '';
    const year = words.match(/\b(19[89]\d|20[0-3]\d)\b/)?.[1] || '';
    const thousands = words.match(/\b(\d{1,3})\s*mil\s*(?:km|kil[oó]metros)?\b/i);
    const mileage = words.match(/\b(\d{2,3}(?:[.,]\d{3})?)\s*(?:km|kil[oó]metros)\b/i);
    const issueFallback = customerTurns
      .filter(text => !/^(?:hola|buen(?:as|os)\s+(?:d[ií]as|tardes|noches))[!.,\s]*$/i.test(text))
      .filter(text => !/^(?:me llamo|mi nombre es|soy)\s+[\p{L}\s.]+$/iu.test(text))
      .filter(text => !/^(?:(?:quiero|necesito)\s+(?:(?:un\s+)?turno|reservar|agendar|coordinar)|reservame|agendame)[.!?\s]*$/i.test(text))
      .map(text => text.replace(/\b(?:me llamo|mi nombre es|soy)\s+[\p{L}]+(?:\s+[\p{L}]+)?/iu, '').trim())
      .filter(Boolean).slice(-8).join(' ').slice(0, 800);
    return {
      name: customerName(),
      vehicle: vehicle ? `${vehicle[1]}${model}` : '',
      year,
      mileage: thousands ? `${thousands[1]}.000 km aprox.` : mileage ? `${mileage[1]} km` : '',
      issue: simpleServiceSummary(words) || issueFallback
    };
  }

  async function handoffSummary(fallback) {
    if (simpleServiceSummary(history.filter(item => item.role === 'user').map(item => item.content).join(' '))) return fallback;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch('/api/assistant/summary', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ messages:history }), signal:controller.signal
      });
      if (!response.ok) return fallback;
      const result = await response.json();
      return String(result.summary || '').trim().slice(0, 550) || fallback;
    } catch { return fallback; }
    finally { clearTimeout(timeout); }
  }

  function handoffUrl(details) {
    const sections = [
      '*CONSULTA MOTORLOZ*\nPreparada desde el asistente',
      `*01 · CLIENTE*\n- Nombre: ${details.name}`,
      ['*02 · VEHÍCULO*', `- Marca y modelo: ${details.vehicle}`, details.year ? `- Año: ${details.year}` : '', details.mileage ? `- Kilometraje: ${details.mileage}` : ''].filter(Boolean).join('\n'),
      `*03 · QUÉ NECESITA*\n${details.issue}`,
      '*04 · COORDINACIÓN*\n- Día y horario: a confirmar por el taller',
      '¿Podemos coordinar una revisión? Quedo atento/a a la confirmación.'
    ];
    return `https://wa.me/${window.MOTORLOZ?.whatsapp || '59891888288'}?text=${encodeURIComponent(sections.join('\n\n'))}`;
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
      saveConversation();
      bubble(replyText, 'assistant');
      lastSpokenText = replyText;
      speakReply(replyText);
      maybeShowBooking();
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
    micButton.setAttribute('aria-pressed', 'false');
    micButton.setAttribute('aria-label', 'Empezar dictado');
    micButton.title = 'Empezar dictado';
    hintEl.hidden = false;
    input.placeholder = 'Escribí tu consulta…';
    recordingState.textContent = 'Grabando';
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
      if (session === dictationSession) recordingState.textContent = 'Grabando';
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
    micButton.setAttribute('aria-pressed', 'true');
    micButton.setAttribute('aria-label', 'Terminar dictado y enviar texto');
    micButton.title = 'Terminar dictado y enviar texto';
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
    panel.style.setProperty?.('--assistant-visible-width', `${viewport?.width || window.innerWidth}px`);
    panel.style.setProperty?.('--assistant-viewport-top', `${viewport?.offsetTop || 0}px`);
    panel.style.setProperty?.('--assistant-viewport-left', `${viewport?.offsetLeft || 0}px`);
  }

  function open() {
    clearTimeout(closeTimer);
    const session = ++openSession;
    unlockAudio();
    panel.hidden = false;
    pageScrollY = window.scrollY || 0;
    document.body?.style?.setProperty?.('--assistant-page-lock-top', `${-pageScrollY}px`);
    document.documentElement?.classList.add('assistant-chat-open');
    document.body?.classList.add('assistant-chat-open');
    syncViewport();
    requestAnimationFrame(() => panel.classList.add('is-open'));
    panel.setAttribute('aria-hidden', 'false');
    launcher.setAttribute('aria-expanded', 'true');
    checkStatus().then(() => {
      if (session !== openSession || panel.hidden || !configured || muted || history.length || welcomeSpoken) return;
      welcomeSpoken = true;
      speakReply(welcomeText);
    });
    window.setTimeout(() => {
      if (panel.hidden) return;
      const mobile = window.innerWidth && window.innerWidth <= 600;
      (configured && !mobile ? input : document.querySelector('#assistant-close')).focus({ preventScroll: true });
    }, 90);
  }

  function close() {
    openSession += 1;
    if (!welcomePlayed && !history.length) welcomeSpoken = false;
    stopSpeech();
    cancelDictation();
    document.documentElement?.classList.remove('assistant-chat-open');
    document.body?.classList.remove('assistant-chat-open');
    window.scrollTo?.(0, pageScrollY);
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
  document.querySelector('#assistant-reset-yes').addEventListener('click', () => { resetDialog.hidden = true; stopSpeech(); cancelDictation(); welcome(); welcomePlayed = false; welcomeSpoken = configured && !muted; if (welcomeSpoken) speakReply(welcomeText); try { window.sessionStorage?.removeItem(conversationKey); } catch {} input.focus({preventScroll:true}); });
  muteButton.addEventListener('click', () => {
    muted = !muted;
    updateMuteButton();
    if (muted) stopSpeech();
    else if (lastSpokenText) speakReply(lastSpokenText);
    unlockAudio();
  });
  document.querySelector('#assistant-stop-recording').addEventListener('click', finishDictation);
  document.querySelector('#assistant-mic').addEventListener('click', () => dictating ? finishDictation() : startDictation());
  document.querySelector('#assistant-privacy-link').addEventListener('click', event => { event.preventDefault(); close(); document.querySelector('#turno').scrollIntoView({ behavior: 'smooth' }); });
  form.addEventListener('submit', event => { event.preventDefault(); if (dictating) finishDictation(); else sendText(input.value); });
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 112)}px`; });
  input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); } });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) close(); });
  window.visualViewport?.addEventListener('resize', syncViewport);
  window.visualViewport?.addEventListener('scroll', syncViewport);
  window.addEventListener?.('resize', syncViewport);

  reserveButton.addEventListener('click', async () => {
    if (reserveButton.disabled) return;
    const details = handoffDetails();
    if (!details.name || !details.vehicle || !details.issue) return;
    reserveButton.disabled = true;
    reserveButton.textContent = 'Preparando mensaje…';
    retryLink.hidden = true;
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    try {
      const customerText = history.filter(item => item.role === 'user').map(item => item.content).join(' ');
      details.issue = await (handoffHistoryKey === customerText && handoffSummaryPromise ? handoffSummaryPromise : handoffSummary(details.issue));
      const url = handoffUrl(details);
      retryLink.href = url;
      retryLink.hidden = false;
      if (popup) popup.location.href = url;
    } finally {
      reserveButton.disabled = false;
      reserveButton.textContent = 'Abrir WhatsApp';
    }
  });
  document.querySelector('#assistant-reserve-later').addEventListener('click', () => {
    bookingDismissed = true;
    reservationPrompt.hidden = true;
  });

  welcome();
  restoreConversation();
  if (new URLSearchParams(location.search).get('asistente') === '1') open();
})();
