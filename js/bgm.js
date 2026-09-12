window.tetrisBgm = (() => {
  const BPM = 168;
  const BEAT = 60 / BPM;

  const FREQ = {
    A4: 440.0, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25,
    F5: 698.46, G5: 783.99, A5: 880.0, B5: 987.77, rest: 0
  };

  // コロブチカ（テトリス Type A）風メロディ
  const MELODY = [
    ['E5', 0.5], ['B4', 0.25], ['C5', 0.25], ['D5', 0.5], ['C5', 0.25], ['B4', 0.25], ['A4', 0.5],
    ['A4', 0.25], ['C5', 0.25], ['E5', 0.5], ['D5', 0.25], ['C5', 0.25], ['B4', 0.75],
    ['B4', 0.25], ['C5', 0.25], ['D5', 0.5], ['E5', 0.5],
    ['C5', 0.5], ['A4', 0.5], ['A4', 0.75], ['rest', 0.25],
    ['D5', 0.5], ['D5', 0.25], ['F5', 0.25], ['E5', 0.5], ['C5', 0.25], ['B4', 0.25], ['A4', 0.5],
    ['A4', 0.25], ['C5', 0.25], ['E5', 0.5], ['D5', 0.25], ['C5', 0.25], ['B4', 0.75],
    ['B4', 0.25], ['C5', 0.25], ['E5', 0.5], ['A5', 0.5],
    ['G5', 0.5], ['E5', 0.5], ['G5', 0.25], ['A5', 0.25], ['rest', 0.5],
    ['C5', 0.25], ['E5', 0.25], ['A5', 0.5], ['G5', 0.5], ['E5', 0.5],
    ['C5', 0.25], ['E5', 0.25], ['A5', 0.5], ['G5', 0.5], ['E5', 0.75], ['rest', 0.25]
  ];

  let ctx = null;
  let masterGain = null;
  let playing = false;
  let paused = false;
  let muted = false;
  let noteIndex = 0;
  let nextNoteTime = 0;
  let timerId = null;

  function ensureContext() {
    if (!ctx) {
      ctx = new AudioContext();
      masterGain = ctx.createGain();
      masterGain.gain.value = muted ? 0 : 0.18;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') {
      return ctx.resume();
    }
    return Promise.resolve();
  }

  function playNote(freq, start, duration) {
    if (!freq || muted || !ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;

    const attack = 0.005;
    const release = Math.min(0.04, duration * 0.3);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.35, start + attack);
    gain.gain.setValueAtTime(0.35, start + duration - release);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(start);
    osc.stop(start + duration + 0.01);
  }

  function scheduleNotes() {
    if (!playing || paused || !ctx) return;

    while (nextNoteTime < ctx.currentTime + 0.15) {
      const [note, beats] = MELODY[noteIndex];
      const duration = beats * BEAT;
      playNote(FREQ[note], nextNoteTime, duration * 0.92);
      nextNoteTime += duration;
      noteIndex = (noteIndex + 1) % MELODY.length;
    }
  }

  function tick() {
    scheduleNotes();
    if (playing && !paused) {
      timerId = setTimeout(tick, 25);
    }
  }

  return {
    async start() {
      await ensureContext();
      if (playing && !paused) return;

      if (!playing) {
        noteIndex = 0;
        nextNoteTime = ctx.currentTime + 0.05;
      }

      playing = true;
      paused = false;
      clearTimeout(timerId);
      tick();
    },

    pause() {
      paused = true;
      clearTimeout(timerId);
    },

    async resume() {
      if (!playing || !ctx) return;
      await ensureContext();
      paused = false;
      nextNoteTime = ctx.currentTime + 0.05;
      clearTimeout(timerId);
      tick();
    },

    stop() {
      playing = false;
      paused = false;
      clearTimeout(timerId);
      noteIndex = 0;
      if (ctx) {
        nextNoteTime = ctx.currentTime;
      }
    },

    setMuted(value) {
      muted = !!value;
      if (masterGain) {
        masterGain.gain.value = muted ? 0 : 0.18;
      }
    },

    isMuted() {
      return muted;
    },

    toggleMute() {
      muted = !muted;
      if (masterGain) {
        masterGain.gain.value = muted ? 0 : 0.18;
      }
      return muted;
    }
  };
})();
