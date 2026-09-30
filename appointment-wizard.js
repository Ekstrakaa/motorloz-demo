(() => {
  const form = document.querySelector('#appointment-form');
  if (!form) return;

  const progress = form.querySelector('.form-progress');
  const groups = [
    {
      title: 'Empecemos por vos.',
      description: 'Así el taller sabe con quién conversa.',
      nodes: [form.querySelector('.form-row')],
      required: ['nombre', 'apellido']
    },
    {
      title: 'Tu vehículo.',
      description: 'Contanos la marca y el modelo. El año puede ser aproximado.',
      nodes: [form.querySelector('.vehicle-year-row')],
      required: ['vehiculo', 'ano']
    },
    {
      title: '¿Qué necesitás?',
      description: 'Un servicio, mantenimiento o algo que notaste al manejar.',
      nodes: [form.elements.motivo.closest('.field-shell')],
      required: ['motivo']
    },
    {
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

  const stages = groups.map((group, index) => {
    const stage = document.createElement('div');
    stage.className = 'wizard-stage';
    stage.dataset.stage = String(index + 1);
    const heading = document.createElement('div');
    heading.className = 'wizard-heading';
    heading.innerHTML = `<h3 tabindex="-1"></h3><p></p>`;
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
      next.textContent = 'Continuar';
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
