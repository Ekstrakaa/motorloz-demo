'use strict';
// Muted, visible-only playback with quiet recovery and no visible player controls.
window.MOTORLOZ_VIDEO = function(video, { source, shouldPlay, onPlaying = () => {} }) {
  let disposed = false;
  let pending = false;
  let blocked = false;
  let attached = false;
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
    blocked = true;
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
    if (!wanted()) { video.pause(); return; }
    if (!blocked) play();
  }
  function playing() {
    if (!wanted()) { video.pause(); return; }
    blocked = false;
    onPlaying();
  }
  function resumeFromGesture() {
    if (!wanted()) return;
    blocked = false;
    if (video.error) video.load();
    play();
  }
  function resumeUnexpectedPause() {
    if (wanted() && !video.ended && !blocked) play();
  }
  video.addEventListener('playing', playing);
  video.addEventListener('canplay', play);
  video.addEventListener('error', reveal);
  video.addEventListener('pause', resumeUnexpectedPause);
  video.addEventListener('stalled', resumeUnexpectedPause);
  document.addEventListener('pointerup', resumeFromGesture);
  document.addEventListener('keydown', resumeFromGesture);
  window.addEventListener?.('motorloz:chat-visibility', sync);
  return {
    sync,
    dispose() {
      disposed = true;
      video.removeEventListener('playing', playing);
      video.removeEventListener('canplay', play);
      video.removeEventListener('error', reveal);
      video.removeEventListener('pause', resumeUnexpectedPause);
      video.removeEventListener('stalled', resumeUnexpectedPause);
      document.removeEventListener('pointerup', resumeFromGesture);
      document.removeEventListener('keydown', resumeFromGesture);
      window.removeEventListener?.('motorloz:chat-visibility', sync);
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
  };
};
