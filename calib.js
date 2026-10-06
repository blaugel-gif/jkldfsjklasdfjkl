// Kalibrierungsmodus: führt durch Ruhehaltung und absichtliche Fehlstellungen,
// leitet daraus persönliche Grenzwerte ab und erzeugt eine Datei zum Auswerten.
import { METRIC_KEYS, FAULTS } from './vision.js';

export const CALIB_STEPS = [
  { key: 'neutral_normal', group: 'neutral', dur: 6,
    title: 'Deine normale Haltung',
    instr: 'Setz dich so hin, wie du normalerweise spielst, und spiel ein paar Akkorde. Nichts verstellen.' },
  { key: 'neutral_nah', group: 'neutral', dur: 5, move: true,
    title: 'Dasselbe, aber näher',
    instr: 'Stell das Handy etwa einen Schritt näher heran. Sitz und spiel genau wie eben.' },
  { key: 'neutral_weit', group: 'neutral', dur: 5, move: true,
    title: 'Dasselbe, aber weiter weg',
    instr: 'Stell das Handy jetzt zwei Schritte weiter weg als eben. Sitz und spiel genau wie vorher.' },
  { key: 'neutral_zurueck', group: 'neutral', dur: 5, move: true,
    title: 'Zurück zum normalen Abstand',
    instr: 'Stell das Handy wieder dorthin, wo du sonst übst. Ab jetzt bleibt es da stehen.' },
  { key: 'schulter_hoch', fault: 'schulter_hoch', dur: 4,
    title: 'Fehler zeigen: Schultern hoch',
    instr: 'Zieh beide Schultern deutlich hoch Richtung Ohren und halte sie oben.' },
  { key: 'handgelenk_greif', fault: 'handgelenk_greif', dur: 4,
    title: 'Fehler zeigen: Greifhand abgeknickt',
    instr: 'Knick das Handgelenk der Greifhand stark ab, so verkrampft wie möglich.' },
  { key: 'handgelenk_anschlag', fault: 'handgelenk_anschlag', dur: 4,
    title: 'Fehler zeigen: Anschlaghand abgeknickt',
    instr: 'Jetzt die andere Hand: Handgelenk der Anschlaghand stark abknicken.' },
  { key: 'kopf_vor', fault: 'kopf_vor', dur: 4,
    title: 'Fehler zeigen: Kopf über dem Griffbrett',
    instr: 'Beug den Kopf weit nach vorn und unten, als wolltest du jeden Bund genau sehen.' },
  { key: 'rundruecken', fault: 'rundruecken', dur: 4,
    title: 'Fehler zeigen: Rundrücken',
    instr: 'Lass den Oberkörper nach vorn zusammensacken, Rücken rund.' },
  { key: 'seitlich', fault: 'seitlich', dur: 4,
    title: 'Fehler zeigen: zur Seite gekippt',
    instr: 'Kipp den Oberkörper deutlich zu einer Seite, wie wenn du die Gitarre schief hältst.' },
  { key: 'ellbogen', fault: 'ellbogen', dur: 4,
    title: 'Fehler zeigen: Ellbogen abgespreizt',
    instr: 'Spreiz den Ellbogen deiner Greifhand weit vom Körper weg.' },
  { key: 'neutral_ende', group: 'neutral', dur: 5,
    title: 'Zum Schluss: wieder normal',
    instr: 'Noch einmal deine normale, entspannte Spielhaltung. Danach bist du fertig.' },
];

// Welche Messwerte für welchen Fehler infrage kommen
const CANDIDATES = {
  schulter_hoch: ['shoulderRaise', 'shoulderProtract'],
  handgelenk_greif: ['fretWristTotal', 'fretWristFlex', 'fretWristDev'],
  handgelenk_anschlag: ['strumWristTotal', 'strumWristFlex', 'strumWristDev'],
  kopf_vor: ['headDrop', 'headForward'],
  rundruecken: ['torsoLean', 'shoulderProtract', 'headForward'],
  seitlich: ['torsoSide', 'shoulderTilt'],
  ellbogen: ['fretElbowFlare', 'fretElbowAngle', 'fretHandHeight'],
};

