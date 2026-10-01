(() => {
  const form = document.querySelector('#appointment-form');
  if (!form) return;

  const progress = form.querySelector('.form-progress');
  const groups = [
    {
      kicker: 'Datos personales',
      icon: '<circle cx="12" cy="8" r="3.2"/><path d="M5.5 20v-1.6a6.5 6.5 0 0 1 13 0V20"/>',
      title: 'Empecemos por vos.',
      description: 'Así el taller sabe con quién conversa.',
      nodes: [form.querySelector('.form-row')],
      required: ['nombre', 'apellido']
    },
    {
      kicker: 'Tu vehículo',
      icon: '<path d="m3 14 2-5h12l4 5v5H3z"/><circle cx="7" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/><path d="M7 9 9 5h6l2 4"/>',
      title: 'Tu vehículo.',
      description: 'Contanos la marca y el modelo. El año puede ser aproximado.',
      nodes: [form.querySelector('.vehicle-year-row')],
      required: ['vehiculo', 'ano']
    },
    {
      kicker: 'Motivo de consulta',
      icon: '<path d="M14.8 6.2a4 4 0 0 0-5 5L4 17l3 3 5.8-5.8a4 4 0 0 0 5-5l-2.4 2.4-3-3z"/>',
      title: '¿Qué necesitás?',
      description: 'Un servicio, mantenimiento o algo que notaste al manejar.',
      nodes: [form.elements.motivo.closest('.field-shell')],
      required: ['motivo']
    },
    {
      kicker: 'Prioridad y envío',
      icon: '<path d="M12 3 5 6v5c0 4.6 2.9 8.4 7 10 4.1-1.6 7-5.4 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-5"/>',
      title: 'Un último detalle.',
      description: 'Revisá la prioridad antes de abrir tu mensaje.',
      nodes: [
        form.querySelector('.priority-choice'),
        form.querySelector('.field-optional'),
        form.querySelector('.privacy-note'),
        form.querySelector('button[type="submit"]'),
        form.querySelector('.form-note')
      ],
      required: []
    }
  ];
  if (groups.some(group => group.nodes.some(node => !node))) return;

  const count = document.createElement('span');
  count.className = 'wizard-step-count';
  progress.prepend(count);
  const rail = document.createElement('span');
  rail.className = 'wizard-step-rail';
  rail.setAttribute('aria-hidden', 'true');
  rail.append(...groups.map(() => document.createElement('i')));
  progress.append(rail);

  const stages = groups.map((group, index) => {
    const stage = document.createElement('div');
    stage.className = 'wizard-stage';
    stage.dataset.stage = String(index + 1);
    const heading = document.createElement('div');
    heading.className = 'wizard-heading';
    heading.innerHTML = `<div class="wizard-heading-top"><span class="wizard-stage-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${group.icon}</svg></span><span><small>PASO ${String(index + 1).padStart(2, '0')}</small><strong>${group.kicker}</strong></span></div><h3 tabindex="-1"></h3><p></p>${index < 3 ? '<span class="wizard-touch-hint"><i aria-hidden="true"></i>Tocá un campo para escribir</span>' : ''}`;
    heading.querySelector('h3').textContent = group.title;
    heading.querySelector('p').textContent = group.description;
    stage.append(heading, ...group.nodes);

    const navigation = document.createElement('div');
    navigation.className = 'wizard-navigation';
    if (index > 0) {
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'wizard-back';
      back.textContent = 'Volver';
      back.addEventListener('click', () => show(index - 1));
      navigation.append(back);
    }
    if (index < groups.length - 1) {
      const next = document.createElement('button');
      next.type = 'button';
      next.className = 'wizard-next';
      next.innerHTML = 'Continuar <span aria-hidden="true">→</span>';
      next.addEventListener('click', () => {
        for (const name of group.required) {
          const field = form.elements[name];
          if (!field.reportValidity()) return;
        }
        show(index + 1);
      });
      navigation.append(next);
    }
    stage.append(navigation);
    form.append(stage);
    return stage;
  });

  function show(index, focusHeading = true) {
    stages.forEach((stage, position) => stage.classList.toggle('is-current', position === index));
    count.textContent = `${String(index + 1).padStart(2, '0')} / 04 · TU CONSULTA`;
    form.style.setProperty('--wizard-progress', `${(index + 1) * 25}%`);
    rail.querySelectorAll('i').forEach((item, position) => {
      item.classList.toggle('is-current', position === index);
      item.classList.toggle('is-complete', position < index);
    });
    if (focusHeading && window.matchMedia('(max-width: 760px)').matches) {
      document.activeElement?.blur?.();
      stages[index].querySelector('h3').focus({ preventScroll: true });
      const formTop = form.getBoundingClientRect().top;
      window.scrollTo({ top: window.scrollY + formTop - 70, behavior: 'instant' });
    }
  }

  form.classList.add('wizard-ready');
  form.closest('.appointment')?.classList.add('wizard-ready');
  show(0, false);
})();
