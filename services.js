'use strict';
(() => {
  const viewport = document.querySelector('.services-viewport');
  const track = document.querySelector('#services-track');
  const currentLabel = document.querySelector('#service-current');
  const dots = [...document.querySelectorAll('#services-pagination button')];
  if (!viewport || !track) return;
  const cards = [...track.querySelectorAll('.service-card')];
  const serviceIcons = [
    '<svg viewBox="0 0 24 24"><path d="M21 6.5a6 6 0 0 1-7.9 5.7L7 18.3a2.1 2.1 0 1 1-3-3l6.1-6.1A6 6 0 0 1 16 2l-3.1 3.1 3 3L19 5Z"/></svg>',
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.2"/><path d="m12 3.5 1.5 5.4m7 1.3-5.3 1.8m-2.6 8.5-1.2-5.5m-7.6-2 5.2-1.5m5.4-4.7 1.3-1.2"/></svg>',
    '<svg viewBox="0 0 24 24"><path d="M8 3v3m8-3v3M8 18v3m8-3v3M8 6c0 3 8 3 8 6s-8 3-8 6"/><path d="M6 6h12M6 18h12"/></svg>',
    '<svg viewBox="0 0 24 24"><path d="M13.5 2.8 5.8 13h5l-.5 8.2 7.9-10.5h-5.1l.4-7.9Z"/><path d="M4 5h3M17 19h3"/></svg>',
    '<svg viewBox="0 0 24 24"><path d="M9 3.5a8.5 8.5 0 1 0 0 17A8.5 8.5 0 0 0 9 3.5Z"/><circle cx="9" cy="12" r="3.2"/><path d="M16.3 6.4c1.6.8 2.7 2.4 2.7 4.3v2.6m-2.3 3.4 2.3 1.3 2.3-1.3"/></svg>',
    '<svg viewBox="0 0 24 24"><path d="M12 3.5c2.2 3.1 5.4 6.7 5.4 10.2a5.4 5.4 0 1 1-10.8 0C6.6 10.2 9.8 6.6 12 3.5Z"/><path d="M9.5 14.5a2.6 2.6 0 0 0 2.6 2.6"/></svg>'
  ];
  cards.forEach((card, index) => {
    const title = card.querySelector('.service-card-copy h3');
    if (!title || card.querySelector('.service-title-row')) return;
    const row = document.createElement('div');
    row.className = 'service-title-row';
    const icon = document.createElement('span');
    icon.className = 'service-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = serviceIcons[index] || serviceIcons[0];
    title.parentNode.insertBefore(row, title);
    row.append(icon, title);
  });
  let current = 0;
  let scrollFrame = 0;

  function stepSize() {
    const first = cards[0];
    if (!first) return viewport.clientWidth;
    const next = cards[1];
    return next ? next.offsetLeft - first.offsetLeft : first.getBoundingClientRect().width;
  }

  function goTo(index) {
    current = (index + cards.length) % cards.length;
    const card = cards[current];
    viewport.scrollTo({ left: card.offsetLeft, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    update();
  }

  function update() {
    if (currentLabel) currentLabel.textContent = String(current + 1).padStart(2, '0');
    dots.forEach((dot, index) => {
      if (index === current) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
  }

  document.querySelector('[data-services-prev]')?.addEventListener('click', () => goTo(current - 1));
  document.querySelector('[data-services-next]')?.addEventListener('click', () => goTo(current + 1));
  dots.forEach((dot, index) => dot.addEventListener('click', () => goTo(index)));

  viewport.addEventListener('scroll', () => {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(() => {
      const stride = stepSize();
      if (stride) {
        current = Math.max(0, Math.min(cards.length - 1, Math.round(viewport.scrollLeft / stride)));
        update();
      }
    });
  }, { passive: true });

  viewport.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight') { event.preventDefault(); goTo(current + 1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(current - 1); }
  });
  update();
})();
