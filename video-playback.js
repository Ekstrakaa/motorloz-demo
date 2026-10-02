'use strict';
// Muted, visible-only playback with bounded recovery and a real user-gesture fallback.
window.MOTORLOZ_VIDEO = function(video, { host, source, shouldPlay, onPlaying = () => {}, onBlocked = () => {} }) {
  let disposed = false;
  let pending = false;
  let blocked = false;
  let attached = false;
  let lastTime = -1;
  let idleTicks = 0;
  let reloads = 0;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'video-retry';
  button.textContent = '▶ Reproducir video';
  button.hidden = true;
  button.setAttribute('aria-label', 'Reproducir video sin sonido');
  host.append(button);
  video.muted = video.defaultMuted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.preload = 'auto';
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.setAttribute('autoplay', '');
  const wanted = () => !disposed && !document.hidden && !document.documentElement?.classList.contains('assistant-chat-open') && shouldPlay();
  function reveal() {
    if (!wanted()) return;
    button.hidden = false;
    onBlocked();
  }
  function play() {
    if (!wanted() || pending || blocked) return;
    if (!attached) {
      attached = true;
      video.src = source;
      video.load();
    }
    pending = true;
    Promise.resolve(video.play()).catch(error => {
      if (!wanted()) return;
      if (error.name === 'NotAllowedError') { blocked = true; reveal(); }
      else if (error.name !== 'AbortError') reveal();
    }).finally(() => { pending = false; });
  }
  function sync() {
    if (!wanted()) { video.pause(); button.hidden = true; idleTicks = 0; return; }
    if (blocked) reveal();
    else play();
  }
  function playing() {
    if (!wanted()) { video.pause(); return; }
    blocked = false;
    button.hidden = true;
    idleTicks = 0;
    lastTime = video.currentTime;
    onPlaying();
  }
  function resumeFromGesture() {
    if (!wanted()) return;
    blocked = false;
    if (video.error || reloads >= 2) { reloads = 0; video.load(); }
    play();
  }
  video.addEventListener('playing', playing);
  video.addEventListener('canplay', play);
  video.addEventListener('error', reveal);
  button.addEventListener('click', resumeFromGesture);
  document.addEventListener('pointerup', resumeFromGesture);
  document.addEventListener('keydown', resumeFromGesture);
  window.addEventListener?.('motorloz:chat-visibility', sync);
  const watchdog = setInterval(() => {
    if (!wanted() || blocked) return;
    if (!video.paused && Math.abs(video.currentTime - lastTime) > .05) {
      idleTicks = 0;
      reloads = 0;
      lastTime = video.currentTime;
      return;
    }
    idleTicks++;
    if (idleTicks < 3) { play(); return; }
    reveal();
    if (reloads >= 2) return;
    reloads++;
    idleTicks = 0;
    pending = false;
    const position = video.currentTime;
    if (position > 0) video.addEventListener('loadedmetadata', () => {
      if (!disposed && Number.isFinite(video.duration)) video.currentTime = Math.min(position, Math.max(0, video.duration - .1));
    }, { once: true });
    video.load();
    play();
  }, 2000);
  return {
    sync,
    dispose() {
      disposed = true;
      clearInterval(watchdog);
      video.removeEventListener('playing', playing);
      video.removeEventListener('canplay', play);
      video.removeEventListener('error', reveal);
      document.removeEventListener('pointerup', resumeFromGesture);
      document.removeEventListener('keydown', resumeFromGesture);
      window.removeEventListener?.('motorloz:chat-visibility', sync);
      button.remove();
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
  };
};
