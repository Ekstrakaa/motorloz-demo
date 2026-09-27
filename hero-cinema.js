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
      src: 'assets/motorloz-stock.mp4',
      poster: 'assets/salon-panoramica.png',
      start: 18.05,
      end: 20.65,
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
      src: 'assets/motorloz-subaru-wrx.mp4',
      poster: 'assets/hero-subaru.webp',
      start: 1.5,
      end: 8,
      playbackRate: .78,
      duration: 8500,
      label: 'MECÁNICA, DE CERCA'
    },
    {
      type: 'image',
      src: 'assets/hero-ferrari.webp',
      focus: '48% 51%',
      zoomStart: 1.025,
      zoomEnd: 1.065,
      duration: 5000,
      label: 'PASIÓN MULTIMARCA'
    },
    {
      type: 'image',
      src: 'assets/hero-subaru-azul.webp',
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
    const beginAtSelectedShot = () => {
      const safeStart = Math.min(item.start, Math.max(0, video.duration - .25));
      video.pause();
      video.playbackRate = item.playbackRate || 1;
      const resume = () => {
        video.dataset.segmentReady = 'true';
        if (visible && !document.hidden) video.play().catch(() => {});
      };
      video.addEventListener('seeked', resume, { once: true });
      video.currentTime = safeStart;
      window.setTimeout(() => {
        if (video.currentTime < safeStart - .5) video.currentTime = safeStart;
        else resume();
      }, 320);
    };
    video.addEventListener('loadedmetadata', beginAtSelectedShot, { once: true });
    video.addEventListener('timeupdate', () => {
      if (frame.classList.contains('is-current') && item.end && video.currentTime >= item.end) advance();
    });
    frame.append(video);
    video.dataset.segmentStart = String(item.start);
    video.src = item.src;
    video.load();
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
    frames[incoming].setAttribute('aria-hidden', 'true');

    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (token !== transitionToken) return;
      frames[incoming].classList.add('is-current');
      frames[incoming].removeAttribute('aria-hidden');
      frames[outgoing].classList.remove('is-current');
      frames[outgoing].setAttribute('aria-hidden', 'true');
      window.setTimeout(() => stopFrame(frames[outgoing]), 1500);
      active = incoming;
      index = nextIndex;
      updateMeta();
      transitioning = false;
      schedule();
    }));
  }

  render(frames[0], sequence[index]);
  updateMeta();
  schedule();

  reducedMotion.addEventListener?.('change', schedule);

  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    root.querySelectorAll('video').forEach(video => visible ? video.play().catch(() => {}) : video.pause());
    schedule();
  }, { threshold: .12 }).observe(root);

  document.addEventListener('visibilitychange', () => {
    root.querySelectorAll('video').forEach(video => document.hidden ? video.pause() : video.play().catch(() => {}));
    schedule();
  });
})();
