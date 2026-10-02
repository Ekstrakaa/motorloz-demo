'use strict';

(() => {
  const root = document.querySelector('.hero-cinema');
  if (!root) return;

  const frames = [...root.querySelectorAll('.cinema-frame')];
  const counter = document.querySelector('#hero-counter');
  const label = document.querySelector('#hero-photo-label');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const sequence = [
    {
      type: 'video',
      src: 'assets/cinema-workshop.mp4',
      poster: 'assets/salon-panoramica-optimized.webp',
      start: 0,
      playbackRate: .72,
      duration: 3900,
      label: 'EL TALLER, EN MOVIMIENTO'
    },
    {
      type: 'image',
      src: 'assets/hero-herramientas.webp',
      focus: '48% 48%',
      zoomStart: 1.025,
      zoomEnd: 1.07,
      duration: 5000,
      label: 'HERRAMIENTAS, DIAGNÓSTICO Y OFICIO'
    },
    {
      type: 'video',
      src: 'assets/cinema-engine.mp4',
      poster: 'assets/hero-subaru.webp',
      start: 0,
      playbackRate: .78,
      duration: 8500,
      label: 'MECÁNICA, DE CERCA'
    },
    {
      type: 'image',
      src: 'assets/hero-bruno.png',
      focus: '50% 49%',
      zoomStart: 1.025,
      zoomEnd: 1.065,
      duration: 5000,
      label: 'BRUNO · DIAGNÓSTICO EN EL TALLER'
    },
    {
      type: 'image',
      src: 'assets/hero-subaru-azul.webp?v=privacy1',
      focus: '50% 52%',
      zoomStart: 1.015,
      zoomEnd: 1.055,
      duration: 5000,
      label: 'SUBARU, EN EL CORAZÓN'
    }
  ];

  let index = 0;
  let active = 0;
  let timer = 0;
  let visible = true;
  let transitionToken = 0;
  let transitioning = false;
  const players = new Map();

  const requestedScene = Number(new URLSearchParams(location.search).get('scene'));
  if (Number.isInteger(requestedScene) && requestedScene >= 1 && requestedScene <= sequence.length) {
    index = requestedScene - 1;
  }

  function updateMeta() {
    const scene = sequence[index];
    counter.textContent = `${String(index + 1).padStart(2, '0')} / ${String(sequence.length).padStart(2, '0')}`;
    label.textContent = scene.label;
    root.setAttribute('aria-label', scene.label);
    root.dataset.currentKind = scene.type;
  }

  function stopFrame(frame) {
    players.get(frame)?.dispose();
    players.delete(frame);
    frame.querySelectorAll('video').forEach(video => {
      video.pause();
      video.removeAttribute('src');
      video.load();
    });
  }

  function render(frame, item) {
    stopFrame(frame);
    frame.replaceChildren();
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
      return;
    }

    const video = document.createElement('video');
    video.className = 'cinema-media';
    video.poster = item.poster;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.tabIndex = -1;
    video.playbackRate = item.playbackRate || 1;
    video.defaultPlaybackRate = item.playbackRate || 1;
    video.addEventListener('ended', () => {
      if (frame.classList.contains('is-current')) advance();
    });
    frame.append(video);
    const player = window.MOTORLOZ_VIDEO(video, {
      host: root.parentElement, source: item.src,
      shouldPlay: () => visible && frame.classList.contains('is-current') && !reducedMotion.matches,
      onBlocked: () => clearTimeout(timer)
    });
    players.set(frame, player);
    player.sync();
  }

  function schedule() {
    clearTimeout(timer);
    // Advance video scenes only when the actual clip ends, after buffering.
    if (!visible || document.hidden || reducedMotion.matches || sequence[index].type === 'video') return;
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
    frames[incoming].setAttribute('aria-hidden', 'true');

    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (token !== transitionToken) return;
      frames[incoming].classList.add('is-current');
      frames[incoming].removeAttribute('aria-hidden');
      frames[outgoing].classList.remove('is-current');
      frames[outgoing].setAttribute('aria-hidden', 'true');
      window.setTimeout(() => {
        if (token === transitionToken && !frames[outgoing].classList.contains('is-current')) stopFrame(frames[outgoing]);
      }, 1500);
      active = incoming;
      index = nextIndex;
      updateMeta();
      transitioning = false;
      players.forEach(player => player.sync());
      schedule();
    }));
  }

  render(frames[0], sequence[index]);
  updateMeta();
  schedule();

  reducedMotion.addEventListener?.('change', () => { render(frames[active], sequence[index]); schedule(); });

  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    players.forEach(player => player.sync());
    schedule();
  }, { threshold: .12 }).observe(root);

  document.addEventListener('visibilitychange', () => {
    players.forEach(player => player.sync());
    schedule();
  });
})();
