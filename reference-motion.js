'use strict';
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  // Aurora difusa de taller: el color se transforma dentro del fondo, sin
  // líneas, bandas ni formas delimitadas.
  const auroraSurfaces = document.querySelectorAll(
    'main>.section.workshop,main>.section.people,main>.section.films-section,' +
    'main>.section.why-motorloz,main>.section.diagnostic-story,main>.section.appointment,footer,.reference-bridge-card'
  );
  const auroraStates = [];

  const paintAurora = (state, time = 2.4) => {
    const { canvas, ctx, width, height } = state;
    if (!width || !height) return;
    ctx.clearRect(0, 0, width, height);
    const t = time * (reduced.matches ? .52 : 1);
    const span = Math.max(width, height) * .72;
    const fields = [
      { color: '15,79,86', alpha: .14, x: .23 + .24 * Math.sin(t * .18), y: .31 + .2 * Math.cos(t * .15), sx: 1.25, sy: .72, turn: .18 },
      { color: '20,105,112', alpha: .12, x: .77 + .24 * Math.cos(t * .16 + 1.7), y: .64 + .22 * Math.sin(t * .18 + 1.7), sx: 1.34, sy: .82, turn: -.2 },
      { color: '13,59,72', alpha: .1, x: .48 + .23 * Math.sin(t * .14 + 3.1), y: .48 + .2 * Math.cos(t * .16 + 2.4), sx: 1.18, sy: .66, turn: .14 }
    ];
    fields.forEach((field, index) => {
      const x = width * field.x;
      const y = height * field.y;
      const pulse = .84 + .16 * Math.sin(t * .32 + index * 1.17);
      const radius = span / field.sx * (.96 + .06 * pulse);
      const alpha = field.alpha * pulse * (reduced.matches ? .62 : 1);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(field.turn * Math.sin(t * .12 + index));
      ctx.scale(field.sx, field.sy);
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      glow.addColorStop(0, `rgba(${field.color},${alpha * .72})`);
      glow.addColorStop(.24, `rgba(${field.color},${alpha * .54})`);
      glow.addColorStop(.58, `rgba(${field.color},${alpha * .22})`);
      glow.addColorStop(.82, `rgba(${field.color},${alpha * .04})`);
      glow.addColorStop(1, `rgba(${field.color},0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
      ctx.restore();
    });
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
    auroraStates.push(state);
    new ResizeObserver(resize).observe(surface);
    resize();
  });

  if (auroraStates.length && 'IntersectionObserver' in window) {
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
  } else {
    auroraStates.forEach(state => {
      state.active = true;
      state.animate = now => {
        state.frame = 0;
        if (document.hidden) return;
        if (now - state.last >= 32) {
          state.last = now;
          paintAurora(state, now / 1000);
        }
        state.frame = requestAnimationFrame(state.animate);
      };
      state.frame = requestAnimationFrame(state.animate);
    });
  }
  document.addEventListener('visibilitychange', () => auroraStates.forEach(state => {
    if (document.hidden && state.frame) cancelAnimationFrame(state.frame);
    state.frame = 0;
    if (!document.hidden && state.active) state.frame = requestAnimationFrame(state.animate);
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
