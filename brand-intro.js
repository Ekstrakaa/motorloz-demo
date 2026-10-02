'use strict';
(() => {
  const root = document.documentElement;
  const intro = document.querySelector('#brand-intro');
  if (!intro) return;
  let timer;
  const dismiss = () => {
    clearTimeout(timer);
    root.classList.remove('brand-intro-active');
    intro.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = event => {
    if (event.key === 'Escape' || event.key === 'Enter') dismiss();
  };
  if (!root.classList.contains('brand-intro-active')) { dismiss(); return; }
  document.addEventListener('keydown', onKey);
  // CSS also dismisses the overlay, even if this script cannot finish loading.
  timer = setTimeout(dismiss, 3200);
  window.addEventListener('pageshow', event => { if (event.persisted) dismiss(); });
})();
