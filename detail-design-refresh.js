'use strict';
(() => {
  const serviceArt = [
    '<rect x="10" y="10" width="28" height="28" rx="7"/><path d="m28 12 8 8-5 5-8-8 5-5Z"/><path d="m12 36 11-11m-9 1 5 5m-1-11 5 5"/><circle cx="34" cy="14" r="2"/>',
    '<circle cx="24" cy="24" r="16"/><circle cx="24" cy="24" r="10"/><circle cx="24" cy="24" r="3"/><path d="M24 4v6m0 28v6M4 24h6m28 0h6M10 10l5 5m18 18 5 5m0-28-5 5M15 33l-5 5"/>',
    '<path d="M16 6v7m16-7v7m-16 22v7m16-7v7"/><path d="M16 13c0 5 16 5 16 10s-16 5-16 10"/><path d="M32 13c0 5-16 5-16 10s16 5 16 10"/><path d="M12 13h4m16 0h4M12 35h4m16 0h4"/>',
    '<rect x="8" y="12" width="32" height="25" rx="4"/><path d="M16 12V8h16v4m-17 0v-4m18 4v-4M13 20h5m-2.5-2.5v5"/><path d="m27 18-6 9h6l-2 8 8-12h-6l2-5Z"/>',
    '<circle cx="24" cy="24" r="17"/><circle cx="24" cy="24" r="11"/><circle cx="24" cy="24" r="4"/><path d="M24 7v6m17 11h-6M24 41v-6M7 24h6M12 12l4 4m20-4-4 4m0 16 4 4m-24 0 4-4"/>',
    '<path d="M24 5c6 9 13 17 13 25a13 13 0 0 1-26 0C11 22 18 14 24 5Z"/><path d="M18 30a7 7 0 0 0 7 7m3-20 5 5"/>',
    '<path d="M7 24h5l4-7h14l5 6h5v13H7z"/><path d="M16 17v-6h15v6m-11-3h7M12 24h24M17 36v4h14v-4"/><circle cx="20" cy="29" r="2.5"/><circle cx="30" cy="29" r="2.5"/>',
    '<path d="M14 8h20l4 9v16H10V17l4-9Z"/><circle cx="24" cy="25" r="8"/><circle cx="24" cy="25" r="3"/><path d="M18 10v4m12-4v4M10 19H6m32 0h-4m-17 12-3 3m20-3 3 3"/>',
    '<path d="M5 28 9 17c1-3 4-5 8-5h13c4 0 7 2 9 6l4 10v8H5z"/><path d="m12 18 4-5h15l5 6M10 28h28M17 12V8h13v4"/><circle cx="13" cy="36" r="3.5"/><circle cx="35" cy="36" r="3.5"/><path d="M20 23h8"/>'
  ];
  document.querySelectorAll('.service-title-row .service-icon svg').forEach((svg, i) => {
    svg.setAttribute('viewBox', '0 0 48 48'); svg.innerHTML = serviceArt[i] || serviceArt[0];
  });

  const whyArt = [
    '<path d="M5 7h30v21H18l-8 6v-6H5z"/><path d="M12 15h15m-15 6h9"/><path d="M35 18h8v17h-8"/><path d="M38 23h2m-2 5h2"/>',
    '<circle cx="21" cy="21" r="13"/><path d="m31 31 10 10"/><path d="M15 21h12m-6-6v12"/><circle cx="21" cy="21" r="6"/>',
    '<path d="M4 27 8 17c1-3 4-5 7-5h12c4 0 7 2 9 5l4 10v8H4z"/><path d="m11 17 3-4h14l4 5M8 27h32"/><circle cx="12" cy="35" r="3"/><circle cx="34" cy="35" r="3"/>',
    '<path d="M7 39V13l17-8 17 8v26"/><path d="M16 39V26h16v13M15 17h.1m9 0h.1m9 0h.1"/><path d="M20 32h8"/>',
    '<path d="M7 10h30v22H7z"/><path d="m8 12 14 11 14-11M17 37h14m-7-5v5"/><circle cx="38" cy="36" r="5"/>',
    '<path d="M37 18c0 11-13 23-13 23S11 29 11 18a13 13 0 1 1 26 0Z"/><circle cx="24" cy="18" r="4"/><path d="M5 39h10m18 0h10"/>'
  ];
  document.querySelectorAll('.why-card>svg').forEach((svg, i) => {
    svg.setAttribute('viewBox', '0 0 48 48'); svg.innerHTML = whyArt[i] || whyArt[0];
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
