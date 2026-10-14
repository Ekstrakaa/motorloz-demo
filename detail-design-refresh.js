'use strict';
(() => {
  document.querySelectorAll('.why-card>svg').forEach((svg, i) => {
    const icon = document.createElement('span');
    icon.className = 'why-icon'; icon.dataset.iconIndex = String(i + 9);
    icon.setAttribute('aria-hidden', 'true'); svg.replaceWith(icon);
  });

  const ratingStars = document.querySelector('.reviews-rating .gold-stars');
  if (ratingStars) {
    ratingStars.innerHTML = [...ratingStars.textContent.trim()].map((star, index) =>
      `<span style="--star-delay:${index * 95}ms">${star}</span>`
    ).join('');
  }

  const entranceTargets = [...document.querySelectorAll(
    '.service-icon,.why-icon,.service-title-row h3,.why-card-copy,.brand-wordmark,.reviews-rating'
  )];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduceMotion && 'IntersectionObserver' in window) {
    entranceTargets.forEach((target, index) => {
      target.classList.add('scroll-entry');
      target.style.setProperty('--entry-delay', `${(index % 5) * 65}ms`);
    });
    const entranceObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-scroll-visible');
      entranceObserver.unobserve(entry.target);
    }), { threshold: .16, rootMargin: '0px 0px -5% 0px' });
    entranceTargets.forEach(target => entranceObserver.observe(target));
  }

  const engineSketch = document.querySelector('.subaru-section .engine-sketch');
  if (engineSketch && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    if ('IntersectionObserver' in window) {
      const engineObserver = new IntersectionObserver(entries => {
        engineSketch.classList.toggle('is-revving', entries[0].isIntersecting);
      }, { threshold: .28 });
      engineObserver.observe(engineSketch);
    } else {
      engineSketch.classList.add('is-revving');
    }
  }

  function rotateImages(rootSelector, imageSelector, interval, update) {
    const root = document.querySelector(rootSelector);
    if (!root) return;
    const slides = [...root.querySelectorAll(imageSelector)];
    if (slides.length < 2) return;
    let index = 0;
    let visible = false;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced && !root.matches('[data-diagnostic-carousel]')) return;
    function syncVideo() {
      slides.forEach((slide, slideIndex) => {
        const video = slide.tagName === 'VIDEO' ? slide : slide.querySelector('video');
        if (!video) return;
        const shouldPlay = visible && slideIndex === index && !document.hidden;
        if (!shouldPlay) { video.pause(); return; }
        video.muted = true;
        video.playsInline = true;
        if (rootSelector === '[data-hyundai-carousel]') {
          video.loop = false;
          video.playbackRate = video.defaultPlaybackRate = 1;
        }
        video.play().catch(() => {});
      });
    }
    function advance(step = 1) {
      slides[index].classList.remove('is-active');
      slides[index].setAttribute('aria-hidden', 'true');
      index = (index + step + slides.length) % slides.length;
      slides[index].classList.add('is-active');
      slides[index].removeAttribute('aria-hidden');
      const incomingVideo = slides[index].tagName === 'VIDEO' ? slides[index] : slides[index].querySelector('video');
      if (incomingVideo) incomingVideo.currentTime = 0;
      update?.(index, slides.length);
      syncVideo();
    }
    if (root.matches('[data-diagnostic-carousel]')) {
      root.querySelector('[data-diagnostic-prev]')?.addEventListener('click', () => {
        advance(-1);
        if (visible) start();
      });
      root.querySelector('[data-diagnostic-next]')?.addEventListener('click', () => {
        advance(1);
        if (visible) start();
      });
    }
    function start() {
      clearTimeout(root._refreshTimer);
      if (reduced) return;
      const scheduleNext = () => {
        const delay = typeof interval === 'function' ? interval(slides[index]) : interval;
        root._refreshTimer = setTimeout(() => {
          advance();
          scheduleNext();
        }, delay);
      };
      scheduleNext();
    }
    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (visible) start();
      else clearTimeout(root._refreshTimer);
      syncVideo();
    }, { threshold: .12 });
    observer.observe(root);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearTimeout(root._refreshTimer);
      else if (root.getBoundingClientRect().bottom > 0 && root.getBoundingClientRect().top < innerHeight) {
        visible = true;
        start();
      }
      syncVideo();
    });
  }
  rotateImages('[data-subaru-carousel]', '.subaru-carousel-stage img, .subaru-carousel-stage video', 4800, (i, n) => {
    const label = document.querySelector('.subaru-carousel-caption span:first-child');
    const count = document.querySelector('[data-carousel-index]');
    if (label) label.textContent = ['SUBARU · DETALLE', 'SUBARU · ATENCIÓN MULTIMARCA', 'SUBARU · EN EL TALLER', 'SUBARU · EN MOVIMIENTO'][i];
    if (count) count.textContent = `${String(i + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`;
  });
  const hyundaiGallery = document.querySelector('#hyundai .hyundai-vehicle-scene');
  const hyundaiSlides = hyundaiGallery ? [...hyundaiGallery.querySelectorAll('.hyundai-video-slide')] : [];
  const hyundaiFilms = hyundaiSlides.map(slide => slide.querySelector('video')).filter(Boolean);
  if (hyundaiGallery && hyundaiFilms.length) {
    let activeIndex = 0;
    let visible = !('IntersectionObserver' in window);
    let changing = false;
    let pendingAdvance = -1;
    let holdTimer = 0;
    const transitionTime = 900;

    hyundaiFilms.forEach((film, index) => {
      film.muted = film.defaultMuted = true;
      film.autoplay = index === 0;
      film.playsInline = true;
      film.controls = false;
      film.loop = false;
      film.preload = 'auto';
      const playbackRate = Number.parseFloat(hyundaiSlides[index].dataset.playbackRate || '1');
      film.playbackRate = film.defaultPlaybackRate = Number.isFinite(playbackRate) ? playbackRate : 1;
      film.removeAttribute('controls');
      film.removeAttribute('loop');
      film.setAttribute('muted', '');
      film.setAttribute('playsinline', '');
      film.setAttribute('webkit-playsinline', '');
      film.setAttribute('disablepictureinpicture', '');
      if (index === 0) film.setAttribute('autoplay', '');
      else film.removeAttribute('autoplay');
    });

    const canPlay = () => visible && !document.hidden && !document.documentElement.classList.contains('assistant-chat-open');
    const playActive = () => {
      if (!canPlay()) return;
      const film = hyundaiFilms[activeIndex];
      if (film.paused && !film.ended) film.play().catch(() => {});
    };
    const syncFilms = () => {
      hyundaiFilms.forEach((film, index) => {
        if (!canPlay() || index !== activeIndex) film.pause();
      });
      if (canPlay() && pendingAdvance >= 0) {
        const nextIndex = pendingAdvance;
        pendingAdvance = -1;
        activate(nextIndex);
        return;
      }
      playActive();
    };
    const activate = nextIndex => {
      if (changing || !hyundaiSlides[nextIndex]) return;
      changing = true;
      const previousIndex = activeIndex;
      const previousSlide = hyundaiSlides[previousIndex];
      const nextSlide = hyundaiSlides[nextIndex];
      const nextFilm = hyundaiFilms[nextIndex];
      nextFilm.currentTime = 0;
      const reveal = () => {
        nextFilm.removeEventListener('playing', reveal);
        nextSlide.classList.add('is-active');
        nextSlide.removeAttribute('aria-hidden');
        previousSlide.classList.remove('is-active');
        previousSlide.setAttribute('aria-hidden', 'true');
        activeIndex = nextIndex;
        changing = false;
        window.setTimeout(() => {
          if (activeIndex !== previousIndex) {
            hyundaiFilms[previousIndex].pause();
            hyundaiFilms[previousIndex].currentTime = 0;
          }
        }, transitionTime);
      };
      nextFilm.addEventListener('playing', reveal, { once: true });
      nextFilm.play().catch(() => {
        nextFilm.removeEventListener('playing', reveal);
        changing = false;
        previousSlide.classList.add('is-active');
        previousSlide.removeAttribute('aria-hidden');
        if (canPlay()) {
          hyundaiFilms[previousIndex].currentTime = 0;
          hyundaiFilms[previousIndex].play().catch(() => {});
        }
      });
    };
    hyundaiFilms.forEach((film, index) => film.addEventListener('ended', () => {
      if (index !== activeIndex) return;
      window.clearTimeout(holdTimer);
      const nextIndex = (index + 1) % hyundaiFilms.length;
      const holdAfter = Number.parseInt(hyundaiSlides[index].dataset.holdAfter || '0', 10);
      const queueAdvance = () => {
        if (index !== activeIndex) return;
        pendingAdvance = nextIndex;
        syncFilms();
      };
      if (holdAfter > 0) holdTimer = window.setTimeout(queueAdvance, holdAfter);
      else queueAdvance();
    }));
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        syncFilms();
      }, { threshold: .12, rootMargin: '100px 0px' }).observe(hyundaiGallery);
    } else syncFilms();
    document.addEventListener('visibilitychange', syncFilms);
    window.addEventListener('pageshow', syncFilms);
    window.addEventListener('focus', playActive);
    window.addEventListener('motorloz:chat-visibility', syncFilms);
    document.addEventListener('pointerdown', playActive, { passive: true });
  }
  const hyundaiEmblem = document.querySelector('.hyundai-signature .hyundai-emblem');
  if (hyundaiEmblem && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const emblemObserver = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return;
      hyundaiEmblem.classList.add('is-intro-visible');
      emblemObserver.disconnect();
    }, { threshold: .35 });
    emblemObserver.observe(hyundaiEmblem);
  }

  const diagLabels = ['ATENCIÓN TOYOTA GR', 'DETALLE · TOYOTA GR', 'CORVETTE · TALLER', 'MOTOR PORSCHE · REVISIÓN'];
  rotateImages('[data-diagnostic-carousel]', '.diagnostic-feature-stage img', 4300, (i, n) => {
    const label = document.querySelector('[data-diagnostic-caption]');
    const count = document.querySelector('[data-diagnostic-index]');
    if (label) label.textContent = diagLabels[i];
    if (count) count.textContent = `${String(i + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`;
  });
})();
