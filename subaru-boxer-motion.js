'use strict';
(() => {
  const figure = document.querySelector('.subaru-section .engine-sketch');
  if (!figure || figure.querySelector('.boxer-motion-visor')) return;

  const visor = document.createElement('div');
  visor.className = 'boxer-motion-visor';
  visor.setAttribute('aria-hidden', 'true');
  visor.innerHTML = `
    <span class="boxer-visor-label">BOXER 4 <i>·</i> EN CICLO</span>
    <svg viewBox="0 0 284 116" focusable="false">
      <defs>
        <linearGradient id="boxer-metal" x1="0" y1="0" x2="0" y2="1">
          <stop stop-color="#fbffff"/><stop offset=".42" stop-color="#aab9b9"/><stop offset="1" stop-color="#566c70"/>
        </linearGradient>
        <linearGradient id="boxer-glass" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#70eef2"/><stop offset="1" stop-color="#12818e"/>
        </linearGradient>
      </defs>
      <path class="cylinder-rail" d="M13 35h114M157 35h114M13 81h114M157 81h114"/>
      <path class="cylinder-edge" d="M14 27v16m-5-16h124m6 0h124v16m-249 30v16m-5-16h124m6 0h124v16"/>
      <g class="piston piston-a"><rect x="47" y="29" width="22" height="12" rx="3"/><path d="M51 32h14m-14 6h14"/></g>
      <g class="piston piston-b"><rect x="215" y="29" width="22" height="12" rx="3"/><path d="M219 32h14m-14 6h14"/></g>
      <g class="piston piston-c"><rect x="69" y="75" width="22" height="12" rx="3"/><path d="M73 78h14m-14 6h14"/></g>
      <g class="piston piston-d"><rect x="193" y="75" width="22" height="12" rx="3"/><path d="M197 78h14m-14 6h14"/></g>
      <g class="connecting-rods"><path d="m127 35 14 23m16-23-14 23m-16 23 14-23m16 23-14-23"/></g>
      <g class="crankwheel"><circle cx="141.5" cy="58" r="24"/><circle cx="141.5" cy="58" r="17"/><path d="M141.5 39v38m-19-19h38M128 44l27 27m0-27-27 27"/></g>
      <circle class="crank-pin" cx="141.5" cy="58" r="5"/>
      <text x="14" y="105">OPUESTOS</text><text x="270" y="105" text-anchor="end">PAR SUAVE · TORQUE</text>
    </svg>`;
  const caption = figure.querySelector('figcaption');
  figure.insertBefore(visor, caption || null);
})();
