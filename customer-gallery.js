'use strict';
(() => {
  const reviews = document.querySelector('#review-carousel');
  if (!reviews || document.querySelector('.customer-gallery')) return;

  const photos = [
    ['cliente-auto-01.webp', 'Todoterreno negro dentro del taller MOTORLOZ'],
    ['cliente-auto-02.webp', 'Subaru azul estacionado frente a su casa'],
    ['cliente-auto-03.webp', 'Subaru blanco dentro del taller'],
    ['cliente-auto-04.webp', 'Subaru deportivo rojo en el taller'],
    ['cliente-auto-05.webp', 'Todoterreno rojo durante una visita al taller'],
    ['cliente-auto-06.webp', 'Subaru azul con el capó abierto para revisión'],
    ['cliente-auto-07.webp', 'BMW blanco dentro del taller MOTORLOZ'],
    ['cliente-auto-08.webp', 'Subaru clásico color plata en el taller'],
    ['cliente-auto-09.webp', 'SUV blanco en el taller MOTORLOZ']
  ];

  const gallery = document.createElement('section');
  gallery.className = 'customer-gallery';
  gallery.setAttribute('aria-labelledby', 'customer-gallery-title');

  const heading = document.createElement('div');
  heading.className = 'customer-gallery-heading';
  const titleGroup = document.createElement('div');
  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = 'CLIENTES · AUTOS REALES';
  const title = document.createElement('h3');
  title.id = 'customer-gallery-title';
  title.textContent = 'Historias que llegan sobre ruedas.';
  titleGroup.append(eyebrow, title);
  const description = document.createElement('p');
  description.textContent = 'Una muestra de los vehículos que pasan por MOTORLOZ.';
  const toggle = document.createElement('button');
  toggle.className = 'customer-gallery-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-pressed', 'false');
  toggle.textContent = 'Pausar movimiento';
  heading.append(titleGroup, description, toggle);
  gallery.append(heading);

  function buildLane(items, direction, label) {
    const lane = document.createElement('div');
    lane.className = `customer-gallery-lane ${direction}`;
    lane.setAttribute('role', 'group');
    lane.setAttribute('aria-label', label);
    const track = document.createElement('div');
    track.className = 'customer-gallery-track';

    for (let copy = 0; copy < 2; copy += 1) {
      const group = document.createElement('div');
      group.className = 'customer-gallery-group';
      if (copy) {
        group.setAttribute('aria-hidden', 'true');
        group.inert = true;
      }
      items.forEach(([file, alt]) => {
        const figure = document.createElement('figure');
        figure.className = 'customer-gallery-photo';
        const image = document.createElement('img');
        image.src = `assets/${file}`;
        image.alt = copy ? '' : alt;
        image.width = 900;
        image.height = 900;
        image.loading = 'lazy';
        image.decoding = 'async';
        figure.append(image);
        group.append(figure);
      });
      track.append(group);
    }
    lane.append(track);
    return lane;
  }

  gallery.append(
    buildLane(photos.slice(0, 5), 'customer-gallery-forward', 'Primera fila de fotos de autos'),
    buildLane(photos.slice(5), 'customer-gallery-reverse', 'Segunda fila de fotos de autos')
  );
  reviews.insertAdjacentElement('afterend', gallery);

  toggle.addEventListener('click', () => {
    const paused = gallery.classList.toggle('is-paused');
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.textContent = paused ? 'Reanudar movimiento' : 'Pausar movimiento';
  });
})();
