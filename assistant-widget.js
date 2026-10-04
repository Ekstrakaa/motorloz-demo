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
  const welcomeText = 'Hola, soy tu asistente de MOTORLOZ. Contame qué notaste en el auto o qué servicio necesitás, y lo vemos juntos.';
  const conversationKey = 'motorloz-assistant-conversation-v1';
  let history = [];
  let conversationFacts = null;
  let confirmedHandoff = null;
  let chatAbort = null;
  let conversationVersion = 0;
  let bookingDismissed = false;
  let handoffHistoryKey = '';
  let handoffSummaryPromise = null;
  let summaryCard = null;
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
  let phraseBiasDisabled = false;
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
  let streamFinished = false;
  let pcmPlayer = null;
  let pageScrollY = 0;
  let followConversation = true;
  let scrollScheduled = false;

  // Follow after layout settles, including keyboard and async summary changes.
  function followLatest(force = false) {
    if (force) followConversation = true;
    if (!followConversation || scrollScheduled) return;
    scrollScheduled = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (followConversation) messagesEl.scrollTop = messagesEl.scrollHeight;
      scrollScheduled = false;
    }));
  }
  messagesEl.addEventListener('scroll', () => {
    if (!scrollScheduled) followConversation = messagesEl.scrollHeight - messagesEl.scrollTop - (messagesEl.clientHeight || 0) < 96;
  });
  if (window.ResizeObserver) {
    const observer = new window.ResizeObserver(() => followLatest());
    observer.observe(messagesEl);
    observer.observe(form);
  }
  function appendConversation(node) {
    messagesEl.append(node);
    // Keep the action beside the latest messages, in the same scroll area.
    messagesEl.append(reservationPrompt);
  }
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const dictationTerms = window.MOTORLOZ_DICTATION || { normalize: text => text, choose: result => result?.[0]?.transcript?.trim() || '' };
  micButton.title = Recognition ? 'Dictar y enviar como texto' : 'Dictado no disponible en este navegador';
  hintEl.textContent = Recognition ? 'Tocá el micrófono para dictar · se enviará solo texto' : 'Escribí o usá el dictado del teclado';

  function stopSpeech() {
    voiceRequest += 1;
    clearTimeout(speechRetryTimer);
    speechRetryTimer = null;
    speechAbort?.abort();
    speechAbort = null;
    activeSpeechButton = null;
    pcmPlayer?.stop();
    pcmPlayer = null;
    for (const source of audioSources) { try { source.stop(); } catch {} }
    audioSources.clear();
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

  async function speechError(response) {
    const detail = typeof response.json === 'function' ? await response.json().catch(() => ({})) : {};
    const error = new Error('speech_unavailable');
    error.status = response.status;
    error.reason = detail.error || '';
    return error;
  }

  async function streamSpeech(text, button, request) {
    if (!audioContext || audioContext.state !== 'running') throw new Error('audio_context_unavailable');
    const controller = new AbortController();
    speechAbort = controller;
    let received = false;
    let pending = '';
    const player = window.MOTORLOZ_PCM.create(audioContext, {
      sources: audioSources,
      onStart() {
        if (request !== voiceRequest) return;
        if (text === welcomeText) welcomePlayed = true;
        statusEl.textContent = 'Disponible';
        statusEl.removeAttribute('title');
        muteButton.classList.remove('is-loading');
        muteButton.classList.add('is-speaking');
      },
      onDrain() {
        if (request !== voiceRequest) return;
        muteButton.classList.remove('is-speaking');
        activeSpeechButton = null;
      }
    });
    pcmPlayer = player;
    const firstAudioTimeout = setTimeout(() => { if (!received) controller.abort(); }, 8000);
    const handleBlock = block => {
      const data = block.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
      if (!data || data === '[DONE]') return;
      let event;
      try { event = JSON.parse(data); } catch { return; }
      if (event.event_type === 'error') throw new Error('voice_interrupted');
      if (event.event_type !== 'step.delta' || event.delta?.type !== 'audio' || !event.delta.data) return;
      const raw = atob(event.delta.data);
      if (!raw.length || request !== voiceRequest) return;
      player.push(Uint8Array.from(raw, character => character.charCodeAt(0)));
      received = true;
      clearTimeout(firstAudioTimeout);
    };
    try {
      const response = await fetch('/api/assistant/speech-stream', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({text}), signal:controller.signal
      });
      if (!response.ok || !response.body) {
        throw await speechError(response);
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
      if (request !== voiceRequest) { player.stop(); return false; }
      pending += decoder.decode();
      if (pending.trim()) handleBlock(pending);
      if (!received) throw new Error('speech_stream_empty');
      player.finish();
      streamFinished = true;
      if (!audioSources.size) { muteButton.classList.remove('is-speaking'); activeSpeechButton = null; }
      return true;
    } catch (error) {
      if (player.started) { streamFinished = true; try { player.finish(); } catch { player.stop(); } error.partialAudio = true; }
      else player.stop();
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
      throw await speechError(response);
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
    statusEl.textContent = 'Disponible';
    statusEl.removeAttribute('title');
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
          if (error.partialAudio) throw error;
          if (audioSources.size) { streamFinished = true; return; }
          if (error.reason === 'saldo_openai_agotado') throw error;
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
      if (error.partialAudio) {
        statusEl.textContent = 'Audio interrumpido';
        statusEl.title = 'Tocá el parlante para escuchar de nuevo la respuesta completa.';
      } else if (error.reason === 'saldo_openai_agotado') {
        statusEl.textContent = 'Voz sin saldo';
        statusEl.title = 'El saldo de OpenAI para la voz está agotado.';
      } else if (error.status === 429 && error.reason === 'limite_temporal') {
        statusEl.textContent = 'Voz sin cupo';
        statusEl.title = 'El cupo temporal de voz está agotado. Intentá más tarde.';
      } else if (error.status === 429 && retryCount < 1 && !muted && !panel.hidden) {
        statusEl.textContent = 'Reconectando voz…';
        statusEl.title = 'La voz está ocupada. Reintentando automáticamente.';
        retryScheduled = true;
        speechRetryTimer = setTimeout(() => {
          speechRetryTimer = null;
          if (request === voiceRequest && !muted && !panel.hidden) speakReply(text, button, retryCount + 1);
        }, 1200);
      } else if (error.status === 429) {
        statusEl.textContent = 'Voz sin cupo';
        statusEl.title = 'El proveedor de voz no tiene cupo disponible. Intentá más tarde.';
      } else if (retryCount < 2 && !muted && !panel.hidden) {
        statusEl.textContent = 'Reconectando voz…';
        statusEl.title = 'Reconectando la voz automáticamente.';
        retryScheduled = true;
        speechRetryTimer = setTimeout(() => {
          speechRetryTimer = null;
          if (request === voiceRequest && !muted && !panel.hidden) speakReply(text, button, retryCount + 1);
        }, [700, 1800][retryCount]);
      } else {
        statusEl.textContent = 'Voz no disponible';
        statusEl.title = 'No se pudo reproducir la voz. Tocá el parlante para reintentar.';
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
    if (role === 'user') followConversation = true;
    const row = document.createElement('div');
    row.className = `assistant-message assistant-message-${role}`;
    if (extra.welcome) {
      const divider = document.createElement('div');
      divider.className = 'assistant-conversation-label';
      divider.textContent = 'Conversemos';
      messagesEl.append(divider);
      row.classList.add('assistant-message-welcome');
      const kicker = document.createElement('span');
      kicker.className = 'assistant-welcome-kicker';
      kicker.textContent = 'RECEPCIÓN DIGITAL  /  MOTORLOZ';
      const heading = document.createElement('p');
      heading.className = 'assistant-welcome-heading';
      heading.append(document.createTextNode('Hola, soy tu asistente de '));
      const brand = document.createElement('strong');
      brand.textContent = 'MOTORLOZ.';
      heading.append(brand);
      const description = document.createElement('p');
      description.className = 'assistant-welcome-description';
      description.textContent = 'Contame qué notaste en el auto o qué servicio necesitás, y lo vemos juntos.';
      const voiceTip = document.createElement('div');
      voiceTip.className = 'assistant-welcome-voice';
      voiceTip.textContent = '⌁  Podés escribir o tocar el micrófono. Al terminar, tocá “Terminar y enviar”.';
      row.append(kicker, heading, description, voiceTip);
      appendConversation(row);
      followLatest();
      return row;
    }
    const copy = document.createElement('p');
    copy.textContent = text;
    const time = document.createElement('time');
    time.className = 'assistant-message-time';
    time.dateTime = new Date().toISOString();
    time.textContent = new Intl.DateTimeFormat('es-UY', { hour:'2-digit', minute:'2-digit' }).format(new Date());
    row.append(copy, time);
    if (extra.pending) row.classList.add('is-pending');
    if (extra.error) row.classList.add('is-error');
    appendConversation(row);
    followLatest();
    return row;
  }

  function summaryIcon(kind) {
    const paths = {
      vehicle: '<path d="M3 15V9l2-4h14l2 4v6M5 15v3M19 15v3M3 11h18M7 14h.01M17 14h.01"/>',
      mileage: '<circle cx="12" cy="12" r="8"/><path d="m12 12 4-3M7 8l1 1M17 8l-1 1M12 6V4"/>',
      service: '<path d="m14 6 4-4 4 4-4 4M14 6 4 16l4 4 10-10"/>',
      urgency: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[kind]}</svg>`;
  }

  function renderSummaryCard(details) {
    const fields = [
      details.vehicle ? { kind:'vehicle', value:[details.vehicle, details.year].filter(Boolean).join(' · ') } : null,
      details.mileage ? { kind:'mileage', value:details.mileage } : null,
      details.issue ? { kind:'service', value:details.issue } : null,
      details.urgency ? { kind:'urgency', value:details.urgency } : null
    ].filter(Boolean);
    if (!fields.length) return;
    const oldHeight = messagesEl.scrollHeight;
    const oldTop = messagesEl.scrollTop;
    const card = summaryCard || document.createElement('section');
    const cardAbove = summaryCard && card.getBoundingClientRect?.().bottom < messagesEl.getBoundingClientRect?.().top;
    card.className = 'assistant-summary-card';
    card.setAttribute('aria-label', 'Resumen de tu consulta');
    const head = document.createElement('div');
    head.className = 'assistant-summary-head';
    head.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h8l4 4v14H7z"/><path d="M15 3v5h5M10 12h6M10 16h6"/></svg><strong>Resumen de tu consulta</strong>';
    const list = document.createElement('div');
    list.className = 'assistant-summary-list';
    for (const field of fields) {
      const row = document.createElement('div');
      row.className = 'assistant-summary-row';
      const icon = document.createElement('span');
      icon.className = 'assistant-summary-icon';
      icon.innerHTML = summaryIcon(field.kind);
      const value = document.createElement('span');
      value.textContent = field.value;
      row.append(icon, value);
      list.append(row);
    }
    card.replaceChildren(head, list);
    if (!summaryCard) appendConversation(card);
    summaryCard = card;
    if (!followConversation && cardAbove) messagesEl.scrollTop = oldTop + messagesEl.scrollHeight - oldHeight;
    followLatest();
  }

  function welcome() {
    conversationVersion += 1;
    chatAbort?.abort();
    chatAbort = null;
    conversationFacts = null;
    confirmedHandoff = null;
    setBusy(false);
    followConversation = true;
    messagesEl.replaceChildren();
    reservationPrompt.hidden = true;
    retryLink.hidden = true;
    history = [];
    bookingDismissed = false;
    handoffHistoryKey = '';
    handoffSummaryPromise = null;
    summaryCard = null;
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
      statusEl.textContent = configured ? 'Disponible' : 'Sin conexión';
      statusEl.removeAttribute('title');
      panel.classList.toggle('is-offline', !configured);
      input.disabled = !configured;
      // Dictation can still work when the chat API is offline; the transcript stays as a draft.
      micButton.disabled = busy;
      syncSendState();
      if (!configured) hintEl.textContent = 'El dictado puede dejar el texto listo; el chat requiere conexión.';
      const refreshGreeting = !statusChecked || (!wasConfigured && configured && !history.length);
      statusChecked = true;
      if (refreshGreeting && !history.length) {
        welcome();
      }
    } catch {
      statusEl.textContent = 'Conexión no disponible';
      statusEl.removeAttribute('title');
      configured = false;
      statusChecked = true;
      input.disabled = true;
      micButton.disabled = busy;
      syncSendState();
      if (!history.length) welcome();
    }
  }

  function setBusy(value) {
    busy = value;
    workingEl.hidden = !value;
    micButton.disabled = value;
    syncSendState();
    form.setAttribute('aria-busy', String(value));
  }

  function syncSendState() {
    sendButton.disabled = busy || !configured || !input.value.trim();
  }

  function saveConversation() {
    try {
      window.sessionStorage?.setItem(conversationKey, JSON.stringify(history.slice(-40)));
      window.sessionStorage?.setItem(conversationKey + '-facts', JSON.stringify(conversationFacts));
      window.sessionStorage?.setItem(conversationKey + '-handoff', JSON.stringify(confirmedHandoff));
    } catch {}
  }

  function restoreConversation() {
    try {
      const stored = JSON.parse(window.sessionStorage?.getItem(conversationKey) || '[]');
      if (!Array.isArray(stored)) return;
      const restored = stored.slice(-40).filter(item => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string' && item.content.trim()).map(item => ({ role:item.role, content:item.content.slice(0, 1200) }));
      if (!restored.length) return;
      history = restored;
      const facts = JSON.parse(window.sessionStorage?.getItem(conversationKey + '-facts') || 'null');
      if (facts && typeof facts === 'object') conversationFacts = Object.fromEntries(['name','vehicle','year','mileage','issue','circumstances','urgency'].map(field => [field, typeof facts[field] === 'string' ? facts[field] : '']));
      const handoff = JSON.parse(window.sessionStorage?.getItem(conversationKey + '-handoff') || 'null');
      confirmedHandoff = typeof handoff === 'boolean' ? handoff : null;
      for (const item of restored) bubble(item.content, item.role);
      lastSpokenText = restored.filter(item => item.role === 'assistant').at(-1)?.content || welcomeText;
      maybeShowBooking(confirmedHandoff === true);
    } catch {}
  }

  function maybeShowBooking(force = false) {
    if (confirmedHandoff !== true) { reservationPrompt.hidden = true; return; }
    if (bookingDismissed) {
      if (!/\b(?:turno|reservar|agendar|coordinar)\b/i.test(history.at(-2)?.content || '')) return;
      bookingDismissed = false;
    }
    const customerTurns = history.filter(item => item.role === 'user');
    const latestUser = customerTurns.at(-1)?.content?.trim() || '';
    const customerText = customerTurns.map(item => item.content).join(' ');
    const earlierAssistant = history.slice(0, -1).filter(item => item.role === 'assistant').at(-1)?.content || '';
    const explicitHandoff = /\b(?:quiero|necesito|pod[eé]s|podemos|me gustar[ií]a|hagamos|haceme)\b.{0,60}\b(?:turno|reserv\w*|agend\w*|coordin\w*|consult\w*|whatsapp)\b/i.test(customerText)
      || /(?:abrir|abr[ií]|preparar|prepar[aá]|mandar|mand[aá]|enviar|envi[aá]|pasemos)\s.{0,45}\b(?:whatsapp|consulta|solicitud|turno)\b/i.test(customerText)
      || /\b(?:reservame|agendame)\b/i.test(customerText);
    const acceptedOffer = /^(?:s[ií]|dale|ok|perfecto|hacelo|preparalo|vamos)(?:[.!\s]|$)/i.test(latestUser)
      && /(?:whatsapp|preparar (?:la |una )?consulta|coordinar)/i.test(earlierAssistant);
    const latestAssistant = history.filter(item => item.role === 'assistant').at(-1)?.content || '';
    const assistantOfferedHandoff = /(?:quer[eé]s|pod[eé]s).{0,55}(?:revisar|preparar|abrir).{0,45}(?:consulta|whatsapp)/i.test(latestAssistant);
    if (!force && !explicitHandoff && !acceptedOffer && !assistantOfferedHandoff) return;
    const details = handoffDetails();
    if (details.name && details.vehicle && details.issue) {
      renderSummaryCard(details);
      reservationPrompt.hidden = false;
      reservationPrompt.removeAttribute('aria-hidden');
      followLatest();
      if (!handoffSummaryPromise || handoffHistoryKey !== customerText) {
        handoffHistoryKey = customerText;
        handoffSummaryPromise = handoffSummary(details.issue);
        handoffSummaryPromise.then(issue => {
          if (handoffHistoryKey === customerText && issue) renderSummaryCard({ ...handoffDetails(), issue });
        });
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
    if (conversationFacts) return conversationFacts;
    const customerTurns = history.filter(item => item.role === 'user').map(item => item.content.trim());
    const words = customerTurns.join(' ');
    const vehicle = words.match(/\b(Subaru|Toyota|Honda|Hyundai|Volkswagen|VW|BMW|Mercedes(?:-Benz)?|Nissan|Mazda|Suzuki|Mitsubishi|Kia|Chevrolet|Peugeot|Audi|Renault|Ford|Jeep|Fiat|Volvo|Citro[eë]n|Dodge|Ferrari|Porsche|Alfa Romeo)\b(?:\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9-]+))?/i);
    const model = vehicle?.[2] && !/^(?:de|del|con|a|al|en|me|anda|tiene|unos?|aprox|kil[oó]metros)$/i.test(vehicle[2]) ? ` ${vehicle[2]}` : '';
    const year = words.match(/\b(19[89]\d|20[0-3]\d)\b/)?.[1] || '';
    const thousands = words.match(/\b(\d{1,3})\s*mil\s*(?:km|kil[oó]metros)?\b/i);
    const mileage = words.match(/\b(\d{2,3}(?:[.,]\d{3})?)\s*(?:km|kil[oó]metros)\b/i);
    const mileageUnknown = /\b(?:no s[eé]|ni idea|desconozco)\b.{0,24}\b(?:kilometraje|kil[oó]metros|km)\b|\b(?:kilometraje|kil[oó]metros|km)\b.{0,24}\b(?:no s[eé]|ni idea|desconozco)\b/i.test(words);
    let urgency = '';
    if (/\b(?:puede esperar|puedo esperar|sin apuro|no hay apuro|cuando puedan|cuando haya lugar|coordinar (?:una )?fecha|no es urgente)\b/i.test(words)) urgency = 'Puede esperar una fecha coordinada';
    else if (/\b(?:urgente|urgencia|cuanto antes|lo antes posible|hoy|no puedo usar(?:lo|la)?|qued[eé] tirado|me dej[oó] tirado)\b/i.test(words)) urgency = 'Necesita atención lo antes posible';
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
      mileage: thousands ? `${thousands[1]}.000 km aprox.` : mileage ? `${mileage[1]} km` : mileageUnknown ? 'Kilometraje no informado' : '',
      issue: simpleServiceSummary(words) || issueFallback,
      urgency
    };
  }

  async function handoffSummary(fallback) {
    if (simpleServiceSummary(history.filter(item => item.role === 'user').map(item => item.content).join(' '))) return fallback;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch('/api/assistant/summary', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ messages:history.slice(-24) }), signal:controller.signal
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
      `*04 · PRIORIDAD*\n- ${details.urgency}`,
      '*05 · COORDINACIÓN*\n- Día y horario: a confirmar por el taller',
      '¿Podemos coordinar una revisión? Quedo atento/a a la confirmación.'
    ];
    return `https://wa.me/${window.MOTORLOZ?.whatsapp || '59891888288'}?text=${encodeURIComponent(sections.join('\n\n'))}`;
  }

  async function requestReply(userMessage, retry = false) {
    if (!configured || busy) return;
    if (!retry) history.push({ role: 'user', content: userMessage });
    confirmedHandoff = false;
    reservationPrompt.hidden = true;
    saveConversation();
    const pending = bubble('Ya te respondo…', 'assistant', { pending: true });
    setBusy(true);
    const controller = new AbortController();
    const version = conversationVersion;
    chatAbort = controller;
    const timeout = setTimeout(() => controller.abort(), 11_000);
    try {
      const response = await fetch('/api/assistant/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.slice(-24),
          intake: (() => {
            const details = handoffDetails();
            return {
              name: Boolean(details.name), vehicle: Boolean(details.vehicle), mileage: Boolean(details.mileage),
              issue: Boolean(details.issue), urgency: Boolean(details.urgency)
            };
          })()
        }), signal:controller.signal
      });
      const result = await response.json();
      if (version !== conversationVersion) return;
      pending.remove();
      if (!response.ok) throw new Error(result.message || 'No pude responder en este momento.');
      const replyText = String(result.reply || '').trim();
      if (!replyText) throw new Error('No pude responder en este momento.');
      if (result.facts && typeof result.facts === 'object') {
        conversationFacts = Object.fromEntries(['name','vehicle','year','mileage','issue','circumstances','urgency'].map(field => [field, typeof result.facts[field] === 'string' ? result.facts[field] : '']));
      }
      confirmedHandoff = result.handoffReady === true;
      history.push({ role: 'assistant', content: replyText });
      saveConversation();
      bubble(replyText, 'assistant');
      lastSpokenText = replyText;
      speakReply(replyText);
      if (!confirmedHandoff) reservationPrompt.hidden = true;
      else maybeShowBooking(true);
    } catch (error) {
      pending.remove();
      if (version !== conversationVersion) return;
      saveConversation();
      const row = bubble(error.name === 'AbortError' ? 'La respuesta demoró demasiado. Conservé lo que me dijiste; podés reintentar.' : error.message || 'No pude responder ahora. Conservé lo que me dijiste; podés reintentar.', 'assistant', { error:true });
      const retryButton = document.createElement('button');
      retryButton.type = 'button';
      retryButton.className = 'assistant-chat-retry';
      retryButton.textContent = 'Reintentar respuesta';
      retryButton.addEventListener('click', () => {
        if (busy || version !== conversationVersion || history.at(-1)?.role !== 'user' || history.at(-1)?.content !== userMessage) return;
        retryButton.disabled = true;
        row.remove();
        return requestReply(userMessage, true);
      });
      row.append(retryButton);
      followLatest();
    } finally {
      clearTimeout(timeout);
      if (chatAbort === controller) chatAbort = null;
      if (version === conversationVersion) setBusy(false);
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
    syncSendState();
    requestReply(text);
  }

  function dictatedText() {
    const raw = [recordingDraft, ...dictationSegments, recognitionFinal, recognitionInterim].filter(Boolean).join(' ').trim().slice(0, 1200);
    const context = history.filter(item => item.role === 'user').map(item => item.content).join(' ');
    return dictationTerms.normalize(raw, context);
  }

  function showDictatedText() {
    input.value = dictatedText();
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 112)}px`;
    syncSendState();
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
    if (text && configured) sendText(text);
    else if (text) {
      input.value = text;
      input.style.height = 'auto';
      input.style.height = `${Math.min(input.scrollHeight, 112)}px`;
      hintEl.textContent = 'Dictado listo. El chat está sin conexión y el texto quedó en el campo.';
    }
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
    const Phrase = window.SpeechRecognitionPhrase;
    if (Phrase && !phraseBiasDisabled && 'phrases' in recognizer) {
      try {
        recognizer.phrases = [
          ['Subaru Impreza', 5], ['Impreza', 4], ['Hawkeye', 4], ['Subaru Hawkeye', 5],
          ['Wagon', 3], ['MOTORLOZ', 4], ['kilometraje', 2], ['embrague', 2],
          ['pastillas de freno', 2], ['suspensión', 2]
        ].map(([phrase, boost]) => new Phrase(phrase, boost));
      } catch {} // Older browsers continue with ordinary dictation.
    }
    // Short recognition sessions work more reliably on mobile; each end starts a fresh one.
    recognizer.continuous = false;
    recognizer.interimResults = true;
    recognizer.maxAlternatives = 3;
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
      const context = [
        ...history.filter(item => item.role === 'user').map(item => item.content),
        recordingDraft, ...dictationSegments,
        ...Array.from(event.results).map(result => result[0]?.transcript || '')
      ].join(' ');
      for (const result of Array.from(event.results)) {
        const phrase = dictationTerms.choose(result, context);
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
      if (event.error === 'phrases-not-supported') {
        phraseBiasDisabled = true;
        transientFailure = true;
        endFallbackTimer = setTimeout(onEnd, 150);
        return;
      }
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
    const keepComposerVisible = document.activeElement === input || followConversation;
    const coveredHeight = viewport ? Math.max(0, (window.innerHeight || visibleHeight) - viewport.height - viewport.offsetTop) : 0;
    panel.style.setProperty?.('--assistant-visible-height', `${visibleHeight}px`);
    panel.style.setProperty?.('--assistant-keyboard-offset', '0px');
    panel.style.setProperty?.('--assistant-visible-width', `${viewport?.width || window.innerWidth}px`);
    panel.style.setProperty?.('--assistant-viewport-top', `${viewport?.offsetTop || 0}px`);
    panel.style.setProperty?.('--assistant-viewport-left', `${viewport?.offsetLeft || 0}px`);
    panel.classList.toggle('is-keyboard-open', coveredHeight > 80 && document.activeElement === input);
    if (keepComposerVisible) followLatest(true);
  }

  function settleMobileViewport() {
    syncViewport();
    window.setTimeout(syncViewport, 90);
    window.setTimeout(syncViewport, 260);
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
    window.dispatchEvent?.(new Event('motorloz:chat-visibility'));
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
    window.dispatchEvent?.(new Event('motorloz:chat-visibility'));
    window.scrollTo?.(0, pageScrollY);
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    launcher.setAttribute('aria-expanded', 'false');
    resetDialog.hidden = true;
    closeTimer = window.setTimeout(() => { panel.hidden = true; }, 220);
    launcher.focus({ preventScroll: true });
  }

  launcher.addEventListener('click', () => panel.classList.contains('is-open') ? close() : open());
  document.querySelector('#diagnostic-chat-open')?.addEventListener('click', () => {
    if (!panel.classList.contains('is-open')) open();
  });
  document.querySelector('#assistant-close').addEventListener('click', close);
  document.querySelector('#assistant-new').addEventListener('click', () => { resetDialog.hidden = false; });
  document.querySelector('#assistant-reset-no').addEventListener('click', () => { resetDialog.hidden = true; });
  document.querySelector('#assistant-reset-yes').addEventListener('click', () => { resetDialog.hidden = true; stopSpeech(); cancelDictation(); welcome(); welcomePlayed = false; welcomeSpoken = configured && !muted; if (welcomeSpoken) speakReply(welcomeText); try { window.sessionStorage?.removeItem(conversationKey); window.sessionStorage?.removeItem(conversationKey + '-facts'); window.sessionStorage?.removeItem(conversationKey + '-handoff'); } catch {} input.focus({preventScroll:true}); });
  muteButton.addEventListener('click', () => {
    muted = !muted;
    updateMuteButton();
    if (muted) stopSpeech();
    else if (lastSpokenText) speakReply(lastSpokenText);
    unlockAudio();
  });
  document.querySelector('#assistant-stop-recording').addEventListener('click', finishDictation);
  document.querySelector('#assistant-mic').addEventListener('click', () => dictating ? finishDictation() : startDictation());
  document.querySelector('#assistant-privacy-link').addEventListener('click', event => {
    event.preventDefault();
    const button = event.currentTarget || document.querySelector('#assistant-privacy-link');
    const details = document.querySelector('#assistant-privacy-details');
    const expanded = button.getAttribute?.('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!expanded));
    button.textContent = expanded ? 'Ver detalles' : 'Ocultar detalles';
    details.hidden = expanded;
  });
  form.addEventListener('submit', event => { event.preventDefault(); if (dictating) finishDictation(); else sendText(input.value); });
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 112)}px`; syncSendState(); });
  input.addEventListener('focus', settleMobileViewport);
  input.addEventListener('blur', settleMobileViewport);
  input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); } });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) close(); });
  window.visualViewport?.addEventListener('resize', syncViewport);
  window.visualViewport?.addEventListener('scroll', syncViewport);
  window.addEventListener?.('resize', syncViewport);

  reserveButton.addEventListener('click', async () => {
    if (reserveButton.disabled) return;
    const details = handoffDetails();
    if (!details.name || !details.vehicle || !details.mileage || !details.issue || !details.urgency) return;
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
      followLatest();
      if (popup) popup.location.href = url;
    } finally {
      reserveButton.disabled = false;
      reserveButton.textContent = 'Abrir WhatsApp';
    }
  });
  document.querySelector('#assistant-reserve-later').addEventListener('click', () => {
    bookingDismissed = true;
    reservationPrompt.hidden = true;
    followLatest();
  });

  welcome();
  syncSendState();
  restoreConversation();
  if (new URLSearchParams(location.search).get('asistente') === '1') open();
})();
