(() => {
  const row = document.querySelector('#taller .intro-proof-row');
  if (!row) return;
  const links = [...row.querySelectorAll('.intro-proof-link')];
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  row.classList.add('proof-motion-ready');
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const index = links.indexOf(entry.target);
      setTimeout(() => entry.target.classList.add('is-visible'), index * 90);
      observer.unobserve(entry.target);
    }
  }, { threshold: .25 });
  links.forEach(link => observer.observe(link));
})();
