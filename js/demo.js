// A small synthesised loop (kick, clap, hats, bass, pad, arp) so the page reacts
// to music out of the box, without needing an audio file or a microphone.

const BPM = 122;
const STEP = 60 / BPM / 4; // 16th note
const ROOTS = [45, 41, 48, 43]; // A, F, C, G (MIDI) - one chord per bar
const midi = n => 440 * Math.pow(2, (n - 69) / 12);

export class DemoBeat {
  constructor(ctx) {
    this.ctx = ctx;
    this.output = ctx.createGain();
    this.output.gain.value = .8;
    this.running = false;
    this.step = 0;
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.connect(this.output);
    this.bus = comp;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.next = this.ctx.currentTime + .05;
    this.timer = setInterval(() => this._schedule(), 25);
  }

  stop() {
    this.running = false;
    clearInterval(this.timer);
  }

  _schedule() {
    while (this.next < this.ctx.currentTime + .12) {
      this._play(this.step, this.next);
      this.next += STEP;
      this.step = (this.step + 1) % 128;
    }
  }

  _env(t, a, d, peak = 1) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(.0001, t + a + d);
    g.connect(this.bus);
    return g;
  }

  _noise(t, dur, type, freq, q, peak) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    src.connect(f).connect(this._env(t, .002, dur, peak));
    src.start(t, Math.random() * .5);
    src.stop(t + dur + .05);
  }

  _play(i, t) {
    const ctx = this.ctx;
    const s16 = i % 16, bar = Math.floor(i / 16) % 4;
    const breakdown = i >= 96 && i < 112; // drop the kick for a bar every 8 bars

    if (s16 % 4 === 0 && !breakdown) {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(42, t + .12);
      o.connect(this._env(t, .002, .38, 1.1));
      o.start(t);
      o.stop(t + .45);
    }
    if (s16 === 4 || s16 === 12) this._noise(t, .18, 'bandpass', 1500, .8, .5);
    if (s16 % 2 === 1 || (i % 32 > 28)) this._noise(t, .04, 'highpass', 8000, .5, s16 % 4 === 2 ? .25 : .14);

    // offbeat bass
    if (s16 % 4 === 2 || s16 === 15) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midi(ROOTS[bar] - 12 + (s16 === 15 ? 12 : 0));
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(900, t);
      f.frequency.exponentialRampToValueAtTime(140, t + .18);
      o.connect(f).connect(this._env(t, .005, .22, .45));
      o.start(t);
      o.stop(t + .3);
    }

    // pad chord, one per bar
    if (s16 === 0) {
      const dur = STEP * 16;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 1400;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(.07, t + .4);
      g.gain.linearRampToValueAtTime(0, t + dur);
      f.connect(g).connect(this.bus);
      const third = bar === 0 ? 3 : 4;
      for (const n of [0, third, 7, 12]) {
        for (const det of [-6, 6]) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = midi(ROOTS[bar] + 12 + n);
          o.detune.value = det;
          o.connect(f);
          o.start(t);
          o.stop(t + dur + .05);
        }
      }
    }

    // sparkly arp on the second half of the loop
    if (i >= 64 && s16 % 2 === 0) {
      const notes = [0, 7, 12, 15, 19, 12, 7, 3];
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = midi(ROOTS[bar] + 36 + notes[(s16 / 2) % 8]);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 3500;
      o.connect(f).connect(this._env(t, .003, .12, .06));
      o.start(t);
      o.stop(t + .16);
    }
  }
}
