(() => {
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const actions = [...document.querySelectorAll(
    '.hero .button, .reference-bridge-card .button, .diagnostic-story-copy .button, ' +
    '.contact-bridge-actions .button, #appointment-form .button.primary, ' +
    '.service-card a[data-service], .films-social a, .location-directions'
  )];
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      if (!entry.target.animate) continue;
      entry.target.animate([
        { opacity: .45, transform: 'translateY(12px)', filter: 'brightness(.7)' },
        { opacity: 1, transform: 'translateY(0)', filter: 'brightness(1)' }
      ], { duration: 1180, delay: 130, easing: 'cubic-bezier(.18,.72,.2,1)' });
    }
  }, { threshold: .35, rootMargin: '0px 0px -8% 0px' });
  actions.forEach(action => observer.observe(action));
})();
