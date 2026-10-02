'use strict';
(() => {
  document.querySelectorAll('.why-card>svg').forEach((svg, i) => {
    const icon = document.createElement('span');
    icon.className = 'why-icon'; icon.dataset.iconIndex = String(i + 9);
    icon.setAttribute('aria-hidden', 'true'); svg.replaceWith(icon);
  });

  const ratingStars = document.querySelector('.reviews-rating .gold-stars');
  if (ratingStars) {
    ratingStars.innerHTML = [...ratingStars.textContent.trim()].map((star, index) =>
      `<span style="--star-delay:${index * 95}ms">${star}</span>`
    ).join('');
  }

  const entranceTargets = [...document.querySelectorAll(
    '.service-icon,.why-icon,.service-title-row h3,.why-card-copy,.brand-wordmark,.reviews-rating'
  )];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduceMotion && 'IntersectionObserver' in window) {
    entranceTargets.forEach((target, index) => {
      target.classList.add('scroll-entry');
      target.style.setProperty('--entry-delay', `${(index % 5) * 65}ms`);
    });
    const entranceObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-scroll-visible');
      entranceObserver.unobserve(entry.target);
    }), { threshold: .16, rootMargin: '0px 0px -5% 0px' });
    entranceTargets.forEach(target => entranceObserver.observe(target));
  }

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
    if (label) label.textContent = ['SUBARU · DETALLE', 'SUBARU · ATENCIÓN MULTIMARCA', 'SUBARU · EN EL TALLER'][i];
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
