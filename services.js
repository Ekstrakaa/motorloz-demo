'use strict';
(() => {
  const viewport = document.querySelector('.services-viewport');
  const track = document.querySelector('#services-track');
  const currentLabel = document.querySelector('#service-current');
  const dots = [...document.querySelectorAll('#services-pagination button')];
  if (!viewport || !track) return;
  const cards = [...track.querySelectorAll('.service-card')];
  const premiumChecklistIcons = [
    [
      '<path d="M3 9h3l2-3h9l2 3h2v9h-3l-2 2H8l-2-2H3z"/><path class="service-icon-accent" d="M8 6V3m8 3V3M8 12h8m-6 4h4"/>',
      '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path class="service-icon-accent" d="M3 7h4v10H3m14-8h4v6h-4"/>',
      '<path d="M3 5h18v14H3zM6 16h3m6 0h3"/><path class="service-icon-accent" d="M5 12h3l2-4 3 8 2-4h4"/>'
    ],
    [
      '<circle cx="7" cy="15" r="4"/><circle cx="17" cy="15" r="4"/><path d="M3 7h18M12 4v7"/><path class="service-icon-accent" d="m9 6 3-3 3 3m-6 11 3 3 3-3"/>',
      '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path class="service-icon-accent" d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
      '<path d="M5 4h10v15H5zM8 7v9m3-9v9"/><circle cx="17" cy="15" r="4"/><path class="service-icon-accent" d="m20 18 2 2"/>'
    ],
    [
      '<path d="M10 3v2L7 7l10 3-10 3 10 3-7 3v2m4-2v2"/><path class="service-icon-accent" d="M5 3h14M5 21h14"/>',
      '<circle cx="12" cy="7" r="4"/><circle cx="12" cy="7" r="1.5"/><path d="M12 11v5m-5 5 2-5h6l2 5"/><path class="service-icon-accent" d="M6 19h12"/>',
      '<path d="M4 5h12v14H4zM7 9h6m-6 4h4"/><circle cx="17" cy="16" r="4"/><path class="service-icon-accent" d="m20 19 2 2"/>'
    ],
    [
      '<rect x="4" y="7" width="16" height="12" rx="2"/><path d="M8 5V3m8 2V3"/><path class="service-icon-accent" d="m13 9-3 5h3l-2 4 5-6h-3l1-3"/>',
      '<path d="M5 9h8v10H5zM8 6h2m7 5a4 4 0 0 1 0 8"/><path class="service-icon-accent" d="M17 4v2m4 2-2 1m3 4h-2"/>',
      '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8M8 15h3"/><path class="service-icon-accent" d="M13 14h5m-2.5-2.5v5"/>'
    ],
    [
      '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v6m0 6v6M3 12h6m6 0h6"/><path class="service-icon-accent" d="m5.5 5.5 2 2m9 9 2 2"/>',
      '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path class="service-icon-accent" d="M5 7a9 9 0 0 1 14 0m0 10a9 9 0 0 1-14 0m13-10 2 1-1-3M6 17l-2-1 1 3"/>',
      '<circle cx="9" cy="12" r="6"/><path d="M7 8v8m4-8v8"/><path class="service-icon-accent" d="m13.5 16.5 6 5M15 4h6m-3-3v6"/>'
    ],
    [
      '<path d="M4 5h16v14H4zM8 3v4m8-4v4M4 10h16"/><path class="service-icon-accent" d="m8 15 2 2 5-5"/>',
      '<path d="M4 12h3l2-5h6l2 5h3v6H4z"/><circle cx="8" cy="18" r="1"/><circle cx="16" cy="18" r="1"/><path class="service-icon-accent" d="m12 2-2 4h2l-1 3 4-5h-2l1-2"/>',
      '<path d="M12 3 5 6v6c0 4.5 3 7.2 7 9 4-1.8 7-4.5 7-9V6z"/><path class="service-icon-accent" d="m8 12 3 3 5-6"/>'
    ],
    [
      '<path d="M4 9h3l2-4h7l2 4h3v9h-3l-2 2H8l-2-2H4z"/><path class="service-icon-accent" d="M9 13h6m-3-3v6"/>',
      '<circle cx="8" cy="12" r="5"/><circle cx="8" cy="12" r="2"/><path d="M13 8h7v8h-7m-1-4h8"/><path class="service-icon-accent" d="M17 5v3m0 8v3"/>',
      '<path d="M5 4h14v16H5zM8 8h8m-8 4h5"/><path class="service-icon-accent" d="m8 16 2 2 5-5"/>'
    ],
    [
      '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path class="service-icon-accent" d="M3 8h4v8H3m14-7h4v6h-4"/>',
      '<path d="M5 5h14v14H5zM8 9h8m-8 4h8m-8 4h5"/><path class="service-icon-accent" d="m16 16 2 2 3-4"/>',
      '<path d="M4 6h16v13H4zM7 10h10m-10 4h6"/><path class="service-icon-accent" d="M17 14h4m-2-2v4"/>'
    ],
    [
      '<path d="m3 14 3-6h12l3 6v5H3zM8 8l2-3h4l2 3"/><circle cx="8" cy="19" r="1"/><circle cx="17" cy="19" r="1"/><path class="service-icon-accent" d="M5 14h14"/>',
      '<path d="m2 15 2-5h6l2 5v4H2zm10 0 2-5h6l2 5v4H12z"/><path class="service-icon-accent" d="M5 10V7h14v3"/>',
      '<path d="M4 7h16v13H4zM7 7V4h10v3m-9 5h8"/><path class="service-icon-accent" d="m10 16 2 2 4-5"/>'
    ]
  ];
  cards.forEach((card, index) => {
    card.querySelectorAll('.service-card-copy > ul > li').forEach((item, itemIndex) => {
      const paths = premiumChecklistIcons[index]?.[itemIndex];
      if (!paths || item.querySelector('.service-check-icon')) return;
      const label = item.textContent.trim();
      const icon = document.createElement('span');
      icon.className = 'service-check-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
      item.replaceChildren(icon, document.createTextNode(label));
    });
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
