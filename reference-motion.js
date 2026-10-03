'use strict';
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  // Aurora difusa de taller: el color se transforma dentro del fondo, sin
  // líneas, bandas ni formas delimitadas.
  const auroraSurfaces = document.querySelectorAll(
    '.hero,.people-why-aurora,.diagnostic-films-aurora,' +
    'main>.section.appointment,footer,.reference-bridge-card,.contact-bridge-card'
  );
  const auroraStates = [];

  const paintAurora = (state, time = 2.4) => {
    const { canvas, ctx, width, height } = state;
    if (!width || !height) return;
    ctx.clearRect(0, 0, width, height);
    const t = time * (reduced.matches ? .26 : 1);
    // Keep the glow large enough to feel like atmosphere, but localized enough
    // for its slow travel to register against each dark surface.
    const span = Math.min(width, height) * .58;
    const fields = [
      { colors: [[8,55,59],[24,158,164]], alpha: .78, x: .2 + .34 * Math.sin(t * .52), y: .3 + .25 * Math.cos(t * .43), sx: 1.3, sy: .76, turn: .3 },
      { colors: [[8,43,58],[36,127,150]], alpha: .72, x: .8 + .31 * Math.cos(t * .46 + 1.7), y: .68 + .29 * Math.sin(t * .5 + 1.7), sx: 1.16, sy: .72, turn: -.32 },
      { colors: [[8,63,54],[30,142,113]], alpha: .7, x: .47 + .35 * Math.sin(t * .4 + 3.1), y: .48 + .27 * Math.cos(t * .47 + 2.4), sx: 1.24, sy: .7, turn: .24 },
      { colors: [[7,42,49],[24,119,133]], alpha: .64, x: .34 + .33 * Math.cos(t * .47 + .8), y: .76 + .23 * Math.sin(t * .51 + .5), sx: 1.28, sy: .74, turn: -.28 }
    ];
    fields.forEach((field, index) => {
      const x = width * field.x;
      const y = height * field.y;
      const pulse = .78 + .22 * Math.sin(t * .56 + index * 1.17);
      const radius = span / field.sx * (.84 + .16 * pulse);
      const alpha = field.alpha * pulse * (reduced.matches ? .8 : 1);
      const shift = .5 + .5 * Math.sin(t * .39 + index * 1.23);
      const color = field.colors[0].map((channel, channelIndex) =>
        Math.round(channel + (field.colors[1][channelIndex] - channel) * shift)
      ).join(',');
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(field.turn * Math.sin(t * .2 + index));
      ctx.scale(field.sx, field.sy);
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      glow.addColorStop(0, `rgba(${color},${alpha * .9})`);
      glow.addColorStop(.2, `rgba(${color},${alpha * .76})`);
      glow.addColorStop(.52, `rgba(${color},${alpha * .39})`);
      glow.addColorStop(.8, `rgba(${color},${alpha * .1})`);
      glow.addColorStop(1, `rgba(${color},0)`);
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

  // Cada celda tocada deja una huella breve que se desvanece al avanzar el cursor.
  const paper = document.querySelector('main#contenido');
  if (paper && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const traces = new Map();
    const patternWidth = 590;
    const patternHeight = 154;
    const skew = Math.tan(8 * Math.PI / 180);
    const rows = [
      { y: 2, x: [4, 122, 240, 358, 476] },
      { y: 78, x: [-55, 63, 181, 299, 417, 535] }
    ];
    let frame = 0;
    function fadeTrace(key, trace) {
      clearTimeout(trace.releaseTimer);
      clearTimeout(trace.removeTimer);
      trace.element.classList.remove('is-active');
      trace.removeTimer = setTimeout(() => {
        trace.element.remove();
        traces.delete(key);
      }, 1050);
    }

    const clearTraces = () => {
      traces.forEach((trace, key) => fadeTrace(key, trace));
      paper.style.setProperty('--tile-x', '0px');
    };
    paper.addEventListener('pointermove', event => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const lightSurface = event.target.closest('.intro,.services,.reviews,.location,.subaru-section,.hyundai-section,.reference-bridge,.contact-bridge,.customer-gallery,.electric-mobility');
        if (!lightSurface) { frame = 0; return; }
        const rect = paper.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const drift = Number.parseFloat(getComputedStyle(paper).getPropertyValue('--tile-drift')) || 0;
        const shift = Math.round((.5 - x / Math.max(rect.width, 1)) * 12) + drift;
        paper.style.setProperty('--tile-x', `${shift - drift}px`);
        const rowY = ((y % patternHeight) + patternHeight) % patternHeight;
        const row = rows.find(candidate => rowY >= candidate.y && rowY <= candidate.y + 68);
        if (!row) {
          frame = 0;
          return;
        }
        const visualX = x - shift + skew * rowY;
        const cycle = Math.floor(visualX / patternWidth);
        let match = null;
        for (let repeat = cycle - 1; repeat <= cycle + 1 && !match; repeat++) {
          for (const cellX of row.x) {
            const left = repeat * patternWidth + cellX;
            if (visualX >= left && visualX <= left + 108) { match = { left, repeat }; break; }
          }
        }
        if (match) {
          const rowTop = Math.floor(y / patternHeight) * patternHeight + row.y;
          const left = match.left + shift - skew * row.y;
          const key = `${rowTop}:${match.repeat}:${match.left}`;
          let trace = traces.get(key);
          if (!trace) {
            const element = document.createElement('span');
            element.className = 'background-tile-trace';
            element.setAttribute('aria-hidden', 'true');
            paper.prepend(element);
            trace = { element, releaseTimer: 0, removeTimer: 0 };
            traces.set(key, trace);
          }
          clearTimeout(trace.releaseTimer);
          clearTimeout(trace.removeTimer);
          trace.element.style.left = `${left}px`;
          trace.element.style.top = `${rowTop}px`;
          trace.element.classList.add('is-active');
          trace.releaseTimer = setTimeout(() => fadeTrace(key, trace), 420);
        }
        frame = 0;
      });
    }, { passive: true });
    paper.addEventListener('pointerleave', clearTraces, { passive: true });
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
