// Körper- und Handerkennung mit MediaPipe sowie die daraus berechneten Haltungswerte
const MP_VERSION = '0.10.14';
const MP_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const POSE_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const HAND_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

let vision = null;
let poseLandmarker = null;
let handLandmarker = null;

async function loadVision() {
  if (vision) return vision;
  const mod = await import(`${MP_URL}/vision_bundle.mjs`);
  const fileset = await mod.FilesetResolver.forVisionTasks(`${MP_URL}/wasm`);
  vision = { mod, fileset };
  return vision;
}

export async function getPoseLandmarker() {
  if (poseLandmarker) return poseLandmarker;
  const { mod, fileset } = await loadVision();
  const opts = delegate => ({ baseOptions: { modelAssetPath: POSE_MODEL, delegate }, runningMode: 'VIDEO', numPoses: 1 });
  // Grafikchip bevorzugt, sonst Prozessor (manche Handys unterstützen GPU nicht)
  try { poseLandmarker = await mod.PoseLandmarker.createFromOptions(fileset, opts('GPU')); }
  catch { poseLandmarker = await mod.PoseLandmarker.createFromOptions(fileset, opts('CPU')); }
  return poseLandmarker;
}

export async function getHandLandmarker() {
  if (handLandmarker) return handLandmarker;
  const { mod, fileset } = await loadVision();
  const opts = delegate => ({ baseOptions: { modelAssetPath: HAND_MODEL, delegate }, runningMode: 'VIDEO', numHands: 2 });
  try { handLandmarker = await mod.HandLandmarker.createFromOptions(fileset, opts('GPU')); }
  catch { handLandmarker = await mod.HandLandmarker.createFromOptions(fileset, opts('CPU')); }
  return handLandmarker;
}

// ---------- Geometrie ----------
const P = { nose: 0, lEar: 7, rEar: 8, lSh: 11, rSh: 12, lEl: 13, rEl: 14, lWr: 15, rWr: 16, lPi: 17, rPi: 18, lIn: 19, rIn: 20 };

function v2(a, b, ar) { return { x: (b.x - a.x) * ar, y: b.y - a.y }; }
function len(v) { return Math.hypot(v.x, v.y); }
function angleBetween(u, w) {
  const d = (u.x * w.x + u.y * w.y) / (len(u) * len(w) || 1);
  return Math.acos(Math.max(-1, Math.min(1, d))) * 180 / Math.PI;
}
function angle3(a, b, c) {
  const u = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const w = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const d = (u.x * w.x + u.y * w.y + u.z * w.z) /
    ((Math.hypot(u.x, u.y, u.z) * Math.hypot(w.x, w.y, w.z)) || 1);
  return Math.acos(Math.max(-1, Math.min(1, d))) * 180 / Math.PI;
}
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: ((a.z || 0) + (b.z || 0)) / 2 });
const vis = (p, t = 0.5) => p && (p.visibility === undefined || p.visibility > t);

// Rohwerte der Körperhaltung aus einem Frame
export function poseMetrics(lm, aspect, leftHanded) {
  const fret = leftHanded
    ? { sh: lm[P.rSh], el: lm[P.rEl], wr: lm[P.rWr], pi: lm[P.rPi], in: lm[P.rIn] }
    : { sh: lm[P.lSh], el: lm[P.lEl], wr: lm[P.lWr], pi: lm[P.lPi], in: lm[P.lIn] };
  const strum = leftHanded
    ? { sh: lm[P.lSh], el: lm[P.lEl], wr: lm[P.lWr], pi: lm[P.lPi], in: lm[P.lIn] }
    : { sh: lm[P.rSh], el: lm[P.rEl], wr: lm[P.rWr], pi: lm[P.rPi], in: lm[P.rIn] };
  const sw = len(v2(lm[P.lSh], lm[P.rSh], aspect)) || 1e-6;

  const wristDev = arm => {
    if (!vis(arm.el) || !vis(arm.wr) || !vis(arm.pi, 0.3) || !vis(arm.in, 0.3)) return null;
    return angleBetween(v2(arm.el, arm.wr, aspect), v2(arm.wr, mid(arm.pi, arm.in), aspect));
  };
  const earMid = mid(lm[P.lEar], lm[P.rEar]);
  return {
    sw,
    earShL: (lm[P.lSh].y - lm[P.lEar].y) / sw,
    earShR: (lm[P.rSh].y - lm[P.rEar].y) / sw,
    tilt: Math.abs(lm[P.lSh].y - lm[P.rSh].y) / sw,
    headDrop: (lm[P.nose].y - earMid.y) / sw,
    wristFret: wristDev(fret),
    wristStrum: wristDev(strum),
    elbowFret: vis(fret.el) && vis(fret.wr)
      ? angleBetween(v2(fret.el, fret.sh, aspect), v2(fret.el, fret.wr, aspect)) : null,
  };
}

