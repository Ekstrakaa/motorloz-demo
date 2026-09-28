'use strict';
(() => {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  document.querySelectorAll('[data-diagnostic-slideshow]').forEach(tile => {
    const slides = [...tile.querySelectorAll('.diagnostic-slide')];
    if (slides.length < 2) return;

    let active = slides.findIndex(slide => slide.classList.contains('is-active'));
    let timer = null;
    if (active < 0) active = 0;

    function advance() {
      slides[active].classList.remove('is-active');
      slides[active].setAttribute('aria-hidden', 'true');
      active = (active + 1) % slides.length;
      slides[active].classList.add('is-active');
      slides[active].removeAttribute('aria-hidden');
    }

    function stop() {
      if (timer !== null) clearInterval(timer);
      timer = null;
    }

    function start() {
      stop();
      if (document.hidden || reducedMotion.matches) return;
      timer = setInterval(advance, 3000);
    }

    document.addEventListener('visibilitychange', start);
    reducedMotion.addEventListener('change', start);
    start();
  });
})();
