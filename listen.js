// Freihändige Bedienung: Sprachbefehle über die Spracherkennung des Browsers,
// ersatzweise Klatschen über das Mikrofon. Beides nur für die Kalibrierung,
// damit du nicht zum Handy laufen musst.

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const speechSupported = () => !!SR;

// Befehle. Längere Wortgruppen stehen vorn, damit "wiederholen" nicht als "weiter" zählt.
const COMMANDS = [
  { cmd: 'back',   words: ['schritt zurück', 'zurück', 'zurueck', 'vorheriger', 'vorherigen'] },
  { cmd: 'repeat', words: ['wiederholen', 'wiederholung', 'wiederhol', 'noch mal', 'nochmal', 'nochmals'] },
  { cmd: 'skip',   words: ['überspringen', 'überspring', 'auslassen', 'weglassen', 'skip'] },
  { cmd: 'stop',   words: ['abbrechen', 'beenden', 'aufhören', 'stopp', 'stop'] },
  { cmd: 'go',     words: ['weiter', 'bereit', 'fertig', 'los geht', 'los', 'start', 'okay', 'ok', 'jetzt', 'ja'] },
];

const normalize = s => s.toLowerCase().replace(/[.,!?;:]/g, ' ').replace(/\s+/g, ' ').trim();

export function matchCommand(text) {
  const t = normalize(text);
  if (!t) return null;
  for (const { cmd, words } of COMMANDS) {
    for (const w of words) {
      // Nur als ganzes Wort, damit "weiterhin" oder "losgelöst" nicht auslösen
      if (new RegExp(`(^|\\s)${w}($|\\s)`).test(t)) return cmd;
    }
  }
  return null;
}

export class VoiceCommands {
  constructor(onCommand, onState) {
    this.onCommand = onCommand;
    this.onState = onState || (() => {});
    this.active = false;
    this.mutedUntil = 0;
    this.last = { cmd: null, at: 0 };
    this.restartTimer = null;
    this.rec = null;
  }

  start() {
    if (!SR || this.active) return false;
    this.active = true;
    this._open();
    return true;
  }

  _open() {
    if (!this.active) return;
    const rec = new SR();
    this.rec = rec;
    rec.lang = 'de-DE';
    rec.continuous = true;
    rec.interimResults = true;     // reagiert schneller als auf das Endergebnis zu warten
    rec.maxAlternatives = 3;

    rec.onresult = e => {
      if (performance.now() < this.mutedUntil) return;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        for (let a = 0; a < r.length; a++) {
          const cmd = matchCommand(r[a].transcript);
          if (cmd) { this._fire(cmd); return; }
        }
      }
    };
    rec.onerror = e => {
      // "no-speech" und "aborted" sind harmlos, danach startet die Erkennung neu
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.active = false;
        this.onState({ ok: false, reason: 'verweigert' });
      } else if (e.error === 'network') {
        this.onState({ ok: false, reason: 'offline' });
      }
    };
    rec.onend = () => {
      // Der Browser beendet die Erkennung nach Stille von selbst
      if (!this.active) return;
      clearTimeout(this.restartTimer);
      this.restartTimer = setTimeout(() => { try { this._open(); } catch {} }, 250);
    };

    try { rec.start(); this.onState({ ok: true }); }
    catch { this.onState({ ok: false, reason: 'start fehlgeschlagen' }); }
  }

  _fire(cmd) {
    const now = performance.now();
    // Zwischenergebnisse liefern denselben Befehl mehrfach
    if (this.last.cmd === cmd && now - this.last.at < 2000) return;
    this.last = { cmd, at: now };
    this.onCommand(cmd);
  }

  // Während die App selbst spricht, nicht auf das eigene Echo hören
  mute(ms) { this.mutedUntil = Math.max(this.mutedUntil, performance.now() + ms); }
  // Sobald die Ansage wirklich zu Ende ist, wieder zuhören
  release(ms) { this.mutedUntil = performance.now() + ms; }
  setPaused() {}   // Sprache darf auch während der Aufnahme hören

  stop() {
    this.active = false;
    clearTimeout(this.restartTimer);
    if (this.rec) { try { this.rec.abort(); } catch {} }
    this.rec = null;
  }
}

// Rückfallebene ohne Internet: zweimal Klatschen.
// Ein einzelner Impuls reicht nicht, sonst löst jeder Gitarrenanschlag aus.
const CLAP_MIN_GAP = 120;   // ms, kürzer ist dasselbe Geräusch
const CLAP_MAX_GAP = 700;   // ms, länger zählt als zwei getrennte Geräusche
const CLAP_DECAY_MS = 100;    // nach dieser Zeit muss der Impuls verklungen sein
const CLAP_DECAY_RATIO = 0.25; // auf höchstens ein Viertel des Spitzenwerts

export class ClapDetector {
  constructor(onClap) {
    this.onClap = onClap;
    this.mutedUntil = 0;
    this.paused = false;
    this.baseline = 0.004;
    this.lastOnset = 0;
    this.firstOnset = 0;
    this.pending = null;
    this.prev = 0;
    this.level = 0;
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    await this.ctx.resume();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0;
    src.connect(this.analyser);
    this.buf = new Float32Array(this.analyser.fftSize);
    this.timer = setInterval(() => this._tick(), 25);
    return true;
  }

  _tick() {
    this.analyser.getFloatTimeDomainData(this.buf);
    let sum = 0;
    for (let i = 0; i < this.buf.length; i += 4) sum += this.buf[i] * this.buf[i];
    const rms = Math.sqrt(sum / (this.buf.length / 4));
    this.level = rms;
    const now = performance.now();

    // Schritt 1: lauter Einsatz? Der kann vom Klatschen oder von der Gitarre kommen.
    const spike = rms > Math.max(this.baseline * 8, 0.05) && rms > this.prev * 3;
    if (spike && !this.paused && !this.pending && now > this.mutedUntil && now - this.lastOnset > CLAP_MIN_GAP) {
      this.pending = { at: now, peak: rms };
    }

    // Schritt 2: nur was sofort wieder verklingt, ist ein Klatschen.
    // Eine angeschlagene Saite klingt lange nach und fällt hier durch.
    if (this.pending) {
      this.pending.peak = Math.max(this.pending.peak, rms);
      if (now - this.pending.at >= CLAP_DECAY_MS) {
        const decayed = rms < this.pending.peak * CLAP_DECAY_RATIO;
        this.pending = null;
        if (decayed) {
          const gap = now - this.lastOnset;
          this.lastOnset = now;
          if (this.firstOnset && gap <= CLAP_MAX_GAP) {
            this.firstOnset = 0;
            this.mutedUntil = now + 900;   // nicht gleich noch einmal auslösen
            this.onClap();
          } else {
            this.firstOnset = now;         // erster Schlag, auf den zweiten warten
          }
        }
      }
    }

    if (this.firstOnset && now - this.firstOnset > CLAP_MAX_GAP) this.firstOnset = 0;
    if (rms < this.baseline * 3) this.baseline = this.baseline * 0.97 + rms * 0.03;
    this.prev = rms;
  }

  mute(ms) { this.mutedUntil = Math.max(this.mutedUntil, performance.now() + ms); }
  release(ms) { this.mutedUntil = performance.now() + ms; }
  setPaused(v) { this.paused = v; this.firstOnset = 0; this.pending = null; }

  stop() {
    clearInterval(this.timer);
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    if (this.ctx) this.ctx.close().catch(() => {});
  }
}
