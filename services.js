'use strict';
(() => {
  const viewport = document.querySelector('.services-viewport');
  const track = document.querySelector('#services-track');
  const currentLabel = document.querySelector('#service-current');
  const dots = [...document.querySelectorAll('#services-pagination button')];
  if (!viewport || !track) return;
  const cards = [...track.querySelectorAll('.service-card')];
  const checklistIcons = [
    [
      ['<path d="M4 7h4l2-3h4l2 3h4v12H4z"/><circle cx="12" cy="13" r="3"/>', '<path d="M5 12h3l2-3 4 6 2-3h3"/>', '<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z"/><path d="m9 12 2 2 4-4"/>'],
      ['<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M12 4v2M4 12h2m12 0h2"/>', '<circle cx="12" cy="12" r="8"/><path d="m12 8 4 4-4 4-4-4z"/>', '<circle cx="12" cy="12" r="8"/><path d="m8 12 2.5 2.5L16 9"/>'],
      ['<path d="M4 6h16v12H4z"/><path d="M7 9h10M7 12h7M7 15h4"/>', '<path d="M3 12h4l2-4 4 8 3-6 2 2h3"/>', '<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z"/><path d="M12 8v5m0 3h.01"/>']
    ],
    [
      ['<circle cx="12" cy="12" r="8"/><path d="M12 4v8l5 3"/>', '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/><path d="M4 12H2m20 0h-2"/>', '<circle cx="12" cy="12" r="7"/><path d="M12 5v7l4 2"/><path d="m5 5-2-2m16 0-2 2"/>'],
      ['<circle cx="12" cy="12" r="8"/><path d="M12 4v8l-5 3"/>', '<path d="M4 8h16M6 8l1 11h10l1-11"/><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/>', '<path d="m4 15 4-4 3 2 5-6 4 3"/><path d="M4 19h16"/>'],
      ['<circle cx="12" cy="12" r="8"/><path d="m8 12 3 3 5-6"/>', '<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z"/><path d="m9 12 2 2 4-4"/>', '<circle cx="12" cy="12" r="8"/><path d="M8 12h8M12 8v8"/>']
    ],
    [
      ['<path d="M12 2v3m0 14v3M2 12h3m14 0h3"/><path d="m7 7 2 2m6 6 2 2m0-10-2 2m-6 6-2 2"/><circle cx="12" cy="12" r="4"/>', '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v2m0 16v2"/>', '<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h5M8 16h7"/>'],
      ['<circle cx="12" cy="12" r="8"/><path d="m8 12 3 3 5-6"/>', '<path d="m12 3 2 6 6 3-6 2-2 7-2-7-6-2 6-3z"/>', '<path d="M4 12h3l2-4 4 8 3-4h4"/>'],
      ['<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z"/><path d="m9 12 2 2 4-4"/>', '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>', '<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z"/><path d="M9 12h6"/>']
    ],
    [
      ['<path d="M6 7h12v13H6z"/><path d="M8 7V4h8v3M9 11h6m-6 4h6"/>', '<path d="M5 9h14l2 10H3z"/><circle cx="8" cy="15" r="1"/><circle cx="16" cy="15" r="1"/>', '<path d="M4 8h16v11H4z"/><path d="M7 12h10M7 15h6"/>'],
      ['<circle cx="12" cy="12" r="8"/><path d="M12 4v8l5 3"/><path d="m5 5-2-2"/>', '<path d="M4 12h4l2-5 4 10 2-5h4"/>', '<circle cx="12" cy="12" r="8"/><path d="m8 12 3 3 5-6"/>'],
      ['<circle cx="12" cy="12" r="8"/><path d="M12 8v8m-4-4h8"/>', '<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z"/><path d="m9 12 2 2 4-4"/>', '<path d="m12 3 2 6 6 3-6 2-2 7-2-7-6-2 6-3z"/>']
    ],
    [
      ['<path d="M4 6h16v12H4z"/><path d="M8 6V4h8v2M8 10h8M8 14h5"/>', '<path d="M12 3v3m0 12v3M3 12h3m12 0h3"/><circle cx="12" cy="12" r="5"/>', '<path d="M5 5h14v14H5z"/><path d="M8 9h8m-8 3h8m-8 3h5"/>'],
      ['<path d="M4 12a8 8 0 0 1 16 0v5h-5v-5h5M4 12v5h5v-5z"/>', '<path d="M5 18 19 6M7 6l11 12"/><circle cx="12" cy="12" r="9"/>', '<path d="m5 12 4 4L19 6"/><circle cx="12" cy="12" r="10"/>'],
      ['<path d="M4 12h4l2-6 4 12 2-6h4"/>', '<circle cx="12" cy="12" r="9"/><path d="M8 12h8M12 8v8"/>', '<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z"/><path d="M12 8v5m0 3h.01"/>']
    ],
    [
      ['<path d="M4 5h16v15H4z"/><path d="M8 3v4m8-4v4M4 10h16"/>', '<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z"/><path d="M9 12h6"/>', '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>'],
      ['<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z"/><path d="m9 12 2 2 4-4"/>', '<path d="M4 12h4l2-5 4 10 2-5h4"/>', '<path d="M5 5h14v14H5z"/><path d="M8 9h8m-8 3h8m-8 3h5"/>'],
      ['<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/><path d="M8 3h8"/>', '<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z"/><path d="M12 8v5m0 3h.01"/>', '<path d="M4 7h16v13H4z"/><path d="m8 13 3 3 5-6"/>']
    ],
    [
      ['<path d="M4 6h16v12H4z"/><path d="M7 9h4v6H7zm7 0h3m-3 3h3m-3 3h2"/>', '<path d="M5 5h14v14H5z"/><path d="m8 12 2 2 6-6"/>', '<path d="M4 12h4l2-5 4 10 2-5h4"/>'],
      ['<path d="M6 4h12v16H6z"/><path d="M9 8h6v8H9z"/><circle cx="12" cy="12" r="1"/>', '<path d="M5 7h14v10H5z"/><path d="m8 14 2-3 2 2 2-4 2 5"/>', '<circle cx="12" cy="12" r="8"/><path d="m8 12 3 3 5-6"/>'],
      ['<path d="M4 12h4l2-5 4 10 2-5h4"/><circle cx="12" cy="12" r="10"/>', '<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z"/><path d="M9 12h6"/>', '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>']
    ],
    [
      ['<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="6" r=".7"/><circle cx="17" cy="12" r=".7"/><circle cx="12" cy="18" r=".7"/><circle cx="7" cy="12" r=".7"/>', '<path d="M5 8h6l2 2v7H5z"/><path d="M13 11h5l2 3v5h-7z"/><circle cx="8" cy="19" r="1"/><circle cx="17" cy="19" r="1"/>', '<circle cx="12" cy="12" r="9"/><path d="M8 15V9h2.5a1.5 1.5 0 0 1 0 3H8m5 3V9h2.5a1.5 1.5 0 0 1 0 3H13"/>'],
      ['<path d="M5 6h7l2 3v8H5z"/><path d="M14 10h5l2 3v4h-7z"/><path d="M7 9h3m6 4h3"/>', '<circle cx="12" cy="12" r="8"/><path d="m8 12 3 3 5-6"/>', '<path d="M4 12h4l2-5 4 10 2-5h4"/>'],
      ['<circle cx="12" cy="12" r="9"/><path d="M7 15V9h2.5a1.5 1.5 0 0 1 0 3H7m5 3V9h2.5a1.5 1.5 0 0 1 0 3H12m5 3V9h3"/>', '<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z"/><path d="m9 12 2 2 4-4"/>', '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>']
    ],
    [
      ['<path d="m3 12 3-6h12l3 6v6H3z"/><circle cx="8" cy="15" r="2"/><circle cx="16" cy="15" r="2"/>', '<path d="M4 6h16v12H4z"/><path d="M8 9h8m-8 3h5"/>', '<path d="M5 5h14v14H5z"/><path d="m8 12 2 2 5-5"/>'],
      ['<path d="M12 3v18M8 6l8 12M16 6 8 18"/><circle cx="12" cy="12" r="3"/>', '<path d="m7 3 10 18M17 3 7 21"/><circle cx="12" cy="12" r="3"/>', '<path d="M4 12h16M12 4v16"/><circle cx="12" cy="12" r="7"/>'],
      ['<circle cx="10" cy="10" r="6"/><path d="m14.5 14.5 6 6"/><path d="M7 10h6"/>', '<path d="M4 5h16v14H4z"/><path d="M8 9h8m-8 4h5"/>', '<path d="M4 12h4l2-5 4 10 2-5h4"/>']
    ]
  ];
  const iconOverrides = {
    '2-2': '<path d="M12 3v18m-3-15 6 3-6 3 6 3-6 3"/>',
    '5-1': '<path d="M5 7h14v13H5z"/><path d="M8 7V4h8v3m-7 4h6m-6 3h6"/><path d="m9 17 2 2 4-4"/>',
    '7-2': '<path d="M4 5h16v14H4z"/><circle cx="12" cy="12" r="3"/><path d="M2 12s3-6 10-6 10 6 10 6-3 6-10 6-10-6-10-6z"/>'
  };
  cards.forEach((card, index) => {
    card.querySelectorAll('.service-card-copy > ul > li').forEach((item, itemIndex) => {
      const alternatives = checklistIcons[index]?.[itemIndex];
      const paths = iconOverrides[`${index}-${itemIndex}`] || alternatives?.[(index * 2 + itemIndex) % (alternatives?.length || 1)];
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
