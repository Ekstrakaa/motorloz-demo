'use strict';
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  // Aurora de taller: ondas dibujadas en cada superficie oscura, sin trasladar
  // una capa por encima de los límites de las secciones.
  const auroraSurfaces = document.querySelectorAll(
    'main>.section.workshop,main>.section.people,main>.section.films-section,' +
    'main>.section.why-motorloz,main>.section.diagnostic-story,main>.section.appointment,footer,.reference-bridge-card'
  );
  const auroraStates = [];

  const paintAurora = (state, time = 2.4) => {
    const { canvas, ctx, width, height } = state;
    if (!width || !height) return;
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const bands = [
      { y: .31, amp: .075, thick: .2, phase: .15, speed: .58, color: '27,151,169' },
      { y: .53, amp: .095, thick: .23, phase: 2.1, speed: -.43, color: '49,190,199' },
      { y: .76, amp: .08, thick: .19, phase: 4.3, speed: .36, color: '20,118,143' }
    ];
    bands.forEach((band, index) => {
      const center = height * band.y;
      const amplitude = Math.max(14, height * band.amp);
      const thickness = Math.max(28, height * band.thick);
      const wave = x => center + Math.sin(x / Math.max(145, width * .22) + time * band.speed + band.phase) * amplitude +
        Math.sin(x / Math.max(88, width * .105) - time * band.speed * .62 + band.phase * 1.55) * amplitude * .24;
      const glow = ctx.createLinearGradient(0, center - thickness, 0, center + thickness);
      glow.addColorStop(0, `rgba(${band.color},0)`);
      glow.addColorStop(.25, `rgba(${band.color},.025)`);
      glow.addColorStop(.48, `rgba(${band.color},${index === 1 ? '.21' : '.16'})`);
      glow.addColorStop(.56, `rgba(${band.color},${index === 1 ? '.17' : '.13'})`);
      glow.addColorStop(.82, `rgba(${band.color},.03)`);
      glow.addColorStop(1, `rgba(${band.color},0)`);

      ctx.beginPath();
      const samples = Math.max(48, Math.ceil(width / 18));
      for (let i = 0; i <= samples; i++) {
        const x = width * i / samples;
        const y = wave(x);
        if (!i) ctx.moveTo(x, y - thickness * .5);
        else ctx.lineTo(x, y - thickness * .5);
      }
      for (let i = samples; i >= 0; i--) {
        const x = width * i / samples;
        ctx.lineTo(x, wave(x) + thickness * .5);
      }
      ctx.closePath();
      ctx.fillStyle = glow;
      ctx.fill();

      ctx.beginPath();
      for (let i = 0; i <= samples; i++) {
        const x = width * i / samples;
        const y = wave(x);
        if (!i) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      const crest = ctx.createLinearGradient(0, center - amplitude, 0, center + amplitude);
      crest.addColorStop(0, `rgba(${band.color},0)`);
      crest.addColorStop(.5, `rgba(91,210,218,${index === 1 ? '.25' : '.18'})`);
      crest.addColorStop(1, `rgba(${band.color},0)`);
      ctx.strokeStyle = crest;
      ctx.lineWidth = Math.max(1, height * .002);
      ctx.shadowColor = 'rgba(46,184,198,.34)';
      ctx.shadowBlur = Math.min(38, Math.max(14, height * .032));
      ctx.stroke();
    });
    ctx.restore();
  };

  auroraSurfaces.forEach(surface => {
    const canvas = document.createElement('canvas');
    canvas.className = 'motorloz-aurora-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    surface.prepend(canvas);
    const state = { surface, canvas, ctx: canvas.getContext('2d', { alpha: true }), width: 0, height: 0, active: false, frame: 0, last: 0 };
    const resize = () => {
      const rect = surface.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      state.width = rect.width;
      state.height = rect.height;
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      state.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (reduced.matches || !state.active) paintAurora(state);
    };
    const animate = now => {
      state.frame = 0;
      if (!state.active || document.hidden) return;
      if (now - state.last >= 32) {
        state.last = now;
        paintAurora(state, now / 1000);
      }
      state.frame = requestAnimationFrame(animate);
    };
    auroraStates.push(state);
    new ResizeObserver(resize).observe(surface);
    resize();
  });

  if (auroraStates.length && !reduced.matches && 'IntersectionObserver' in window) {
    const auroraObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      const state = auroraStates.find(item => item.surface === entry.target);
      if (!state) return;
      state.active = entry.isIntersecting;
      if (state.active && !state.frame) state.frame = requestAnimationFrame(state.animate);
    }), { threshold: 0, rootMargin: '100px 0px' });
    auroraStates.forEach(state => {
      state.animate = now => {
        state.frame = 0;
        if (!state.active || document.hidden) return;
        if (now - state.last >= 32) {
          state.last = now;
          paintAurora(state, now / 1000);
        }
        state.frame = requestAnimationFrame(state.animate);
      };
      auroraObserver.observe(state.surface);
    });
  }
  document.addEventListener('visibilitychange', () => auroraStates.forEach(state => {
    if (document.hidden && state.frame) cancelAnimationFrame(state.frame);
    state.frame = 0;
    if (!document.hidden && state.active && !reduced.matches) state.frame = requestAnimationFrame(state.animate);
  }));

  const principles = [...document.querySelectorAll('.why-grid article')];
  const subaruPhotos = [...document.querySelectorAll('.subaru-photo')];
  const targets = [...principles, ...subaruPhotos];

  // En superficies claras, una luz tenue sigue el cursor para dar profundidad a la cuadrícula.
  if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reduced.matches) {
    const lightSurfaces = document.querySelectorAll('.intro,.services,.reviews,.location,.subaru-section,.hyundai-section,.appointment');
    lightSurfaces.forEach(surface => {
      let frame = 0;
      surface.addEventListener('pointermove', event => {
        if (frame) cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const rect = surface.getBoundingClientRect();
          surface.style.setProperty('--surface-x', `${event.clientX - rect.left}px`);
          surface.style.setProperty('--surface-y', `${event.clientY - rect.top}px`);
          frame = 0;
        });
      }, { passive: true });
    });
  }

  if (!targets.length) return;
  subaruPhotos.forEach(photo => photo.classList.add('motion-ready'));

  if (reduced.matches || !('IntersectionObserver' in window)) {
    targets.forEach(target => target.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-visible');
    observer.unobserve(entry.target);
  }), { threshold: .12, rootMargin: '0px 0px -5% 0px' });
  targets.forEach(target => observer.observe(target));
})();
