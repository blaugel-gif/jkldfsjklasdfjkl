// Akkord-Bibliothek: Namen einlesen, Töne bestimmen, Griffbilder zeichnen.
// Deutsche Schreibweise: H = h-Dur, B = b-Dur (englisch Bb).

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'B', 'H'];
const ROOTS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, H: 11, B: 10 };

const QUALITIES = {
  '': [0, 4, 7], 'dur': [0, 4, 7], 'maj': [0, 4, 7],
  'm': [0, 3, 7], 'moll': [0, 3, 7], 'min': [0, 3, 7],
  '7': [0, 4, 7, 10], 'maj7': [0, 4, 7, 11], 'm7': [0, 3, 7, 10],
  'sus2': [0, 2, 7], 'sus4': [0, 5, 7], 'sus': [0, 5, 7], '5': [0, 7],
  'dim': [0, 3, 6], 'add9': [0, 2, 4, 7], '6': [0, 4, 7, 9], 'm6': [0, 3, 7, 9],
};

// Saiten von 6 (tiefes E) bis 1 (hohes e); Tonklassen der Leersaiten
export const OPEN_STRINGS = [4, 9, 2, 7, 11, 4];
export const STRING_LABELS = ['tiefe E-Saite', 'A-Saite', 'D-Saite', 'G-Saite', 'H-Saite', 'hohe e-Saite'];

