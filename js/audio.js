import { DemoBeat } from './demo.js';

const BANDS = { sub: [20, 60], bass: [60, 250], mid: [250, 2000], high: [2000, 12000] };
const clamp01 = v => Math.min(1, Math.max(0, v));

/**
 * Audio sources (demo beat, file, microphone) feed an analyser.
 * Each frame `update()` returns normalised bands, energy and a kick envelope.
 */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.kind = 'none';
    this.state = { sub: 0, bass: 0, mid: 0, high: 0, energy: 0, kick: 0, kickN: 0 };
    this.peaks = { sub: .2, bass: .2, mid: .2, high: .2 };
    this.fluxHist = [];
    this.lastKick = 0;
  }

  ensure() {
    if (!this.ctx) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.ctx = ctx;
      this.input = ctx.createGain();
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = .35;
      this.input.connect(this.analyser);
      this.out = ctx.createGain();
      this.out.connect(ctx.destination);
      this.recDest = ctx.createMediaStreamDestination();
      this.out.connect(this.recDest);
      this.freq = new Float32Array(this.analyser.frequencyBinCount);
      this.prevSpec = new Float32Array(this.analyser.frequencyBinCount);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  stop() {
    if (this.demo) { this.demo.stop(); this.demo = null; }
    if (this.el) { this.el.pause(); this.el.src = ''; this.el = null; }
    if (this.micStream) { this.micStream.getTracks().forEach(t => t.stop()); this.micStream = null; }
    if (this.node) { try { this.node.disconnect(); } catch (_) {} this.node = null; }
    this.kind = 'none';
  }

  useDemo() {
    this.ensure();
    this.stop();
    this.demo = new DemoBeat(this.ctx);
    this.node = this.demo.output;
    this.node.connect(this.input);
    this.node.connect(this.out);
    this.demo.start();
    this.kind = 'demo';
  }

  async useFile(file) {
    this.ensure();
    this.stop();
    const el = new Audio();
    el.src = URL.createObjectURL(file);
    el.loop = true;
    el.crossOrigin = 'anonymous';
    this.el = el;
    this.node = this.ctx.createMediaElementSource(el);
    this.node.connect(this.input);
    this.node.connect(this.out);
    this.kind = 'file';
    this.fileName = file.name;
    await el.play();
  }

  async useMic() {
    this.ensure();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this.stop();
    this.micStream = stream;
    this.node = this.ctx.createMediaStreamSource(stream);
    this.node.connect(this.input); // not to speakers: avoids feedback
    this.node.connect(this.recDest); // but recorded clips keep the sound
    this.kind = 'mic';
  }

  get playing() {
    if (this.kind === 'demo') return this.demo && this.demo.running;
    if (this.kind === 'file') return this.el && !this.el.paused;
    return this.kind === 'mic';
  }

  toggle() {
    if (this.kind === 'demo') this.demo.running ? this.demo.stop() : this.demo.start();
    else if (this.kind === 'file') this.el.paused ? this.el.play() : this.el.pause();
  }

  setVolume(v) { if (this.out) this.out.gain.value = v; }
  setGain(v) { if (this.input) this.input.gain.value = v; }

  update(dt, react, decay) {
    const s = this.state;
    if (!this.ctx || this.kind === 'none') {
      for (const k of ['sub', 'bass', 'mid', 'high', 'energy']) s[k] *= .9;
      s.kick *= .9;
      return s;
    }
    const a = this.analyser;
    a.getFloatFrequencyData(this.freq);
    const binHz = this.ctx.sampleRate / a.fftSize;
    const lin = i => clamp01((this.freq[i] + 95) / 65);

    // bands, normalised against a slowly-decaying running peak
    const release = .04 + (1 - decay) * .25;
    for (const [k, [lo, hi]] of Object.entries(BANDS)) {
      const i0 = Math.max(1, Math.floor(lo / binHz)), i1 = Math.ceil(hi / binHz);
      let sum = 0;
      for (let i = i0; i <= i1; i++) sum += lin(i);
      const v = sum / (i1 - i0 + 1);
      this.peaks[k] = Math.max(v, this.peaks[k] * Math.pow(.92, dt), .08);
      const target = clamp01(Math.pow(v / this.peaks[k], 2) * react);
      s[k] += (target - s[k]) * (target > s[k] ? .6 : release);
    }
    s.energy = clamp01((s.sub + s.bass * 1.5 + s.mid + s.high * .7) / 4.2);

    // kick: spectral flux in the low end vs. its recent statistics
    const k0 = Math.max(1, Math.floor(35 / binHz)), k1 = Math.ceil(160 / binHz);
    let flux = 0;
    for (let i = k0; i <= k1; i++) {
      const v = lin(i);
      flux += Math.max(0, v - this.prevSpec[i]);
    }
    for (let i = 0; i < this.freq.length; i++) this.prevSpec[i] = lin(i);
    flux /= (k1 - k0 + 1);
    const h = this.fluxHist;
    h.push(flux);
    if (h.length > 45) h.shift();
    const mean = h.reduce((x, y) => x + y, 0) / h.length;
    const sd = Math.sqrt(h.reduce((x, y) => x + (y - mean) ** 2, 0) / h.length);
    const now = this.ctx.currentTime;
    if (flux > mean + 1.4 * sd && flux > .02 && now - this.lastKick > .14) {
      this.lastKick = now;
      s.kick = Math.min(1, .55 + .45 * react);
      s.kickN += 1;
    } else {
      const holdSec = .08 + decay * .7;
      s.kick *= Math.exp(-dt / holdSec);
    }
    return s;
  }
}
