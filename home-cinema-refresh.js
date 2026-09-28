(() => {
  const hero = document.querySelector('.hero');
  const phrases = [...document.querySelectorAll('.hero-phrase')];
  if (!hero || phrases.length < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let active = 0;
  let timer = 0;
  let visible = true;
  const advance = () => {
    phrases[active].classList.remove('is-active');
    active = (active + 1) % phrases.length;
    phrases[active].classList.add('is-active');
    schedule();
  };
  const schedule = () => {
    clearTimeout(timer);
    if (visible && !document.hidden) timer = setTimeout(advance, active === 0 ? 5200 : 4600);
  };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      schedule();
    }, { threshold: .15 }).observe(hero);
  }
  document.addEventListener('visibilitychange', schedule);
  schedule();
})();