export function stats(values) {
  const v = values.filter(x => typeof x === 'number' && isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
  const q = p => v[Math.min(v.length - 1, Math.floor(p * v.length))];
  return { n: v.length, mean: r3(mean), sd: r3(sd), p10: r3(q(0.1)), p50: r3(q(0.5)), p90: r3(q(0.9)), min: r3(v[0]), max: r3(v[v.length - 1]) };
}
const r3 = x => Math.round(x * 1000) / 1000;

// Fasst die Rohframes je Schritt zusammen
export function summarize(frames) {
  const out = {};
  for (const [key, list] of Object.entries(frames)) {
    const s = { frames: list.length, metrics: {} };
    for (const k of METRIC_KEYS) {
      const st = stats(list.map(f => f[k]));
      if (st) s.metrics[k] = st;
    }
    out[key] = s;
  }
  return out;
}

// Leitet persönliche Grenzwerte ab: Mitte zwischen Ruhehaltung und absichtlichem Fehler
export function deriveRules(summary) {
  const neutralSteps = CALIB_STEPS.filter(s => s.group === 'neutral' && summary[s.key]).map(s => s.key);
  if (!neutralSteps.length) return { rules: [], neutral: {}, report: [] };

  const neutral = {};
  for (const k of METRIC_KEYS) {
    const parts = neutralSteps.map(s => summary[s].metrics[k]).filter(Boolean);
    if (!parts.length) continue;
    const n = parts.reduce((a, p) => a + p.n, 0);
    const mean = parts.reduce((a, p) => a + p.mean * p.n, 0) / n;
    // Streuung inklusive der Unterschiede zwischen den Abständen
    const varWithin = parts.reduce((a, p) => a + p.sd ** 2 * p.n, 0) / n;
    const varBetween = parts.reduce((a, p) => a + (p.mean - mean) ** 2 * p.n, 0) / n;
    neutral[k] = { mean: r3(mean), sd: r3(Math.sqrt(varWithin + varBetween)), sdWithin: r3(Math.sqrt(varWithin)), sdBetween: r3(Math.sqrt(varBetween)), n };
  }

  const rules = [], report = [];
  for (const step of CALIB_STEPS.filter(s => s.fault)) {
    const s = summary[step.key];
    const base = neutral;
    if (!s) { report.push({ fault: step.fault, status: 'übersprungen' }); continue; }
    let best = null;
    for (const metric of CANDIDATES[step.fault] || []) {
      const f = s.metrics[metric], b = base[metric];
      if (!f || !b) continue;
      const diff = f.mean - b.mean;
      const score = Math.abs(diff) / (b.sd + 1e-6);
      if (!best || score > best.score) best = { metric, diff: r3(diff), score: r3(score), neutralSd: b.sd, neutralMean: b.mean, faultMean: f.mean };
    }
    if (!best) { report.push({ fault: step.fault, status: 'keine Daten' }); continue; }
    if (best.score < 2.5) {
      report.push({ fault: step.fault, status: 'zu schwaches Signal', ...best });
      continue;
    }
    const delta = Math.max(Math.abs(best.diff) * 0.5, best.neutralSd * 2.5);
    rules.push({ fault: step.fault, metric: best.metric, dir: Math.sign(best.diff) || 1, delta: r3(delta) });
    report.push({ fault: step.fault, status: 'erkannt', ...best, delta: r3(delta) });
  }
  return { rules, neutral, report };
}

export function buildExport({ frames, summary, derived, meta }) {
  return {
    app: 'gitarrencoach',
    kind: 'kalibrierung',
    schema: 2,
    created_at: new Date().toISOString(),
    meta,
    steps: CALIB_STEPS.map(s => ({ key: s.key, title: s.title, group: s.group || null, fault: s.fault || null, recorded: !!frames[s.key] })),
    summary,
    neutral: derived.neutral,
    rules: derived.rules,
    report: derived.report,
    faults: Object.fromEntries(Object.entries(FAULTS).map(([k, v]) => [k, v.hint])),
    metric_keys: METRIC_KEYS,
    raw: Object.fromEntries(Object.entries(frames).map(([k, list]) => [k, list.map(f => METRIC_KEYS.map(m => f[m] === undefined || !isFinite(f[m]) ? null : Math.round(f[m] * 1000) / 1000))])),
    raw_columns: METRIC_KEYS,
  };
}
