'use strict';
(() => {
  const section = document.querySelector('.films-section');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let hasClip = false;

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
    video.autoplay = true;
    video.playsInline = true;
    video.preload = 'none';
    video.poster = posterImage?.src || '';
    video.disablePictureInPicture = true;
    video.disableRemotePlayback = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('aria-label', `${card.querySelector('strong')?.textContent || 'MOTORLOZ'} — video completo del taller, sin audio`);

    let visible = false;
    let sourceAttached = false;

    function startWhenReady() {
      if (!visible || document.hidden || reducedMotion.matches) {
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

    video.addEventListener('loadeddata', startWhenReady);
    video.addEventListener('canplay', startWhenReady);
    video.addEventListener('canplaythrough', startWhenReady);
    video.addEventListener('progress', startWhenReady);
    video.addEventListener('waiting', () => {
      card.dataset.buffering = 'true';
    });
    video.addEventListener('playing', () => {
      delete card.dataset.buffering;
    });
    video.addEventListener('error', () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.remove();
      if (posterImage) posterImage.hidden = false;
    });

    if (posterImage) posterImage.hidden = true;
    card.prepend(video);

    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (visible) startWhenReady();
      else video.pause();
    }, { threshold: 0.18, rootMargin: '120px 0px' });
    observer.observe(card);

    document.addEventListener('visibilitychange', startWhenReady);
    reducedMotion.addEventListener('change', startWhenReady);
  });

  if (hasClip) section.hidden = false;
})();
