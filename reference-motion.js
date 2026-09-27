'use strict';
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const targets = document.querySelectorAll([
    '.intro-feature-copy', '.intro-proof-row article',
    '.subaru-section .japan-heading', '.subaru-section .subaru-photo',
    '.hyundai-image', '.hyundai-copy',
    '.diagnostic-story-copy', '.diagnostic-tile',
    '.film-card', '.service-card',
    '.people-text', '.team-story', '.why-grid article',
    '.reviews-heading', '.google-place-card', '.google-review-card',
    '.contact-bridge > *', '.appointment-intro', '.appointment-office',
    '#appointment-form', '.location-top > *', '.map-panel', '.arrival-photos'
  ].join(','));
  if (!targets.length) return;
  targets.forEach((target, index) => {
    target.classList.add('scroll-reveal');
    target.style.setProperty('--reveal-delay', `${(index % 3) * 75}ms`);
  });
  document.documentElement.classList.add('motion-ready');
  if (reduced.matches || !('IntersectionObserver' in window)) {
    targets.forEach(target => target.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-visible');
    observer.unobserve(entry.target);
  }), { threshold: .12, rootMargin: '0px 0px -36px 0px' });
  targets.forEach(target => observer.observe(target));
})();
