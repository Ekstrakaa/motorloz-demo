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
    const isHyundai = rail.classList.contains('hyundai-photo-rail');
    let visible = !('IntersectionObserver' in window);
    let hovered = false;
    let pausedUntil = 0;
    let heightFrame = 0;
    const cardLeft = card => card.getBoundingClientRect().left - rail.getBoundingClientRect().left + rail.scrollLeft;
    const currentIndex = () => {
      const center = rail.scrollLeft + rail.clientWidth / 2;
      return cards.reduce((best, card, index) => {
        const distance = Math.abs(cardLeft(card) + card.offsetWidth / 2 - center);
        const bestDistance = Math.abs(cardLeft(cards[best]) + cards[best].offsetWidth / 2 - center);
        return distance < bestDistance ? index : best;
      }, 0);
    };
    const updateHeight = () => {
      if (!isHyundai) return;
      cancelAnimationFrame(heightFrame);
      heightFrame = requestAnimationFrame(() => {
        const style = getComputedStyle(rail);
        const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
        rail.style.height = `${Math.ceil(cards[currentIndex()].offsetHeight + padding + 10)}px`;
      });
    };
    const step = (direction, wrap = false) => {
      const current = currentIndex();
      const target = wrap
        ? (current + direction + cards.length) % cards.length
        : Math.max(0, Math.min(cards.length - 1, current + direction));
      const left = cardLeft(cards[target]) - (rail.clientWidth - cards[target].offsetWidth) / 2;
      rail.scrollTo({ left, behavior: reducedMotion.matches || (wrap && target === 0) ? 'instant' : 'smooth' });
      if (isHyundai) {
        const style = getComputedStyle(rail);
        rail.style.height = `${Math.ceil(cards[target].offsetHeight + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + 10)}px`;
      }
    };
    const pauseForInteraction = () => { pausedUntil = Date.now() + 10000; };
    document.querySelector(previousSelector)?.addEventListener('click', () => { pauseForInteraction(); step(-1); });
    document.querySelector(nextSelector)?.addEventListener('click', () => { pauseForInteraction(); step(1); });
    rail.addEventListener('pointerdown', pauseForInteraction);
    rail.addEventListener('wheel', pauseForInteraction, { passive: true });
    rail.addEventListener('pointerenter', () => { hovered = window.matchMedia('(hover: hover)').matches; });
    rail.addEventListener('pointerleave', () => { hovered = false; });
    rail.addEventListener('scroll', updateHeight, { passive: true });
    rail.addEventListener('keydown', event => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        pauseForInteraction();
        step(event.key === 'ArrowRight' ? 1 : -1);
      }
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
      }, { threshold: .15 }).observe(rail);
    }
    if (isHyundai) {
      cards.forEach(card => card.querySelector('img')?.addEventListener('load', updateHeight));
      if ('ResizeObserver' in window) {
        const observer = new ResizeObserver(updateHeight);
        cards.forEach(card => observer.observe(card));
      } else window.addEventListener('resize', updateHeight);
      updateHeight();
    }
    window.setInterval(() => {
      if (!visible || document.hidden || reducedMotion.matches || hovered || Date.now() < pausedUntil || rail.contains(document.activeElement)) return;
      step(1, true);
    }, 5000);
  }
  setUpPhotoRail('.workshop-photo-rail', '.workshop-photo-card', '[data-workshop-prev]', '[data-workshop-next]');
  setUpPhotoRail('.hyundai-photo-rail', '.hyundai-photo-card', '[data-hyundai-prev]', '[data-hyundai-next]');
})();
