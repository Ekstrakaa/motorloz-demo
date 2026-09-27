'use strict';
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const principles = [...document.querySelectorAll('.why-grid article')];
  const subaruPhotos = [...document.querySelectorAll('.subaru-photo')];
  const targets = [...principles, ...subaruPhotos];
  if (!targets.length) return;
  subaruPhotos.forEach(photo => photo.classList.add('motion-ready'));

  if (reduced.matches || !('IntersectionObserver' in window)) {
    targets.forEach(target => target.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-visible');
    observer.unobserve(entry.target);
  }), { threshold: .12, rootMargin: '0px 0px -5% 0px' });
  targets.forEach(target => observer.observe(target));
})();