// Grenzwerte (relativ zur Kalibrierung, wo sinnvoll)
export const LIMITS = { wristFret: 40, wristStrum: 45, shoulderRaise: 0.82, tilt: 0.12, headDrop: 0.15 };

export const POSTURE_HINTS = {
  wristFret: 'Greifhand: Handgelenk gerader halten – Gitarrenhals etwas anheben',
  wristStrum: 'Anschlaghand: Handgelenk locker und gerade lassen',
  shoulderRaise: 'Schultern locker sinken lassen',
  tilt: 'Schultern waagerecht halten',
  headDrop: 'Kopf heben – nicht so tief aufs Griffbrett schauen',
};

export const POSTURE_CATEGORIES = {
  handgelenk: ['wristFret', 'wristStrum'],
  schulter: ['shoulderRaise', 'tilt'],
  kopf: ['headDrop'],
};

// Welche Probleme liegen in diesem Frame vor? null = nicht messbar
export function postureIssues(m, base) {
  const r = {};
  r.wristFret = m.wristFret === null ? null : m.wristFret > LIMITS.wristFret;
  r.wristStrum = m.wristStrum === null ? null : m.wristStrum > LIMITS.wristStrum;
  r.shoulderRaise = Math.min(m.earShL / base.earShL, m.earShR / base.earShR) < LIMITS.shoulderRaise;
  r.tilt = m.tilt > base.tilt + LIMITS.tilt;
  r.headDrop = m.headDrop > base.headDrop + LIMITS.headDrop;
  return r;
}

// ---------- Aufstellungs-Check ----------
export function setupChecks(lm, aspect, brightness) {
  const key = [P.nose, P.lEar, P.rEar, P.lSh, P.rSh, P.lEl, P.rEl, P.lWr, P.rWr];
  const checks = [];
  checks.push({ key: 'licht', label: 'Licht', ok: brightness > 0.22,
    hint: 'Zu dunkel – mehr Licht oder nicht mit dem Rücken zum Fenster sitzen' });
  if (!lm) {
    checks.push({ key: 'person', label: 'Person erkannt', ok: false, hint: 'Setz dich mit Gitarre vor die Kamera' });
    return checks;
  }
  const allVisible = key.every(i => vis(lm[i], 0.55));
  checks.push({ key: 'person', label: 'Kopf, Schultern, Arme, Hände sichtbar', ok: allVisible,
    hint: 'Nicht alles sichtbar – Handy weiter weg oder etwas höher stellen' });
  const sw = Math.abs(lm[P.lSh].x - lm[P.rSh].x);
  const nearEdge = key.some(i => lm[i].x < 0.03 || lm[i].x > 0.97 || lm[i].y < 0.02 || lm[i].y > 0.98);
  const tooClose = sw > 0.5 || nearEdge;
  const tooFar = sw < 0.15;
  checks.push({ key: 'abstand', label: 'Abstand', ok: !tooClose && !tooFar,
    hint: tooFar ? 'Zu weit weg – Handy näher heranstellen' : 'Zu nah – Handy weiter weg stellen' });
  const cx = (lm[P.lSh].x + lm[P.rSh].x) / 2;
  checks.push({ key: 'mitte', label: 'Mittig im Bild', ok: cx > 0.3 && cx < 0.7,
    hint: 'Nicht mittig – Handy etwas drehen, bis du in der Bildmitte bist' });
  const swA = Math.hypot((lm[P.lSh].x - lm[P.rSh].x) * aspect, lm[P.lSh].y - lm[P.rSh].y) || 1e-6;
  const dz = Math.abs(lm[P.lSh].z - lm[P.rSh].z) / swA;
  checks.push({ key: 'winkel', label: 'Kamera von vorn', ok: dz < 0.9,
    hint: 'Kamera zu seitlich – Handy frontaler aufstellen' });
  return checks;
}

export function frameBrightness(video, canvas) {
  const c = canvas.getContext('2d', { willReadFrequently: true });
  c.drawImage(video, 0, 0, 32, 32);
  const d = c.getImageData(0, 0, 32, 32).data;
  let s = 0;
  for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  return s / (d.length / 4) / 255;
}

// ---------- Finger ----------
const FINGERS = { zeigefinger: [5, 6, 7, 8], mittelfinger: [9, 10, 11, 12], ringfinger: [13, 14, 15, 16], 'kleiner Finger': [17, 18, 19, 20] };

