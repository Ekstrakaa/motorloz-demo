(function(root) {
  const create = (context, { sources = new Set(), onStart = () => {}, onDrain = () => {} } = {}) => {
    const rate = 24000;
    let queued = [], count = 0, carry = null, nextTime = 0, stopped = false, finished = false, started = false;
    function flush(final = false) {
      if (stopped || !count) return;
      const underrun = nextTime < context.currentTime + .02;
      // Build an initial cushion and rebuild it after a genuine network stall.
      const threshold = !started || underrun ? .65 : .12;
      if (!final && count < rate * threshold) return;
      const buffer = context.createBuffer(1, count, rate);
      const channel = buffer.getChannelData(0);
      let offset = 0;
      for (const samples of queued) { channel.set(samples, offset); offset += samples.length; }
      queued = []; count = 0;
      const source = context.createBufferSource();
      source.buffer = buffer; source.connect(context.destination);
      const start = underrun ? context.currentTime + .12 : nextTime;
      nextTime = start + buffer.duration;
      sources.add(source);
      source.onended = () => { sources.delete(source); if (finished && !sources.size && !stopped) onDrain(); };
      source.start(start);
      if (!started) { started = true; onStart(); }
    }
    return {
      get started() { return started; },
      push(bytes) {
        if (stopped || finished) return;
        const data = new Uint8Array(bytes.length + (carry === null ? 0 : 1));
        if (carry !== null) data[0] = carry;
        data.set(bytes, carry === null ? 0 : 1);
        carry = data.length % 2 ? data[data.length - 1] : null;
        const samples = new Float32Array(data.length >> 1);
        for (let i = 0; i < samples.length; i++) {
          const value = data[i * 2] | data[i * 2 + 1] << 8;
          samples[i] = (value >= 32768 ? value - 65536 : value) / 32768;
        }
        if (samples.length) { queued.push(samples); count += samples.length; flush(); }
      },
      finish() {
        if (stopped) return;
        if (carry !== null) throw new Error('speech_invalid_pcm');
        flush(true); finished = true;
        if (!sources.size) onDrain();
      },
      stop() {
        stopped = true; queued = []; count = 0; carry = null;
        for (const source of sources) { try { source.stop(); } catch {} }
        sources.clear();
      }
    };
  };
  if (typeof module === 'object' && module.exports) module.exports = { create };
  else root.MOTORLOZ_PCM = { create };
})(typeof window === 'object' ? window : globalThis);
