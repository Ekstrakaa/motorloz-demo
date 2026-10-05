'use strict';
(() => {
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const candidates = [...document.querySelectorAll('main figure,main .film-card,main .service-card,main .hyundai-image,main .arrival-photos,main .intro-feature-image,main .diagnostic-feature-carousel,main .slide-stage')];
  const targets = candidates.filter(node =>
    !node.matches('.engine-sketch') &&
    !node.closest('.hero') &&
    !node.closest('.workshop-photo-rail,.hyundai-photo-rail') &&
    (node.querySelector('img,video') || node.matches('img,video')) &&
    !candidates.some(other => other !== node && other.contains(node))
  );
  targets.forEach(node => node.classList.add('experience-reveal'));
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-experience-visible');
    observer.unobserve(entry.target);
  }), { threshold:.08, rootMargin:'0px 0px -4% 0px' });
  targets.forEach(node => observer.observe(node));
})();
