'use strict';
(() => {
  const viewport = document.querySelector('.services-viewport');
  const track = document.querySelector('#services-track');
  const currentLabel = document.querySelector('#service-current');
  const dots = [...document.querySelectorAll('#services-pagination button')];
  if (!viewport || !track) return;
  const cards = [...track.querySelectorAll('.service-card')];
  const serviceIcons = [
    '<svg viewBox="0 0 48 48"><path d="M31 9a11 11 0 0 0-13 13L8 32a5 5 0 0 0 7 7l10-10a11 11 0 0 0 13-13l-7 7-7-7Z"/><path d="m13 32 3 3"/></svg>',
    '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="17"/><circle cx="24" cy="24" r="10"/><circle cx="24" cy="24" r="3"/><path d="M24 7v5m17 12h-5M24 41v-5M7 24h5M12 12l4 4m20-4-4 4m0 16 4 4m-24 0 4-4"/></svg>',
    '<svg viewBox="0 0 48 48"><path d="M16 6v7m16-7v7M16 35v7m16-7v7M13 13h22v22H13z"/><path d="m16 17 16 14m0-14L16 31"/><circle cx="24" cy="24" r="5"/></svg>',
    '<svg viewBox="0 0 48 48"><rect x="8" y="12" width="32" height="25" rx="4"/><path d="M24 7v5m-9 0V9h18v3M12 20h4m-2-2v4"/><path d="m27 17-7 11h6l-2 8 9-13h-6l2-6Z"/></svg>',
    '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="17"/><circle cx="24" cy="24" r="12"/><circle cx="24" cy="24" r="5"/><path d="M24 12v7m12 5h-7m-5 12v-7m-12-5h7m9-9-4 6m12 6-7-1m-5 12 1-7m-12-5 7-1m10-1-5-5m-5 10-5 5"/></svg>',
    '<svg viewBox="0 0 48 48"><path d="M25 6c8 11 14 18 14 25a15 15 0 0 1-30 0C9 24 17 15 25 6Z"/><path d="M17 31a8 8 0 0 0 8 7"/><path d="M33 11h7v10"/></svg>',
    '<svg viewBox="0 0 48 48"><path d="M7 21h6l4-6h13l4 5h7v15h-5v5H13v-5H7z"/><path d="M18 15V9h11v6m-8-3h5M11 21v-5m24 5v-5m-16 8h7m-7 5h7"/><circle cx="19" cy="29" r="3.5"/><circle cx="31" cy="29" r="3.5"/><path d="M4 25H7m34 0h3"/></svg>',
    '<svg viewBox="0 0 48 48"><path d="M8 23h4l3-9h18l5 9h4v13H8z"/><path d="m15 14 4-6h11l5 6M16 27h16m-11-5v10m6-10v10"/><circle cx="14" cy="36" r="3"/><circle cx="34" cy="36" r="3"/></svg>',
    '<svg viewBox="0 0 48 48"><circle cx="21" cy="24" r="15"/><circle cx="21" cy="24" r="10"/><circle cx="21" cy="24" r="2.5"/><path d="M36 14h6v20h-6l-4-4V18zM11 9 7 5m0 38 4-4"/><path d="M18 15v5m6-5v5m-6 8v5m6-5v5"/></svg>',
    '<svg viewBox="0 0 48 48"><path d="M5 29 9 18c1-3 4-5 7-5h14c4 0 7 2 9 6l4 10v7H5z"/><path d="m11 20 3-5h18l5 6M13 29h22m-16-8v5m10-5v5"/><circle cx="13" cy="36" r="4"/><circle cx="35" cy="36" r="4"/></svg>'
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
