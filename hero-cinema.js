'use strict';

(() => {
  const root = document.querySelector('.hero-cinema');
  if (!root) return;

  const frames = [...root.querySelectorAll('.cinema-frame')];
  const counter = document.querySelector('#hero-counter');
  const label = document.querySelector('#hero-photo-label');
  const title = document.querySelector('#hero-title');
  const description = document.querySelector('.hero-description');
  const dots = [...document.querySelectorAll('[data-hero-index]')];
  const previous = document.querySelector('[data-hero-prev]');
  const next = document.querySelector('[data-hero-next]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const sequence = [
    {
      type: 'video',
      src: 'assets/motorloz-stock.mp4',
      poster: 'assets/taller-panoramica.png',
      start: 18.05,
      end: 20.65,
      playbackRate: .72,
      duration: 3900,
      label: 'EL TALLER, EN MOVIMIENTO',
      title: 'Tu auto.<br>Nuestra<br><em>pasión.</em>',
      description: 'Mecánica, tecnología y atención al detalle. Para lo que te mueve, todos los días.'
    },
    {
      type: 'image',
      src: 'assets/hero-herramientas.webp',
      focus: '48% 48%',
      zoomStart: 1.025,
      zoomEnd: 1.07,
      duration: 5000,
      label: 'HERRAMIENTAS, DIAGNÓSTICO Y OFICIO',
      title: 'Diagnóstico<br>con criterio.<br><em>Trabajo preciso.</em>',
      description: 'Herramientas, experiencia y una conversación clara para entender qué necesita tu vehículo.'
    },
    {
      type: 'video',
      src: 'assets/motorloz-subaru-wrx.mp4',
      poster: 'assets/mecanica-subaru.png',
      start: 1.5,
      end: 8,
      playbackRate: .78,
      duration: 8500,
      label: 'MECÁNICA, DE CERCA',
      title: 'Mecánica<br>de cerca.<br><em>Con criterio.</em>',
      description: 'Escuchamos lo que notaste, revisamos el vehículo y coordinamos el próximo paso.'
    },
    {
      type: 'image',
      src: 'assets/hero-subaru.webp',
      focus: '55% 48%',
      zoomStart: 1.035,
      zoomEnd: 1.075,
      duration: 5000,
      label: 'SUBARU, PASIÓN QUE NOS MUEVE',
      title: 'Subaru.<br>Pasión que<br><em>nos mueve.</em>',
      description: 'Una afinidad especial por Subaru y la misma dedicación para cada marca que llega al taller.'
    },
    {
      type: 'image',
      src: 'assets/hero-ferrari.webp',
      focus: '48% 51%',
      zoomStart: 1.025,
      zoomEnd: 1.065,
      duration: 5000,
      label: 'PASIÓN MULTIMARCA',
      title: 'Atención<br>multimarca.<br><em>Un mismo cuidado.</em>',
      description: 'Mecánica y mantenimiento para vehículos particulares y utilitarios en Montevideo.'
    },
    {
      type: 'image',
      src: 'assets/hero-subaru-azul.webp',
      focus: '50% 52%',
      zoomStart: 1.015,
      zoomEnd: 1.055,
      duration: 5000,
      label: 'SUBARU, EN EL CORAZÓN',
      title: 'El oficio<br>evoluciona.<br><em>El cuidado permanece.</em>',
      description: 'Formación, tecnología y atención cercana detrás de cada trabajo de MOTORLOZ.'
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
    if (title && scene.title) title.innerHTML = scene.title;
    if (description && scene.description) description.textContent = scene.description;
    root.setAttribute('aria-label', scene.label);
    root.dataset.currentKind = scene.type;
    dots.forEach((dot, dotIndex) => {
      if (dotIndex === index) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
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

  previous?.addEventListener('click', () => advance(-1));
  next?.addEventListener('click', () => advance(1));
  dots.forEach((dot, dotIndex) => dot.addEventListener('click', () => {
    const delta = (dotIndex - index + sequence.length) % sequence.length;
    if (delta) advance(delta);
  }));
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