// Wählt die größte Hand im Bild (die Greifhand, da die Kamera nah an ihr steht)
export function pickHand(result) {
  if (!result || !result.landmarks || !result.landmarks.length) return null;
  let best = -1, idx = 0;
  result.landmarks.forEach((h, i) => {
    const xs = h.map(p => p.x), ys = h.map(p => p.y);
    const a = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
    if (a > best) { best = a; idx = i; }
  });
  return { lm: result.landmarks[idx], world: result.worldLandmarks[idx] };
}

export function fingerIssues(hand) {
  const w = hand.world;
  const issues = [];
  const palm = Math.hypot(w[0].x - w[9].x, w[0].y - w[9].y, w[0].z - w[9].z) || 1e-6;
  const flat = [];
  for (const [name, [mcp, pip, dip, tip]] of Object.entries(FINGERS)) {
    const pipA = angle3(w[mcp], w[pip], w[dip]);
    const dipA = angle3(w[pip], w[dip], w[tip]);
    if (pipA < 150 && dipA > 172) flat.push(name);
  }
  if (flat.length) issues.push({ key: 'finger_flach', fingers: flat,
    text: `${cap(flat[0])} flach – Fingerkuppe steiler aufsetzen` });
  const pipP = angle3(w[17], w[18], w[19]), dipP = angle3(w[18], w[19], w[20]);
  const pinkyAway = Math.hypot(w[20].x - w[16].x, w[20].y - w[16].y, w[20].z - w[16].z) / palm;
  if (pipP > 160 && dipP > 160 && pinkyAway > 0.9)
    issues.push({ key: 'kleiner_finger_weg', text: 'Kleiner Finger: locker nah am Griffbrett halten' });
  return issues;
}

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// ---------- Zeichnen ----------
const POSE_LINKS = [
  [P.lSh, P.rSh, 'shoulder'], [P.lSh, P.lEl, 'l'], [P.lEl, P.lWr, 'l'], [P.rSh, P.rEl, 'r'], [P.rEl, P.rWr, 'r'],
  [P.lWr, P.lIn, 'lw'], [P.rWr, P.rIn, 'rw'], [P.lEar, P.nose, 'head'], [P.rEar, P.nose, 'head'],
];

export function drawPose(ctx, lm, w, h, issues, leftHanded) {
  ctx.clearRect(0, 0, w, h);
  if (!lm) return;
  const fretSide = leftHanded ? 'r' : 'l';
  const bad = seg => {
    if (!issues) return false;
    if (seg === 'shoulder') return issues.shoulderRaise || issues.tilt;
    if (seg === 'head') return issues.headDrop;
    if (seg === fretSide + 'w') return issues.wristFret;
    if (seg.endsWith('w')) return issues.wristStrum;
    return false;
  };
  ctx.lineCap = 'round';
  for (const [a, b, seg] of POSE_LINKS) {
    if (!vis(lm[a], 0.3) || !vis(lm[b], 0.3)) continue;
    ctx.strokeStyle = bad(seg) ? '#E0533D' : 'rgba(170, 220, 160, 0.9)';
    ctx.lineWidth = bad(seg) ? 9 : 5;
    ctx.beginPath();
    ctx.moveTo(lm[a].x * w, lm[a].y * h);
    ctx.lineTo(lm[b].x * w, lm[b].y * h);
    ctx.stroke();
  }
}

const HAND_LINKS = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];

export function drawHand(ctx, hand, w, h, issues) {
  ctx.clearRect(0, 0, w, h);
  if (!hand) return;
  const lm = hand.lm;
  const badPts = new Set();
  for (const is of issues || []) {
    if (is.key === 'finger_flach') for (const f of is.fingers) FINGERS[f].forEach(i => badPts.add(i));
    if (is.key === 'kleiner_finger_weg') [17, 18, 19, 20].forEach(i => badPts.add(i));
  }
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(170, 220, 160, 0.85)';
  for (const [a, b] of HAND_LINKS) {
    ctx.strokeStyle = badPts.has(a) && badPts.has(b) ? '#E0533D' : 'rgba(170, 220, 160, 0.85)';
    ctx.beginPath(); ctx.moveTo(lm[a].x * w, lm[a].y * h); ctx.lineTo(lm[b].x * w, lm[b].y * h); ctx.stroke();
  }
  for (let i = 0; i < lm.length; i++) {
    ctx.fillStyle = badPts.has(i) ? '#E0533D' : '#F3E6C8';
    ctx.beginPath(); ctx.arc(lm[i].x * w, lm[i].y * h, badPts.has(i) ? 7 : 4, 0, Math.PI * 2); ctx.fill();
  }
}
