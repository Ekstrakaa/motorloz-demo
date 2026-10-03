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

  const rail = document.querySelector('.workshop-photo-rail');
  const cards = rail ? [...rail.querySelectorAll('.workshop-photo-card')] : [];
  if (!rail || !cards.length) return;
  const step = direction => {
    const center = rail.scrollLeft + rail.clientWidth / 2;
    const current = cards.reduce((best, card, index) => {
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      return Math.abs(cardCenter - center) < Math.abs(cards[best].offsetLeft + cards[best].offsetWidth / 2 - center) ? index : best;
    }, 0);
    cards[Math.max(0, Math.min(cards.length - 1, current + direction))].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };
  document.querySelector('[data-workshop-prev]')?.addEventListener('click', () => step(-1));
  document.querySelector('[data-workshop-next]')?.addEventListener('click', () => step(1));
  rail.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      step(event.key === 'ArrowRight' ? 1 : -1);
    }
  });
})();
