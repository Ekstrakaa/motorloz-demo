'use strict';
(() => {
  const video = document.querySelector('.subaru-feature-video');
  if (video) {
    video.loop = true;
    video.muted = true;
    video.controls = false;
    video.removeAttribute('controls');
    const player = window.MOTORLOZ_VIDEO?.(video, {
      source: 'assets/clips/subaru-section.mp4',
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
    if (!cards.length) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const previousButton = document.querySelector(previousSelector);
    const nextButton = document.querySelector(nextSelector);
    let visible = !('IntersectionObserver' in window);
    let pausedUntil = 0;
    let activeIndex = 0;
    let direction = 1;
    let animationFrame = 0;
    let settleTimer = 0;
    const cardLeft = card => card.getBoundingClientRect().left - rail.getBoundingClientRect().left + rail.scrollLeft;
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
    const warmAround = index => { warm(index); warm(index + 1); warm(index - 1); };
    const updateButtons = () => {
      if (previousButton) previousButton.disabled = activeIndex === 0;
      if (nextButton) nextButton.disabled = activeIndex === cards.length - 1;
    };
    const stopAnimation = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
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
      const target = Math.max(0, Math.min(cards.length - 1, index));
      activeIndex = target;
      warmAround(target);
      updateButtons();
      stopAnimation();
      const padding = parseFloat(getComputedStyle(rail).paddingLeft) || 0;
      const left = Math.max(0, Math.min(rail.scrollWidth - rail.clientWidth, cardLeft(cards[target]) - padding));
      if (reducedMotion.matches) {
        rail.scrollTo({ left, behavior: 'instant' });
        return;
      }
      const from = rail.scrollLeft;
      const distance = left - from;
      if (Math.abs(distance) < 1) return;
      const start = performance.now();
      rail.style.scrollSnapType = 'none';
      rail.style.scrollBehavior = 'auto';
      const animate = now => {
        const progress = Math.min(1, (now - start) / 900);
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
    rail.addEventListener('wheel', pauseForInteraction, { passive: true });
    rail.addEventListener('scroll', () => {
      if (animationFrame) return;
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
      if (activeIndex === cards.length - 1) direction = -1;
      else if (activeIndex === 0) direction = 1;
      moveTo(activeIndex + direction);
    }, 4800);
  }
  setUpPhotoRail('.workshop-photo-rail', '.workshop-photo-card', '[data-workshop-prev]', '[data-workshop-next]');
  setUpPhotoRail('.hyundai-photo-rail', '.hyundai-photo-card', '[data-hyundai-prev]', '[data-hyundai-next]');
})();
