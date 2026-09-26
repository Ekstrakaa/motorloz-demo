'use strict';
(() => {
  const reviews = window.MOTORLOZ.reviews.filter(review =>
    review.name && review.text && review.rating === 5 &&
    /^https:\/\/(www\.)?(google\.com|maps\.app\.goo\.gl)\//.test(review.url)
  );
  if (!reviews.length) return;

  const root = document.querySelector('#review-carousel');
  const track = document.querySelector('#review-track');
  const windowElement = root.querySelector('.review-window');
  const pauseButton = document.querySelector('#review-pause');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reduced.matches;
  let visible = false;
  let offset = 0;
  let loopWidth = 0;
  let lastFrame = performance.now();
  let nudging = false;

  function card(review, duplicate = false) {
    const article = document.createElement('article');
    article.className = 'google-review-card';
    if (duplicate) {
      article.setAttribute('aria-hidden', 'true');
      article.inert = true;
    }
    const top = document.createElement('div');
    top.className = 'review-author';
    const avatar = document.createElement('span');
    avatar.className = 'review-avatar';
    avatar.textContent = review.name.split(' ').map(part => part[0]).slice(0, 2).join('');
    avatar.setAttribute('aria-hidden', 'true');
    const author = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = review.name;
    const source = document.createElement('span');
    source.textContent = 'Reseña en Google';
    author.append(name, source);
    const google = document.createElement('span');
    google.className = 'google-g';
    google.textContent = 'G';
    google.setAttribute('aria-hidden', 'true');
    top.append(avatar, author, google);

    const stars = document.createElement('p');
    stars.className = 'gold-stars';
    stars.textContent = '★★★★★';
    stars.setAttribute('aria-label', '5 de 5 estrellas');
    const quote = document.createElement('blockquote');
    quote.textContent = review.text + (review.excerpt ? ' […]' : '');
    const link = document.createElement('a');
    link.href = review.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = review.excerpt ? 'Leer en Google ↗' : 'Ver en Google ↗';
    article.append(top, stars, quote, link);
    return article;
  }

  reviews.forEach(review => track.append(card(review)));
  reviews.forEach(review => track.append(card(review, true)));
  root.hidden = false;

  function paint() {
    track.style.transform = `translate3d(${-offset}px,0,0)`;
    const first = track.children[0];
    const gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 16;
    const step = first ? first.getBoundingClientRect().width + gap : 1;
    root.dataset.reviewIndex = String(Math.floor(offset / step) % reviews.length);
  }

  function normalize() {
    if (!loopWidth) return;
    offset = ((offset % loopWidth) + loopWidth) % loopWidth;
  }

  function measure() {
    const first = track.children[0];
    const repeatedFirst = track.children[reviews.length];
    if (!first || !repeatedFirst) return;
    loopWidth = repeatedFirst.offsetLeft - first.offsetLeft;
    normalize();
    paint();
  }

  function tick(now) {
    const elapsed = Math.min(now - lastFrame, 64);
    lastFrame = now;
    if (visible && !paused && !document.hidden && !nudging && loopWidth) {
      const speed = innerWidth <= 760 ? 24 : 30;
      offset += elapsed * speed / 1000;
      normalize();
      paint();
    }
    requestAnimationFrame(tick);
  }

  function nudge(direction) {
    if (nudging) return;
    const first = track.children[0];
    const gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 16;
    const step = first.getBoundingClientRect().width + gap;
    if (direction < 0 && offset < step) offset += loopWidth;
    const start = offset;
    const target = start + direction * step;
    const began = performance.now();
    nudging = true;
    function animate(now) {
      const progress = Math.min((now - began) / 520, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      offset = start + (target - start) * eased;
      paint();
      if (progress < 1) requestAnimationFrame(animate);
      else {
        normalize();
        paint();
        nudging = false;
      }
    }
    requestAnimationFrame(animate);
  }

  function updatePauseLabel() {
    pauseButton.textContent = paused ? 'Reanudar' : 'Pausar';
    pauseButton.setAttribute('aria-pressed', String(paused));
  }

  pauseButton.addEventListener('click', () => {
    paused = !paused;
    updatePauseLabel();
  });
  document.querySelector('#review-next').addEventListener('click', () => nudge(1));
  document.querySelector('#review-prev').addEventListener('click', () => nudge(-1));
  new ResizeObserver(measure).observe(windowElement);
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }, { threshold: .15 }).observe(root);
  reduced.addEventListener('change', () => {
    paused = reduced.matches;
    updatePauseLabel();
  });
  updatePauseLabel();
  measure();
  requestAnimationFrame(tick);
})();
