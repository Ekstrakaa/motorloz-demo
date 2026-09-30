(() => {
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const actions = [...document.querySelectorAll(
    '.hero .button, .reference-bridge-card .button, .diagnostic-story-copy .button, ' +
    '.contact-bridge-actions .button, #appointment-form .button.primary'
  )];
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      if (!entry.target.animate) continue;
      entry.target.animate([
        { opacity: .45, transform: 'translateY(12px)', filter: 'brightness(.7)' },
        { opacity: 1, transform: 'translateY(0)', filter: 'brightness(1)' }
      ], { duration: 830, delay: 110, easing: 'cubic-bezier(.2,.75,.2,1)' });
    }
  }, { threshold: .35, rootMargin: '0px 0px -8% 0px' });
  actions.forEach(action => observer.observe(action));
})();
