'use strict';
(() => {
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Copy arrives in a short sequence after the image, without moving the layout.
  const groups = [
    ['.brand-experience-head,.brand-experience-note', 'line'],
    ['main .section-label', 'line'],
    ['.intro-feature-copy > .eyebrow,.intro-feature-copy > h2,.intro-feature-copy > p', 'copy'],
    ['.japan-heading > .eyebrow,.japan-heading > .japan-brand-pair,.japan-heading > h2,.japan-heading > p,.japan-heading > .japan-note', 'copy'],
    ['.reference-bridge-card > .eyebrow,.reference-bridge-card > h2,.reference-bridge-card > p', 'copy'],
    ['.diagnostic-story-copy > .eyebrow,.diagnostic-story-copy > h2,.diagnostic-story-copy > p,.diagnostic-story-note', 'copy'],
    ['.films-heading > h2,.films-heading > p,.film-caption > small,.film-caption > strong,.film-caption > a,.films-social', 'copy'],
    ['.services-intro > div,.services-intro > p,.service-card-copy > span,.service-card-copy > p,.service-card-copy > ul', 'copy'],
    ['.people-text > .eyebrow,.people-text > h2,.people-text > p', 'copy'],
    ['.why-motorloz > .eyebrow,.why-motorloz > h2,.why-motorloz > .why-subtitle', 'copy'],
    ['.reviews-heading > .eyebrow,.reviews-heading > h2,.reviews-heading > p', 'copy'],
    ['.contact-bridge-card > .eyebrow,.contact-bridge-card > h2,.contact-bridge-card > p', 'copy'],
    ['.appointment-intro > .eyebrow,.appointment-intro > h2,.appointment-intro > p,.appointment-steps li', 'copy'],
    ['.location-top > h2,.location-top > div,footer > .footer-brand,footer .footer-links > a,footer > .footer-policies,footer > .footer-bottom', 'copy']
  ];
  const targets = new Map();
  for (const [selector, variant] of groups) {
    document.querySelectorAll(selector).forEach(node => {
      if (!targets.has(node) && !node.matches('.scroll-entry,.scroll-reveal,.experience-reveal')) targets.set(node, variant);
    });
  }

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-story-visible');
      observer.unobserve(entry.target);
    }
  }, { threshold: .06, rootMargin: '0px 0px -7% 0px' });

  const positions = new Map();
  for (const [node, variant] of targets) {
    const section = node.closest('section,footer') || document.body;
    const index = positions.get(section) || 0;
    positions.set(section, index + 1);
    node.classList.add('story-entry', `story-entry-${variant}`);
    node.style.setProperty('--story-delay', `${Math.min(index % 5, 4) * 95}ms`);
    const rect = node.getBoundingClientRect();
    if (rect.top < innerHeight * .82 && rect.bottom > 0) node.classList.add('is-story-visible');
    else observer.observe(node);
  }
})();
