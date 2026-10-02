'use strict';
(() => {
  const section = document.querySelector('.films-section');
  if (!section) return;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const players = [];
  section.querySelectorAll('.film-card[data-clip]').forEach(card => {
    const source = window.MOTORLOZ.clips?.[card.dataset.clip];
    if (!source || !/^assets\/[a-z0-9_./-]+\.(mp4|webm)$/i.test(source)) { card.hidden = true; return; }
    const video = card.querySelector('video');
    video.loop = true;
    let visible = !('IntersectionObserver' in window);
    const player = window.MOTORLOZ_VIDEO(video, {
      host: card, source,
      shouldPlay: () => visible && !reducedMotion.matches,
      onPlaying: () => card.classList.add('is-playing')
    });
    video.addEventListener('pause', () => card.classList.remove('is-playing'));
    players.push(player);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting && entries[0].intersectionRatio >= .08;
        player.sync();
      }, { threshold: [0, .08, .25] }).observe(video);
    } else player.sync();
  });
  document.addEventListener('visibilitychange', () => players.forEach(player => player.sync()));
  reducedMotion.addEventListener('change', () => players.forEach(player => player.sync()));
  if (players.length) section.hidden = false;
})();
