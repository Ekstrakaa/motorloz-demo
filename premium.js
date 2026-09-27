'use strict';
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const header = document.querySelector('.header');
  const progress = document.querySelector('.reading-progress');
  let queued = false;
  let scrollRange = 1;
  let headerScrolled = null;

  function measureScrollRange() {
    scrollRange = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    queueScrollState();
  }

  function scrollState() {
    queued = false;
    const nextHeaderState = scrollY > 90;
    if (header && nextHeaderState !== headerScrolled) {
      header.classList.toggle('header-scrolled', nextHeaderState);
      headerScrolled = nextHeaderState;
    }
    if (progress) progress.style.transform = `scaleX(${Math.min(1, Math.max(0, scrollY / scrollRange))})`;
  }
  function queueScrollState() {
    if (!queued) { queued = true; requestAnimationFrame(scrollState); }
  }
  addEventListener('scroll', queueScrollState, { passive: true });
  addEventListener('resize', measureScrollRange, { passive: true });
  addEventListener('load', measureScrollRange, { once: true });
  if ('ResizeObserver' in window && document.body) {
    new ResizeObserver(measureScrollRange).observe(document.body);
  }
  document.fonts?.ready.then(measureScrollRange).catch(() => {});
  measureScrollRange();

  document.querySelector('#contact-open')?.addEventListener('click', () => document.querySelector('#contact-dialog')?.showModal());

  document.querySelectorAll('.slide-expand').forEach(button => {
    button.addEventListener('click', () => {
      const slideshow = button.closest('[data-slideshow]');
      const image = slideshow?.querySelector('.slide-frame.is-current img');
      if (!image) return;
      const dialog = document.querySelector('#photo-dialog');
      const photo = dialog?.querySelector('.photo-source');
      if (!dialog || !photo) return;
      photo.className = 'photo-source';
      photo.style.backgroundImage = `url("${image.currentSrc || image.src}")`;
      photo.style.aspectRatio = `${image.naturalWidth || 4} / ${image.naturalHeight || 3}`;
      photo.style.minHeight = '0';
      photo.style.height = 'min(66svh, 640px)';
      photo.style.backgroundSize = 'contain';
      photo.style.backgroundRepeat = 'no-repeat';
      photo.setAttribute('role', 'img');
      photo.setAttribute('aria-label', image.alt);
      document.querySelector('#photo-caption').textContent = `${image.alt} · MOTORLOZ`;
      dialog.showModal();
    });
  });

  if (!reduced.matches && 'IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-in');
        revealObserver.unobserve(entry.target);
      }
    }), { threshold: .08, rootMargin: '0px 0px -4%' });
    const revealSelector = [
      '.intro-feature-image', '.service-card', '.hyundai-image', '.diagnostic-mosaic .diagnostic-tile',
      '.film-card', '.google-place-card', '.appointment-office', '.map-panel', '.arrival-slide-figure'
    ].join(',');
    document.querySelectorAll(revealSelector).forEach((node, index) => {
      node.classList.add('scroll-reveal');
      node.style.setProperty('--reveal-delay', `${(index % 4) * 65}ms`);
      revealObserver.observe(node);
    });
  } else {
    document.querySelectorAll('.scroll-reveal').forEach(node => node.classList.add('is-in'));
  }

  const floating = document.querySelector('.floating-booking');
  const hero = document.querySelector('#inicio');
  const form = document.querySelector('#turno');
  const services = document.querySelector('#servicios');
  const gallery = document.querySelector('#mirada');
  const people = document.querySelector('.people');
  const reviews = document.querySelector('.reviews');
  const contactBridge = document.querySelector('.contact-bridge');
  const referenceBridge = document.querySelector('.reference-bridge');
  const diagnosticStory = document.querySelector('.diagnostic-story');
  const films = document.querySelector('.films-section');
  const location = document.querySelector('#ubicacion');
  if (floating && hero && form && 'IntersectionObserver' in window) {
    const key = section => section.id || section.className;
    const targets = [hero, services, gallery, people, reviews, referenceBridge, diagnosticStory, contactBridge, films, form, location].filter(Boolean);
    const visible = new Map(targets.map(section => [key(section), section === hero]));
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => visible.set(key(entry.target), entry.isIntersecting));
      floating.classList.toggle('is-visible', !targets.some(section => visible.get(key(section))));
    }, { threshold: .12 });
    targets.forEach(section => observer.observe(section));
  }
})();
