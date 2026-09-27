'use strict';
(() => {
  const section = document.querySelector('.films-section');
  if (!section) return;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const players = [];
  let pageVisible = !document.hidden;

  document.querySelectorAll('.film-card[data-clip]').forEach(card => {
    const source = window.MOTORLOZ.clips?.[card.dataset.clip];
    if (!source || !/^assets\/[a-z0-9_./-]+\.(mp4|webm)$/i.test(source)) {
      card.hidden = true;
      return;
    }

    const video = card.querySelector('video') || document.createElement('video');
    video.className = 'film-video';
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.disablePictureInPicture = true;
    video.disableRemotePlayback = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('autoplay', '');
    video.setAttribute('aria-label', `${card.querySelector('strong')?.textContent || 'MOTORLOZ'} — video del taller, sin audio`);

    const player = { card, video, source, visible: !('IntersectionObserver' in window), attached: Boolean(video.getAttribute('src')) };
    players.push(player);

    function playWhenVisible() {
      if (!player.visible || !pageVisible || reducedMotion.matches) {
        video.pause();
        return;
      }
      if (!player.attached) {
        player.attached = true;
        video.src = source;
        video.load();
      }
      video.play().catch(() => {});
    }

    video.addEventListener('playing', () => card.classList.add('is-playing'));
    video.addEventListener('pause', () => card.classList.remove('is-playing'));
    video.addEventListener('waiting', () => card.dataset.buffering = 'true');
    video.addEventListener('playing', () => delete card.dataset.buffering);
    video.addEventListener('error', () => {
      card.dataset.clipError = 'true';
      video.pause();
    });
    if (!video.isConnected) card.prepend(video);

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        player.visible = entries[0].isIntersecting && entries[0].intersectionRatio >= .08;
        playWhenVisible();
      }, { threshold: [0, .08, .25], rootMargin: '100px 0px' });
      observer.observe(card);
    } else {
      playWhenVisible();
    }
    player.playWhenVisible = playWhenVisible;
  });

  document.addEventListener('visibilitychange', () => {
    pageVisible = !document.hidden;
    players.forEach(player => player.playWhenVisible());
  });
  reducedMotion.addEventListener('change', () => players.forEach(player => player.playWhenVisible()));
  if (players.length) section.hidden = false;
})();
