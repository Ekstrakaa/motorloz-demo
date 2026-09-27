'use strict';
(() => {
  const section = document.querySelector('.films-section');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const players = [];
  let activePlayer = null;
  let hasClip = false;

  function chooseActivePlayer() {
    const next = players
      .filter(player => player.visible && player.ratio >= .2 && !document.hidden && !reducedMotion.matches)
      .sort((a, b) => b.ratio - a.ratio)[0] || null;
    activePlayer = next;
    players.forEach(player => player === next ? player.start() : player.pause());
  }

  document.querySelectorAll('[data-clip]').forEach(card => {
    const source = window.MOTORLOZ.clips?.[card.dataset.clip];
    const posterImage = card.querySelector('img');
    if (!source || !/^assets\/[a-z0-9_./-]+\.(mp4|webm)$/i.test(source)) {
      card.hidden = true;
      return;
    }

    hasClip = true;
    const video = document.createElement('video');
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.autoplay = false;
    video.playsInline = true;
    video.preload = 'none';
    video.poster = posterImage?.src || '';
    video.disablePictureInPicture = true;
    video.disableRemotePlayback = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('aria-label', `${card.querySelector('strong')?.textContent || 'MOTORLOZ'} — video completo del taller, sin audio`);

    let sourceAttached = false;

    function startWhenReady() {
      if (!player.visible || activePlayer !== player || document.hidden || reducedMotion.matches) {
        video.pause();
        return;
      }
      if (!sourceAttached) {
        sourceAttached = true;
        video.preload = 'auto';
        video.src = source;
        video.load();
      }
      if (video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) return;

      const lastRange = video.buffered.length - 1;
      const bufferedAhead = lastRange >= 0 ? video.buffered.end(lastRange) - video.currentTime : 0;
      if (bufferedAhead < 1.25 && video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) return;
      video.play().catch(() => {});
    }

    const player = {
      visible: false,
      ratio: 0,
      start: startWhenReady,
      pause: () => { video.pause(); card.classList.remove('is-playing'); }
    };
    players.push(player);

    video.addEventListener('loadeddata', startWhenReady);
    video.addEventListener('canplay', startWhenReady);
    video.addEventListener('canplaythrough', startWhenReady);
    video.addEventListener('progress', startWhenReady);
    video.addEventListener('waiting', () => {
      card.dataset.buffering = 'true';
      card.classList.remove('is-playing');
    });
    video.addEventListener('playing', () => {
      delete card.dataset.buffering;
      card.classList.add('is-playing');
    });
    video.addEventListener('error', () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.remove();
      card.classList.remove('is-playing');
      if (posterImage) posterImage.hidden = false;
    });

    card.prepend(video);

    const observer = new IntersectionObserver(entries => {
      player.visible = entries[0].isIntersecting;
      player.ratio = entries[0].intersectionRatio;
      chooseActivePlayer();
    }, { threshold: [0, .2, .45, .7, 1], rootMargin: '0px' });
    observer.observe(card);

    document.addEventListener('visibilitychange', chooseActivePlayer);
    reducedMotion.addEventListener('change', chooseActivePlayer);
  });

  if (hasClip) section.hidden = false;
})();
