'use strict';
(() => {
  const seenNames = new Set();
  const reviews = window.MOTORLOZ.reviews.filter(review =>
    review.name && review.text && review.rating === 5 &&
    /^https:\/\/(www\.)?(google\.com|maps\.app\.goo\.gl)\//.test(review.url)
  ).filter(review => {
    const key = review.name.trim().toLocaleLowerCase('es');
    if (seenNames.has(key)) return false;
    seenNames.add(key);
    return true;
  });
  if (!reviews.length) return;

  const root = document.querySelector('#review-carousel');
  const track = document.querySelector('#review-track');
  const windowElement = root.querySelector('.review-window');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reduced.matches;
  let visible = false;
  let offset = 0;
  let loopWidth = 0;
  let lastFrame = performance.now();

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
    if (visible && !paused && !document.hidden && loopWidth) {
      const speed = innerWidth <= 760 ? 44 : 52;
      offset += elapsed * speed / 1000;
      normalize();
      paint();
    }
    requestAnimationFrame(tick);
  }

  root.addEventListener('focusin', () => { paused = true; });
  root.addEventListener('focusout', event => {
    if (!root.contains(event.relatedTarget)) paused = reduced.matches;
  });
  root.addEventListener('mouseenter', () => { paused = true; });
  root.addEventListener('mouseleave', () => { paused = reduced.matches; });
  new ResizeObserver(measure).observe(windowElement);
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }, { threshold: .15 }).observe(root);
  reduced.addEventListener('change', () => { paused = reduced.matches; });
  measure();
  requestAnimationFrame(tick);
})();
