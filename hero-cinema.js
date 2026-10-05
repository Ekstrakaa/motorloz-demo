'use strict';

(() => {
  const root = document.querySelector('.hero-cinema');
  if (!root) return;
  const frames = [...root.querySelectorAll('.cinema-frame')];
  const counter = document.querySelector('#hero-counter');
  const label = document.querySelector('#hero-photo-label');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const defaults = [
    { type: 'video', src: 'assets/cinema-hyundai-natural.mp4', poster: 'assets/hyundai-full-poster.jpg', duration: 15000, label: 'HYUNDAI, EN MOVIMIENTO' },
    { type: 'video', src: 'assets/cinema-workshop-panorama.mp4', poster: 'assets/salon-panoramica-optimized.webp', duration: 3800, label: 'EL TALLER, EN MOVIMIENTO' },
    { type: 'image', src: 'assets/hero-herramientas.webp', focus: '48% 48%', zoomStart: 1.025, zoomEnd: 1.07, duration: 3000, label: 'HERRAMIENTAS, DIAGNÓSTICO Y OFICIO' },
    { type: 'video', src: 'assets/motorloz-subaru-loop.mp4', poster: 'assets/hero-subaru.webp', duration: 10000, label: 'MECÁNICA, DE CERCA' },
    { type: 'video', src: 'assets/cinema-subaru-natural.mp4', poster: 'assets/subaru-full-poster.jpg', duration: 10000, label: 'SUBARU, EN MOVIMIENTO' },
    { type: 'image', src: 'assets/hero-subaru-azul.webp?v=privacy1', focus: '50% 52%', zoomStart: 1.015, zoomEnd: 1.055, duration: 3000, label: 'SUBARU, EN EL CORAZÓN' }
  ];
  let sequence = defaults;
  const params = new URLSearchParams(location.search);
  if (params.has('montaje')) {
    try {
      const draft = JSON.parse(localStorage.getItem('motorloz-home-sequence-draft-v1'));
      if (Array.isArray(draft) && draft.length) {
        const allowed = new Map(defaults.map(item => [item.src.split('?')[0], item]));
        const preview = draft.map(scene => {
          const item = allowed.get(scene.src?.split('?')[0]);
          if (!item || scene.type !== item.type) return null;
          const duration = Math.min(30, Math.max(1, Number(scene.duration) || (item.type === 'video' ? 10 : 3)));
          return { ...item, duration: duration * 1000,
            focus: `${Math.min(100, Math.max(0, Number(scene.focusX) || 50))}% ${Math.min(100, Math.max(0, Number(scene.focusY) || 50))}%`,
            start: Math.max(0, Number(scene.trimStart) || 0),
            end: scene.trimEnd == null ? null : Math.max(0, Number(scene.trimEnd) || 0),
            transition: Math.max(0, Math.min(1.5, Number(scene.transition) || 0)) };
        }).filter(Boolean);
        if (preview.length) sequence = preview;
      }
    } catch { /* The optional editor draft must never interrupt the published home. */ }
  }

  const requested = Number(params.get('scene'));
  let index = Number.isInteger(requested) && requested >= 1 && requested <= sequence.length ? requested - 1 : 0;
  let active = 0;
  let visible = true;
  let transitioning = false;
  let timer = 0;
  let token = 0;

  function canPlay() {
    return visible && !document.hidden && !document.documentElement?.classList.contains('assistant-chat-open');
  }
  function currentVideo() { return frames[active].querySelector('video'); }
  function syncPlayback() {
    const video = currentVideo();
    if (!video) return;
    if (canPlay() && !reducedMotion.matches && !video.ended) video.play().catch(() => {});
    else video.pause();
  }
  function updateMeta() {
    const item = sequence[index];
    if (counter) counter.textContent = `${String(index + 1).padStart(2, '0')} / ${String(sequence.length).padStart(2, '0')}`;
    if (label) label.textContent = item.label;
    root.setAttribute('aria-label', item.label);
    root.dataset.currentKind = item.type;
  }
  function clearFrame(frame) {
    frame.querySelector('video')?.pause();
    frame.replaceChildren();
    frame.style.backgroundImage = '';
  }
  function still(frame, src) {
    const image = new Image();
    image.className = 'cinema-media';
    image.src = src;
    image.alt = '';
    image.decoding = 'async';
    frame.append(image);
    return image.decode?.().catch(() => {}) || Promise.resolve();
  }
  function prepare(frame, item) {
    clearFrame(frame);
    frame.dataset.kind = item.type;
    frame.style.backgroundImage = `url("${item.type === 'image' ? item.src : item.poster}")`;
    frame.style.backgroundPosition = item.focus || 'center';
    frame.style.setProperty('--cinema-focus', item.focus || '50% 50%');
    frame.style.setProperty('--cinema-zoom-start', item.zoomStart || 1);
    frame.style.setProperty('--cinema-zoom-end', item.zoomEnd || 1.025);
    if (item.type === 'image' || reducedMotion.matches) return still(frame, item.type === 'image' ? item.src : item.poster);

    // Decode the incoming clip behind the outgoing frame. Never crossfade to a
    // still and then replace that still with moving footage after the fade.
    const video = document.createElement('video');
    video.className = 'cinema-media';
    video.muted = video.defaultMuted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.loop = false;
    video.poster = item.poster;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('disablepictureinpicture', '');
    video.src = item.src;
    video.playbackRate = video.defaultPlaybackRate = item.playbackRate || 1;
    video.addEventListener('ended', () => { if (currentVideo() === video && !transitioning) advance(); });
    video.addEventListener('timeupdate', () => {
      if (currentVideo() === video && item.end && video.currentTime >= item.end - .08 && !transitioning) advance();
    });
    frame.append(video);
    return new Promise(resolve => {
      let settled = false;
      const timeout = window.setTimeout(() => finish(false), 4500);
      function finish(ready) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        video.removeEventListener('loadeddata', loaded);
        video.removeEventListener('error', failed);
        if (!ready) { video.pause(); video.remove(); still(frame, item.poster).then(resolve); }
        else resolve();
      }
      function loaded() {
        if (item.start && Number.isFinite(video.duration) && item.start < video.duration) {
          video.currentTime = item.start;
          video.addEventListener('seeked', () => finish(true), { once: true });
        } else finish(true);
      }
      function failed() { finish(false); }
      video.addEventListener('loadeddata', loaded, { once: true });
      video.addEventListener('error', failed, { once: true });
      video.load();
      // iOS may withhold loadeddata from a muted clip until playback is requested.
      video.play().catch(() => {});
      if (video.readyState >= 2) loaded();
    });
  }
  function schedule() {
    clearTimeout(timer);
    if (!visible || document.hidden || reducedMotion.matches || transitioning) return;
    timer = window.setTimeout(advance, sequence[index].duration);
  }
  async function advance(step = 1) {
    if (transitioning || !visible || document.hidden) return;
    transitioning = true;
    clearTimeout(timer);
    currentVideo()?.pause();
    const turn = ++token;
    const incoming = 1 - active;
    const outgoing = active;
    const fadeSeconds = sequence[index].transition ?? 1.25;
    const next = (index + step + sequence.length) % sequence.length;
    const item = sequence[next];
    frames[incoming].setAttribute('aria-hidden', 'true');
    await prepare(frames[incoming], item);
    if (turn !== token) return;
    root.style.setProperty('--scene-fade', `${fadeSeconds}s`);
    frames[incoming].classList.add('is-current');
    frames[incoming].removeAttribute('aria-hidden');
    frames[outgoing].classList.remove('is-current');
    frames[outgoing].setAttribute('aria-hidden', 'true');
    active = incoming;
    index = next;
    updateMeta();
    syncPlayback();
    window.setTimeout(() => {
      if (turn !== token) return;
      clearFrame(frames[outgoing]);
      transitioning = false;
      schedule();
    }, fadeSeconds * 1000 + 60);
  }

  updateMeta();
  prepare(frames[active], sequence[index]).then(() => { root.classList.add('is-ready'); syncPlayback(); schedule(); });
  reducedMotion.addEventListener?.('change', () => {
    ++token;
    transitioning = false;
    clearTimeout(timer);
    prepare(frames[active], sequence[index]).then(() => { syncPlayback(); schedule(); });
  });
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    syncPlayback();
    schedule();
  }, { threshold: .12 }).observe(root);
  document.addEventListener('visibilitychange', () => { syncPlayback(); schedule(); });
  window.addEventListener?.('motorloz:chat-visibility', syncPlayback);
})();
