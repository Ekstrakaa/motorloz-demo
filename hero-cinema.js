'use strict';

(() => {
  const root = document.querySelector('.hero-cinema');
  if (!root) return;

  const frames = [...root.querySelectorAll('.cinema-frame')];
  const counter = document.querySelector('#hero-counter');
  const label = document.querySelector('#hero-photo-label');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const defaults = [
    // The source revisits its opening shot after nine seconds; leave on the first pass.
    { type: 'video', src: 'assets/cinema-hyundai-natural.mp4', poster: 'assets/clips/hyundai-home.jpg', duration: 9000, end: 9, label: 'HYUNDAI, EN MOVIMIENTO' },
    { type: 'video', src: 'assets/cinema-workshop-panorama.mp4', poster: 'assets/salon-panoramica-optimized.webp', duration: 3800, label: 'EL TALLER, EN MOVIMIENTO' },
    { type: 'image', src: 'assets/hero-herramientas.webp', focus: '48% 48%', zoomStart: 1.025, zoomEnd: 1.07, duration: 3000, label: 'HERRAMIENTAS, DIAGNÓSTICO Y OFICIO' },
    { type: 'video', src: 'assets/motorloz-subaru-loop.mp4', poster: 'assets/hero-subaru.webp', duration: 10000, label: 'MECÁNICA, DE CERCA' },
    { type: 'video', src: 'assets/cinema-subaru-natural.mp4', poster: 'assets/clips/subaru-home.jpg', duration: 10000, label: 'SUBARU, EN MOVIMIENTO' },
    { type: 'image', src: 'assets/hero-subaru-azul.webp?v=privacy1', focus: '50% 52%', zoomStart: 1.015, zoomEnd: 1.055, duration: 3000, label: 'SUBARU, EN EL CORAZÓN' }
  ];
  let sequence = defaults;
  if (new URLSearchParams(location.search).has('montaje')) {
    try {
      const draft = JSON.parse(localStorage.getItem('motorloz-home-sequence-draft-v1'));
      if (Array.isArray(draft) && draft.length) {
        const allowed = new Map(defaults.map(item => [item.src.split('?')[0], item]));
        const preview = draft.map(scene => {
          const item = allowed.get(scene.src?.split('?')[0]);
          if (!item || scene.type !== item.type) return null;
          const duration = Math.min(30, Math.max(1, Number(scene.duration) || (item.type === 'video' ? 10 : 3)));
          return {...item, duration: duration * 1000,
            focus: `${Math.min(100,Math.max(0,Number(scene.focusX) || 50))}% ${Math.min(100,Math.max(0,Number(scene.focusY) || 50))}%`,
            start: Math.max(0,Number(scene.trimStart) || 0),
            end: scene.trimEnd == null ? null : Math.max(0,Number(scene.trimEnd) || 0),
            transition: Math.max(0,Math.min(1.5,Number(scene.transition) || 0))};
        }).filter(Boolean);
        if (preview.length) sequence = preview;
      }
    } catch { /* A saved draft is optional; the published sequence stays available. */ }
  }

  let index = 0;
  let active = 0;
  let timer = 0;
  let visible = true;
  let transitionToken = 0;
  let transitioning = false;
  let player = null;
  let playerSource = '';
  const requestedScene = Number(new URLSearchParams(location.search).get('scene'));
  if (Number.isInteger(requestedScene) && requestedScene >= 1 && requestedScene <= sequence.length) index = requestedScene - 1;

  const video = document.createElement('video');
  video.className = 'cinema-media cinema-single-video';
  video.muted = video.defaultMuted = true;
  video.controls = false;
  video.playsInline = true;
  video.autoplay = true;
  video.preload = 'auto';
  video.tabIndex = -1;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.setAttribute('autoplay', '');
  video.removeAttribute('controls');
  root.append(video);

  function updateMeta() {
    const scene = sequence[index];
    counter.textContent = `${String(index + 1).padStart(2, '0')} / ${String(sequence.length).padStart(2, '0')}`;
    label.textContent = scene.label;
    root.setAttribute('aria-label', scene.label);
    root.dataset.currentKind = scene.type;
  }

  function clearFrame(frame) {
    frame.querySelectorAll('img').forEach(image => image.remove());
    frame.replaceChildren();
  }

  function render(frame, item) {
    clearFrame(frame);
    frame.dataset.kind = item.type;
    frame.style.backgroundImage = item.type === 'image' ? `url("${item.src}")` : `url("${item.poster}")`;
    frame.style.backgroundPosition = item.focus || 'center';
    frame.style.setProperty('--cinema-focus', item.focus || '50% 50%');
    frame.style.setProperty('--cinema-zoom-start', item.zoomStart || 1);
    frame.style.setProperty('--cinema-zoom-end', item.zoomEnd || 1.025);

    if (item.type === 'image' || reducedMotion.matches) {
      const image = new Image();
      image.className = 'cinema-media';
      image.src = item.type === 'image' ? item.src : item.poster;
      image.alt = '';
      image.decoding = 'async';
      frame.append(image);
    } else {
      video.poster = item.poster;
    }
  }

  function shouldPlay() {
    return visible && frames[active].classList.contains('is-current') && sequence[index].type === 'video' && !reducedMotion.matches;
  }

  function syncVideo(item = sequence[index]) {
    if (reducedMotion.matches || item.type !== 'video') {
      video.classList.remove('is-visible');
      player?.sync();
      return;
    }
    if (!player) {
      player = window.MOTORLOZ_VIDEO(video, {
        source: item.src,
        shouldPlay,
        onPlaying: () => video.classList.toggle('is-visible', shouldPlay())
      });
      // Each clip has one uninterrupted pass. Rewinding short assets inside a
      // longer scene looked like a stall, particularly on mobile Safari.
      video.addEventListener('ended', () => { if (shouldPlay()) advance(); });
      video.addEventListener('timeupdate', () => {
        const item = sequence[index];
        if (shouldPlay() && item.end && video.currentTime >= item.end - .06) advance();
      });
      video.addEventListener('loadedmetadata', () => {
        if (shouldPlay() && sequence[index].start) video.currentTime = sequence[index].start;
      });
      playerSource = item.src;
    } else if (playerSource !== item.src) {
      playerSource = item.src;
      video.classList.remove('is-visible');
      player.setSource(item.src, item.playbackRate || 1);
    }
    video.playbackRate = video.defaultPlaybackRate = item.playbackRate || 1;
    if (shouldPlay()) player.sync();
  }

  function schedule() {
    clearTimeout(timer);
    if (!visible || document.hidden || reducedMotion.matches) return;
    timer = window.setTimeout(advance, sequence[index].duration);
  }

  function advance(step = 1) {
    if (transitioning) return;
    transitioning = true;
    const token = ++transitionToken;
    clearTimeout(timer);
    const nextIndex = (index + step + sequence.length) % sequence.length;
    const incoming = active === 0 ? 1 : 0;
    const outgoing = active;
    render(frames[incoming], sequence[nextIndex]);
    root.style.setProperty('--scene-fade', `${sequence[index].transition ?? 1.25}s`);
    frames[incoming].setAttribute('aria-hidden', 'true');

    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (token !== transitionToken) return;
      frames[incoming].classList.add('is-current');
      frames[incoming].removeAttribute('aria-hidden');
      frames[outgoing].classList.remove('is-current');
      frames[outgoing].setAttribute('aria-hidden', 'true');
      window.setTimeout(() => {
        if (token === transitionToken && !frames[outgoing].classList.contains('is-current')) clearFrame(frames[outgoing]);
      }, 1500);
      active = incoming;
      index = nextIndex;
      updateMeta();
      transitioning = false;
      syncVideo(sequence[index]);
      schedule();
    }));
  }

  render(frames[0], sequence[index]);
  updateMeta();
  if (sequence[index].type === 'video' && !reducedMotion.matches) syncVideo(sequence[index]);
  schedule();

  reducedMotion.addEventListener?.('change', () => { render(frames[active], sequence[index]); syncVideo(sequence[index]); schedule(); });
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    syncVideo(sequence[index]);
    schedule();
  }, { threshold: .12 }).observe(root);
  document.addEventListener('visibilitychange', () => { syncVideo(sequence[index]); schedule(); });
})();
