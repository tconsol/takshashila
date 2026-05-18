class GameSounds {
  private ctx: AudioContext | null = null;
  private enabled = true;

  private getCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  setEnabled(v: boolean) {
    this.enabled = v;
  }

  isEnabled() {
    return this.enabled;
  }

  private tone(
    freq: number,
    duration: number,
    opts: { type?: OscillatorType; gain?: number; freqEnd?: number; delay?: number } = {},
  ) {
    if (!this.enabled) return;
    const ctx = this.getCtx();
    if (!ctx) return;
    const start = ctx.currentTime + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, start);
    if (opts.freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(opts.freqEnd, start + duration);
    }
    const peak = opts.gain ?? 0.18;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  private noise(duration: number, gain = 0.2, filterFreq = 2000) {
    if (!this.enabled) return;
    const ctx = this.getCtx();
    if (!ctx) return;
    const bufSize = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.3));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    src.start();
  }

  // ── Public sound effects ──────────────────────────────────────────
  tap() {
    this.tone(700, 0.05, { type: 'square', gain: 0.08 });
  }

  click() {
    this.tone(1200, 0.04, { type: 'triangle', gain: 0.12, freqEnd: 800 });
  }

  success() {
    // C5 → E5 → G5 arpeggio
    this.tone(523.25, 0.12, { type: 'sine', gain: 0.2, delay: 0 });
    this.tone(659.25, 0.12, { type: 'sine', gain: 0.2, delay: 0.06 });
    this.tone(783.99, 0.2, { type: 'sine', gain: 0.22, delay: 0.12 });
  }

  fail() {
    this.tone(330, 0.18, { type: 'sawtooth', gain: 0.15, freqEnd: 220, delay: 0 });
    this.tone(220, 0.25, { type: 'sawtooth', gain: 0.12, freqEnd: 140, delay: 0.08 });
  }

  combo() {
    this.tone(660, 0.08, { type: 'square', gain: 0.15 });
    this.tone(880, 0.1, { type: 'square', gain: 0.18, delay: 0.06 });
    this.tone(1100, 0.12, { type: 'square', gain: 0.2, delay: 0.12 });
  }

  pop() {
    this.noise(0.08, 0.18, 1500);
    this.tone(900, 0.06, { type: 'sine', gain: 0.1, freqEnd: 400 });
  }

  levelUp() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this.tone(f, 0.2, { type: 'triangle', gain: 0.22, delay: i * 0.08 });
    });
  }

  gameOver() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach((f, i) => {
      this.tone(f, 0.25, { type: 'triangle', gain: 0.2, delay: i * 0.1 });
    });
  }

  whoosh() {
    this.noise(0.25, 0.12, 600);
  }

  countdown() {
    this.tone(880, 0.1, { type: 'sine', gain: 0.15 });
  }
}

export const gameSounds = new GameSounds();
