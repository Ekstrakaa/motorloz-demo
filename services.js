'use strict';
(() => {
  const viewport = document.querySelector('.services-viewport');
  const track = document.querySelector('#services-track');
  const currentLabel = document.querySelector('#service-current');
  const dots = [...document.querySelectorAll('#services-pagination button')];
  if (!viewport || !track) return;
  const cards = [...track.querySelectorAll('.service-card')];
  cards.forEach((card, index) => {
    const serviceId = card.querySelector('.service-card-copy > span');
    const serviceMatch = serviceId?.textContent.trim().match(/^(\d+)\s*\/\s*(.+)$/);
    if (serviceId && serviceMatch && !serviceId.querySelector('.service-index')) {
      const originalLabel = serviceId.textContent.trim();
      serviceId.setAttribute('aria-label', originalLabel);
      const number = document.createElement('b');
      number.className = 'service-index';
      number.textContent = serviceMatch[1];
      const slash = document.createElement('i');
      slash.textContent = '/';
      const category = document.createElement('strong');
      category.textContent = serviceMatch[2];
      serviceId.replaceChildren(number, slash, category);
    }
    if (!card.querySelector('.service-photo-meta')) {
      const photoMeta = document.createElement('div');
      photoMeta.className = 'service-photo-meta';
      photoMeta.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.textContent = 'SERVICIOS';
      const number = document.createElement('b');
      number.textContent = String(index + 1).padStart(2, '0');
      photoMeta.append(label, number);
      card.append(photoMeta);
    }
    const title = card.querySelector('.service-card-copy h3');
    if (!title || card.querySelector('.service-title-row')) return;
    const row = document.createElement('div');
    row.className = 'service-title-row';
    const icon = document.createElement('span');
    icon.className = 'service-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.dataset.iconIndex = String(index);
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
