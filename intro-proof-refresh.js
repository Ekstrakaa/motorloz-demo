(() => {
  const row = document.querySelector('#taller .intro-proof-row');
  if (!row) return;
  const links = [...row.querySelectorAll('.intro-proof-link')];
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  row.classList.add('proof-motion-ready');
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      links.forEach((link, index) => setTimeout(() => link.classList.add('is-visible'), index * 110));
      observer.disconnect();
    }
  }, { threshold: .2 });
  observer.observe(row);
})();
