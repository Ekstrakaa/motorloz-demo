'use strict';
(() => {
  const video = document.querySelector('.subaru-feature-video');
  if (video) {
    video.loop = true;
    video.muted = true;
    video.controls = false;
    video.removeAttribute('controls');
    const player = window.MOTORLOZ_VIDEO?.(video, {
      source: 'assets/cinema-subaru-natural.mp4',
      shouldPlay: () => visible,
    });
    let visible = false;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        player?.sync();
      }, { threshold: .08, rootMargin: '160px 0px' }).observe(video);
    } else {
      visible = true;
      player?.sync();
    }
    document.addEventListener('visibilitychange', () => player?.sync());
  }

  function setUpPhotoRail(railSelector, cardSelector, previousSelector, nextSelector) {
    const rail = document.querySelector(railSelector);
    const cards = rail ? [...rail.querySelectorAll(cardSelector)] : [];
    if (cards.length < 2) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const previousButton = document.querySelector(previousSelector);
    const nextButton = document.querySelector(nextSelector);
    let visible = !('IntersectionObserver' in window);
    let pausedUntil = 0;
    let activeIndex = 0;
    let animationFrame = 0;
    let settleTimer = 0;
    let wrapTimer = 0;
    let wrapping = false;
    let touchStart = null;
    const cardLeft = card => card.getBoundingClientRect().left - rail.getBoundingClientRect().left + rail.scrollLeft;
    const padding = () => parseFloat(getComputedStyle(rail).paddingLeft) || 0;
    const maxScroll = () => Math.max(0, rail.scrollWidth - rail.clientWidth);
    const closestIndex = () => {
      return cards.reduce((best, card, index) => {
        const distance = Math.abs(cardLeft(card) - rail.scrollLeft);
        const bestDistance = Math.abs(cardLeft(cards[best]) - rail.scrollLeft);
        return distance < bestDistance ? index : best;
      }, 0);
    };
    const warm = index => {
      const image = cards[index]?.querySelector('img');
      if (image && image.loading === 'lazy') image.loading = 'eager';
    };
    const warmAround = index => {
      warm(index);
      warm((index + 1) % cards.length);
      warm((index - 1 + cards.length) % cards.length);
    };
    const updateButtons = () => {
      if (previousButton) previousButton.disabled = false;
      if (nextButton) nextButton.disabled = false;
    };
    const stopAnimation = () => {
      cancelAnimationFrame(animationFrame);
      clearTimeout(wrapTimer);
      animationFrame = 0;
      wrapping = false;
      rail.style.transition = '';
      rail.style.opacity = '';
      rail.style.scrollSnapType = '';
      rail.style.scrollBehavior = '';
    };
    const pauseForInteraction = () => {
      pausedUntil = Date.now() + 7500;
      stopAnimation();
      activeIndex = closestIndex();
      updateButtons();
    };
    const moveTo = index => {
      const shouldWrap = index < 0 || index >= cards.length;
      const target = (index + cards.length) % cards.length;
      activeIndex = target;
      warmAround(target);
      updateButtons();
      stopAnimation();
      const left = Math.max(0, Math.min(maxScroll(), cardLeft(cards[target]) - padding()));
      if (shouldWrap) {
        if (reducedMotion.matches) { rail.scrollLeft = left; return; }
        wrapping = true;
        rail.style.transition = 'opacity 180ms ease';
        rail.style.opacity = '0';
        wrapTimer = setTimeout(() => {
          rail.style.scrollSnapType = 'none';
          rail.style.scrollBehavior = 'auto';
          rail.scrollLeft = left;
          requestAnimationFrame(() => {
            rail.style.opacity = '1';
            wrapTimer = setTimeout(() => {
              wrapping = false;
              rail.style.transition = '';
              rail.style.opacity = '';
              rail.style.scrollSnapType = '';
              rail.style.scrollBehavior = '';
            }, 190);
          });
        }, 190);
        return;
      }
      if (reducedMotion.matches) {
        rail.scrollLeft = left;
        return;
      }
      const from = rail.scrollLeft;
      const distance = left - from;
      if (Math.abs(distance) < 1) return;
      const start = performance.now();
      rail.style.scrollSnapType = 'none';
      rail.style.scrollBehavior = 'auto';
      const animate = now => {
        const progress = Math.min(1, (now - start) / 850);
        const eased = progress < .5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
        rail.scrollLeft = from + distance * eased;
        if (progress < 1) animationFrame = requestAnimationFrame(animate);
        else {
          animationFrame = 0;
          rail.scrollLeft = left;
          rail.style.scrollSnapType = '';
          rail.style.scrollBehavior = '';
        }
      };
      animationFrame = requestAnimationFrame(animate);
    };
    previousButton?.addEventListener('click', () => { pauseForInteraction(); moveTo(activeIndex - 1); });
    nextButton?.addEventListener('click', () => { pauseForInteraction(); moveTo(activeIndex + 1); });
    rail.addEventListener('pointerdown', pauseForInteraction);
    rail.addEventListener('touchstart', event => {
      touchStart = { x: event.touches[0]?.clientX, left: rail.scrollLeft, index: closestIndex() };
    }, { passive: true });
    rail.addEventListener('touchend', event => {
      if (!touchStart) return;
      const delta = event.changedTouches[0]?.clientX - touchStart.x;
      const stayedAtEdge = Math.abs(rail.scrollLeft - touchStart.left) < 8;
      if (stayedAtEdge && delta < -55 && touchStart.index === cards.length - 1 && rail.scrollLeft >= maxScroll() - 8) moveTo(cards.length);
      else if (stayedAtEdge && delta > 55 && touchStart.index === 0 && rail.scrollLeft <= 8) moveTo(-1);
      touchStart = null;
    }, { passive: true });
    rail.addEventListener('wheel', event => {
      pauseForInteraction();
      if (Math.abs(event.deltaX) < 20 || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      if (event.deltaX > 0 && activeIndex === cards.length - 1 && rail.scrollLeft >= maxScroll() - 8) {
        event.preventDefault();
        moveTo(cards.length);
      } else if (event.deltaX < 0 && activeIndex === 0 && rail.scrollLeft <= 8) {
        event.preventDefault();
        moveTo(-1);
      }
    }, { passive: false });
    rail.addEventListener('scroll', () => {
      if (animationFrame || wrapping) return;
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        activeIndex = closestIndex();
        warmAround(activeIndex);
        updateButtons();
      }, 180);
    }, { passive: true });
    rail.addEventListener('keydown', event => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        pauseForInteraction();
        moveTo(activeIndex + (event.key === 'ArrowRight' ? 1 : -1));
      }
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        if (visible) {
          activeIndex = closestIndex();
          warmAround(activeIndex);
          updateButtons();
        }
      }, { threshold: .12 }).observe(rail);
    }
    warmAround(activeIndex);
    updateButtons();
    window.setInterval(() => {
      if (!visible || document.hidden || reducedMotion.matches || Date.now() < pausedUntil || animationFrame) return;
      moveTo(activeIndex + 1);
    }, 3000);
  }
  setUpPhotoRail('.workshop-photo-rail', '.workshop-photo-card', '[data-workshop-prev]', '[data-workshop-next]');
  setUpPhotoRail('.hyundai-photo-rail', '.hyundai-photo-card', '[data-hyundai-prev]', '[data-hyundai-next]');
})();
