'use strict';
(() => {
  document.querySelectorAll('.why-card>svg').forEach((svg, i) => {
    const icon = document.createElement('span');
    icon.className = 'why-icon'; icon.dataset.iconIndex = String(i + 9);
    icon.setAttribute('aria-hidden', 'true'); svg.replaceWith(icon);
  });

  const engineSketch = document.querySelector('.subaru-section .engine-sketch');
  if (engineSketch && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    if ('IntersectionObserver' in window) {
      const engineObserver = new IntersectionObserver(entries => {
        engineSketch.classList.toggle('is-revving', entries[0].isIntersecting);
      }, { threshold: .28 });
      engineObserver.observe(engineSketch);
    } else {
      engineSketch.classList.add('is-revving');
    }
  }

  function rotateImages(rootSelector, imageSelector, interval, update) {
    const root = document.querySelector(rootSelector);
    if (!root) return;
    const images = [...root.querySelectorAll(imageSelector)];
    if (images.length < 2) return;
    let index = 0;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const observer = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return;
      clearInterval(root._refreshTimer);
      root._refreshTimer = setInterval(() => {
        images[index].classList.remove('is-active');
        images[index].setAttribute('aria-hidden', 'true');
        index = (index + 1) % images.length;
        images[index].classList.add('is-active');
        images[index].removeAttribute('aria-hidden');
        update?.(index, images.length);
      }, interval);
    }, { threshold: .12 });
    observer.observe(root);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearInterval(root._refreshTimer);
      else if (root.getBoundingClientRect().bottom > 0 && root.getBoundingClientRect().top < innerHeight) {
        clearInterval(root._refreshTimer);
        root._refreshTimer = setInterval(() => {
          images[index].classList.remove('is-active'); images[index].setAttribute('aria-hidden', 'true');
          index = (index + 1) % images.length; images[index].classList.add('is-active'); images[index].removeAttribute('aria-hidden');
          update?.(index, images.length);
        }, interval);
      }
    });
  }
  rotateImages('[data-subaru-carousel]', '.subaru-carousel-stage img', 4800, (i, n) => {
    const label = document.querySelector('.subaru-carousel-caption span:first-child');
    const count = document.querySelector('[data-carousel-index]');
    if (label) label.textContent = i ? 'SUBARU · ATENCIÓN MULTIMARCA' : 'SUBARU · DETALLE';
    if (count) count.textContent = `${String(i + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`;
  });
  const diagLabels = ['ATENCIÓN TOYOTA GR', 'DETALLE · TOYOTA GR', 'CORVETTE · TALLER', 'MOTOR PORSCHE · REVISIÓN'];
  rotateImages('[data-diagnostic-carousel]', '.diagnostic-feature-stage img', 4300, (i, n) => {
    const label = document.querySelector('[data-diagnostic-caption]');
    const count = document.querySelector('[data-diagnostic-index]');
    if (label) label.textContent = diagLabels[i];
    if (count) count.textContent = `${String(i + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`;
  });
})();
