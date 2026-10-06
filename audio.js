// Tonerkennung über das Mikrofon: erkennt Anschläge, berechnet welche Töne
// klingen (Chroma) und vergleicht sie mit dem erwarteten Akkord.
import { templates, NOTE_NAMES } from './chords.js';

const TEMPLATES = templates();

export class AudioAnalyzer {
  constructor(onStrum) {
    this.onStrum = onStrum;
    this.running = false;
    this.noise = 0.005;
    this.prevRms = 0;
    this.lastOnset = 0;
    this.collect = null;
    this.buzzBaseline = null;
    this.level = 0;
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    // Der AudioContext wird möglichst schon beim Tippen auf "Start" angelegt (wichtig für iOS)
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    await this.ctx.resume();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 8192;
    this.analyser.smoothingTimeConstant = 0;
    src.connect(this.analyser);
    this.freq = new Float32Array(this.analyser.frequencyBinCount);
    this.time = new Float32Array(this.analyser.fftSize);
    this.binHz = this.ctx.sampleRate / this.analyser.fftSize;
    this.running = true;
    this.timer = setInterval(() => this.tick(), 30);
  }

  stop() {
    this.running = false;
    clearInterval(this.timer);
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    if (this.ctx) this.ctx.close();
  }

  tick() {
    const now = performance.now();
    this.analyser.getFloatTimeDomainData(this.time);
    let sum = 0;
    for (let i = 0; i < this.time.length; i += 4) sum += this.time[i] * this.time[i];
    const rms = Math.sqrt(sum / (this.time.length / 4));
    this.level = rms;

    // Anschlag erkennen: deutlicher Lautstärkesprung über dem Grundrauschen
    const threshold = Math.max(this.noise * 4, 0.015);
    if (!this.collect && rms > threshold && rms > this.prevRms * 1.6 && now - this.lastOnset > 350) {
      this.lastOnset = now;
      this.collect = { start: now, frames: [], buzz: [] };
    }
    if (rms < threshold) this.noise = this.noise * 0.98 + rms * 0.02;
    this.prevRms = rms;

    if (this.collect) {
      const dt = now - this.collect.start;
      if (dt > 80) {
        this.analyser.getFloatFrequencyData(this.freq);
        const { chroma, buzz } = this.analyse();
        this.collect.frames.push(chroma);
        this.collect.buzz.push(buzz);
      }
      if (dt > 480) {
        const n = this.collect.frames.length;
        if (n) {
          const chroma = new Array(12).fill(0);
          for (const c of this.collect.frames) for (let i = 0; i < 12; i++) chroma[i] += c[i] / n;
          const buzz = this.collect.buzz.reduce((a, b) => a + b, 0) / n;
          this.onStrum({ chroma: normalize(chroma), buzz: this.judgeBuzz(buzz) });
        }
        this.collect = null;
      }
    }
  }

  analyse() {
    const chroma = new Array(12).fill(0);
    let low = 0, high = 0;
    for (let i = 1; i < this.freq.length; i++) {
      const f = i * this.binHz;
      if (f > 6000) break;
      const mag = Math.pow(10, this.freq[i] / 20);
      if (f >= 75 && f <= 1500) {
        const midi = 69 + 12 * Math.log2(f / 440);
        const nearest = Math.round(midi);
        const dev = Math.abs(midi - nearest);
        if (dev < 0.35) {
          const w = 1 - dev / 0.35;
          chroma[((nearest % 12) + 12) % 12] += Math.sqrt(mag) * w;
        }
        low += mag * mag;
      } else if (f >= 2500) {
        high += mag * mag;
      }
    }
    return { chroma, buzz: low > 0 ? high / low : 0 };
  }

  // Schnarren: ungewöhnlich viel hochfrequentes Geräusch im Vergleich zu bisherigen Anschlägen
  judgeBuzz(ratio) {
    if (this.buzzBaseline === null) { this.buzzBaseline = ratio; return false; }
    const isBuzz = ratio > this.buzzBaseline * 2.5 && ratio > 0.02;
    if (!isBuzz) this.buzzBaseline = this.buzzBaseline * 0.85 + ratio * 0.15;
    return isBuzz;
  }
}

function normalize(v) {
  const m = Math.max(...v);
  return m > 0 ? v.map(x => x / m) : v;
}

function cosine(chroma, tones) {
  let dot = 0, nc = 0;
  for (let i = 0; i < 12; i++) {
    const t = tones.includes(i) ? 1 : 0;
    dot += chroma[i] * t;
    nc += chroma[i] * chroma[i];
  }
  return nc > 0 ? dot / (Math.sqrt(nc) * Math.sqrt(tones.length)) : 0;
}

// Bewertet einen Anschlag gegen den erwarteten (und den nächsten) Akkord
export function evaluateStrum({ chroma, buzz }, expected, next) {
  const simExpected = cosine(chroma, expected.tones);
  const simNext = next ? cosine(chroma, next.tones) : 0;
  let best = { name: expected.name, sim: simExpected };
  for (const t of TEMPLATES) {
    const s = cosine(chroma, t.tones);
    if (s > best.sim) best = { name: t.name, sim: s };
  }

  const missing = expected.tones.filter(pc => chroma[pc] < 0.18);
  const extra = [];
  for (let pc = 0; pc < 12; pc++) if (!expected.tones.includes(pc) && chroma[pc] > 0.6) extra.push(pc);

  let error = null;
  if (simExpected < 0.6 && best.sim > simExpected + 0.12) error = 'falscher_akkord';
  else if (extra.length) error = 'falscher_ton';
  else if (missing.length) error = 'gedaempft';
  else if (buzz) error = 'schnarren';

  return {
    clean: !error,
    error,
    missing,
    extra,
    heard: best.name,
    advance: !!next && simNext > 0.78 && simNext > simExpected + 0.08,
    missingNames: missing.map(pc => NOTE_NAMES[pc]),
    extraNames: extra.map(pc => NOTE_NAMES[pc]),
  };
}