// Griffbilder: frets (null = nicht spielen), fingers (0 = leer), barre = Bund des Barrés
const SHAPES = {
  'C':     { frets: [null, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
  'C7':    { frets: [null, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0] },
  'Cmaj7': { frets: [null, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0] },
  'D':     { frets: [null, null, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
  'Dm':    { frets: [null, null, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
  'D7':    { frets: [null, null, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3] },
  'Dsus2': { frets: [null, null, 0, 2, 3, 0], fingers: [0, 0, 0, 1, 3, 0] },
  'Dsus4': { frets: [null, null, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 3, 4] },
  'E':     { frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
  'Em':    { frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
  'E7':    { frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0] },
  'Em7':   { frets: [0, 2, 0, 0, 0, 0], fingers: [0, 2, 0, 0, 0, 0] },
  'F':     { frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], barre: 1 },
  'Fmaj7': { frets: [null, null, 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0] },
  'G':     { frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
  'G7':    { frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] },
  'A':     { frets: [null, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
  'Am':    { frets: [null, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
  'A7':    { frets: [null, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0] },
  'Am7':   { frets: [null, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0] },
  'Asus2': { frets: [null, 0, 2, 2, 0, 0], fingers: [0, 0, 1, 2, 0, 0] },
  'Asus4': { frets: [null, 0, 2, 2, 3, 0], fingers: [0, 0, 1, 2, 3, 0] },
  'H7':    { frets: [null, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4] },
  'Hm':    { frets: [null, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1], barre: 2 },
  'Bm':    { frets: [null, 1, 3, 3, 2, 1], fingers: [0, 1, 3, 4, 2, 1], barre: 1 }, // b-Moll (deutsch)
};

// Liest einen Akkordnamen wie "Am", "Fis7", "G/H", "Bb" oder "Es"
export function parseChord(raw) {
  const name = raw.trim();
  const m = name.match(/^([A-Ha-h])(is|es|#|b)?([^/]*)(?:\/([A-Ha-h])(is|es|#|b)?)?$/);
  if (!m) return null;
  let root = rootValue(m[1], m[2]);
  let qualRaw = (m[3] || '').trim();
  // "Es" und "As": das s ist ein b-Vorzeichen, außer bei "sus"
  if (!m[2] && /^[EeAa]$/.test(m[1]) && /^s(?!us)/.test(qualRaw)) {
    root = (root + 11) % 12;
    qualRaw = qualRaw.slice(1);
  }
  const lower = qualRaw.toLowerCase();
  const qual = qualRaw === 'm' || lower === 'mi' ? 'm' : (qualRaw === 'M' ? '' : lower);
  const intervals = QUALITIES[qual];
  if (!intervals) return null;
  const tones = new Set(intervals.map(i => (root + i) % 12));
  if (m[4]) tones.add(rootValue(m[4], m[5]));
  const shapeKey = NOTE_NAMES[root] + normQualForShape(qual);
  return {
    name,
    root,
    quality: qual,
    tones: [...tones],
    shape: SHAPES[shapeKey] || (root === 10 && qual === 'm' ? SHAPES['Bm'] : null),
  };
}

function rootValue(letter, acc) {
  const L = letter.toUpperCase();
  let r = ROOTS[L];
  if (L === 'B' && acc === 'b') return 10; // englisch Bb = deutsch B
  if (acc === '#' || acc === 'is') r += 1;
  if (acc === 'b' || acc === 'es') r -= 1;
  return (r + 12) % 12;
}

function normQualForShape(q) {
  if (q === 'dur' || q === 'maj') return '';
  if (q === 'moll' || q === 'min') return 'm';
  if (q === 'sus') return 'sus4';
  return q;
}

export function parseChordList(text) {
  const parts = text.split(/[\s,;|–-]+/).filter(Boolean);
  const chords = [], invalid = [];
  for (const p of parts) (parseChord(p) ? chords : invalid).push(p);
  return { chords, invalid };
}

// Welche Saiten erzeugen im Griffbild eine bestimmte Tonklasse?
export function stringsForPitchClass(shape, pc) {
  if (!shape) return [];
  const out = [];
  shape.frets.forEach((f, i) => {
    if (f !== null && (OPEN_STRINGS[i] + f) % 12 === pc) out.push(i);
  });
  return out;
}

// Vergleichsschablonen für die Tonerkennung (alle Dur- und Moll-Akkorde)
export function templates() {
  const list = [];
  for (let r = 0; r < 12; r++) {
    list.push({ name: NOTE_NAMES[r], tones: [r, (r + 4) % 12, (r + 7) % 12] });
    list.push({ name: NOTE_NAMES[r] + 'm', tones: [r, (r + 3) % 12, (r + 7) % 12] });
  }
  return list;
}

// Griffbild als SVG. highlight = Liste von Saitenindizes (0 = tiefes E), die rot markiert werden
export function chordDiagramSVG(chord, highlight = []) {
  const shape = chord && chord.shape;
  const W = 150, H = 170, left = 22, top = 34, gapX = 21, gapY = 26, frets = 5;
  if (!shape) {
    return `<svg viewBox="0 0 ${W} ${H}" class="diagram" role="img" aria-label="Kein Griffbild für ${chord ? chord.name : ''}">
      <text x="${W / 2}" y="${H / 2}" text-anchor="middle" class="d-muted">kein Griffbild</text></svg>`;
  }
  const played = shape.frets.filter(f => f !== null && f > 0);
  const maxF = played.length ? Math.max(...played) : 0;
  const base = maxF > 4 ? Math.min(...played) : 1;
  let s = `<svg viewBox="0 0 ${W} ${H}" class="diagram" role="img" aria-label="Griffbild ${chord.name}">`;
  // Bünde
  for (let f = 0; f <= frets; f++) {
    const y = top + f * gapY;
    s += `<line x1="${left}" y1="${y}" x2="${left + gapX * 5}" y2="${y}" class="${f === 0 && base === 1 ? 'd-nut' : 'd-fret'}"/>`;
  }
  // Saiten
  for (let i = 0; i < 6; i++) {
    const x = left + i * gapX;
    const hl = highlight.includes(i);
    s += `<line x1="${x}" y1="${top}" x2="${x}" y2="${top + frets * gapY}" class="${hl ? 'd-string-hl' : 'd-string'}"/>`;
    const f = shape.frets[i];
    if (f === null) s += `<text x="${x}" y="${top - 10}" text-anchor="middle" class="d-mark">×</text>`;
    else if (f === 0) s += `<circle cx="${x}" cy="${top - 14}" r="5" class="${hl ? 'd-open-hl' : 'd-open'}"/>`;
  }
  if (base > 1) s += `<text x="${left - 8}" y="${top + gapY / 2 + 4}" text-anchor="end" class="d-mark">${base}</text>`;
  // Barré
  if (shape.barre) {
    const idx = shape.frets.map((f, i) => f === shape.barre ? i : -1).filter(i => i >= 0);
    const y = top + (shape.barre - base + 0.5) * gapY;
    s += `<rect x="${left + idx[0] * gapX - 7}" y="${y - 7}" width="${(idx[idx.length - 1] - idx[0]) * gapX + 14}" height="14" rx="7" class="d-dot"/>`;
  }
  // Fingerpunkte
  shape.frets.forEach((f, i) => {
    if (f === null || f === 0) return;
    const x = left + i * gapX, y = top + (f - base + 0.5) * gapY;
    const hl = highlight.includes(i);
    s += `<circle cx="${x}" cy="${y}" r="9" class="${hl ? 'd-dot-hl' : 'd-dot'}"/>`;
    if (shape.fingers[i]) s += `<text x="${x}" y="${y + 4}" text-anchor="middle" class="d-finger">${shape.fingers[i]}</text>`;
  });
  return s + '</svg>';
}
