// Körper- und Handerkennung mit MediaPipe und die daraus berechneten Haltungswerte.
// Alle Haltungswerte kommen aus den Weltkoordinaten (Meter, Ursprung zwischen den Hüften).
// Dadurch sind sie unabhängig davon, wie weit du von der Kamera entfernt sitzt.
const MP_VERSION = '0.10.14';
const MP_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const POSE_BASE = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker';
const POSE_FULL = `${POSE_BASE}/pose_landmarker_full/float16/1/pose_landmarker_full.task`;
const POSE_LITE = `${POSE_BASE}/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`;
const HAND_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

let vision = null, poseLandmarker = null, handLandmarker = null;
export let poseModelUsed = '';

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
  const opts = (model, delegate) => ({
    baseOptions: { modelAssetPath: model, delegate },
    runningMode: 'VIDEO', numPoses: 1,
    minPoseDetectionConfidence: 0.5, minTrackingConfidence: 0.5, minPosePresenceConfidence: 0.5,
  });
  // Genaueres Modell bevorzugt, bei Problemen das kleinere
  for (const [model, delegate, name] of [[POSE_FULL, 'GPU', 'full/GPU'], [POSE_FULL, 'CPU', 'full/CPU'], [POSE_LITE, 'GPU', 'lite/GPU'], [POSE_LITE, 'CPU', 'lite/CPU']]) {
    try {
      poseLandmarker = await mod.PoseLandmarker.createFromOptions(fileset, opts(model, delegate));
      poseModelUsed = name;
      return poseLandmarker;
    } catch (e) { if (model === POSE_LITE && delegate === 'CPU') throw e; }
  }
}

export async function getHandLandmarker() {
  if (handLandmarker) return handLandmarker;
  const { mod, fileset } = await loadVision();
  const opts = delegate => ({ baseOptions: { modelAssetPath: HAND_MODEL, delegate }, runningMode: 'VIDEO', numHands: 2 });
  try { handLandmarker = await mod.HandLandmarker.createFromOptions(fileset, opts('GPU')); }
  catch { handLandmarker = await mod.HandLandmarker.createFromOptions(fileset, opts('CPU')); }
  return handLandmarker;
}

// ---------- Bezugspunkte ----------
export const P = {
  nose: 0, lEye: 2, rEye: 5, lEar: 7, rEar: 8, lMouth: 9, rMouth: 10,
  lSh: 11, rSh: 12, lEl: 13, rEl: 14, lWr: 15, rWr: 16,
  lPi: 17, rPi: 18, lIn: 19, rIn: 20, lTh: 21, rTh: 22, lHip: 23, rHip: 24,
};
// Punkte, die für eine Auswertung sichtbar sein müssen
const NEEDED = [P.nose, P.lEar, P.rEar, P.lSh, P.rSh, P.lEl, P.rEl, P.lWr, P.rWr, P.lIn, P.rIn, P.lPi, P.rPi, P.lHip, P.rHip];

// ---------- Vektorrechnung ----------
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const len = a => Math.hypot(a.x, a.y, a.z);
const unit = a => { const l = len(a) || 1e-9; return scale(a, 1 / l); };
const mid = (a, b) => scale(add(a, b), 0.5);
const DEG = 180 / Math.PI;

function angle(a, b) {
  const d = dot(a, b) / ((len(a) * len(b)) || 1e-9);
  return Math.acos(Math.max(-1, Math.min(1, d))) * DEG;
}
// Winkel zwischen a und b, gemessen um die Achse axis (mit Vorzeichen)
function signedAngle(a, b, axis) {
  const n = unit(axis);
  const ap = sub(a, scale(n, dot(a, n)));
  const bp = sub(b, scale(n, dot(b, n)));
  if (len(ap) < 1e-6 || len(bp) < 1e-6) return 0;
  const ang = angle(ap, bp);
  return dot(cross(ap, bp), n) < 0 ? -ang : ang;
}

// ---------- Haltungswerte ----------
// world: Weltkoordinaten in Metern, image: Bildkoordinaten 0..1, aspect: Breite/Höhe
export function poseMetrics(world, image, aspect, leftHanded) {
  if (!world || !image) return null;
  const W = world;
  const shL = W[P.lSh], shR = W[P.rSh];
  const shMid = mid(shL, shR), hipMid = mid(W[P.lHip], W[P.rHip]);
  const earMid = mid(W[P.lEar], W[P.rEar]);
  const SW = len(sub(shL, shR)) || 1e-6;            // Schulterbreite in Metern
  const torso = sub(shMid, hipMid);                  // Rumpfachse (nach oben)
  const up = unit(torso);                            // Einheitsvektor nach oben
  const across = unit(sub(shL, shR));                 // Schulterachse
  const fwd = unit(cross(across, up));               // Blickrichtung des Rumpfs

  // Arm der Greifhand bzw. der Anschlaghand
  const side = s => ({ sh: W[P[s + 'Sh']], el: W[P[s + 'El']], wr: W[P[s + 'Wr']], pi: W[P[s + 'Pi']], in: W[P[s + 'In']], th: W[P[s + 'Th']] });
  const fret = side(leftHanded ? 'r' : 'l');
  const strum = side(leftHanded ? 'l' : 'r');

  const armValues = (arm, tag) => {
    const upper = sub(arm.el, arm.sh), fore = sub(arm.wr, arm.el);
    const handMid = mid(arm.in, arm.pi);
    const handVec = sub(handMid, arm.wr);
    const handAcross = sub(arm.in, arm.pi);
    const normal = cross(handVec, handAcross);     // steht senkrecht auf der Handfläche
    const o = {};
    o[tag + 'ElbowAngle'] = angle(sub(arm.sh, arm.el), sub(arm.wr, arm.el));
    o[tag + 'ElbowFlare'] = angle(upper, scale(up, -1));            // Abspreizen vom Rumpf
    o[tag + 'WristTotal'] = angle(fore, handVec);                   // Gesamtknick des Handgelenks
    o[tag + 'WristFlex'] = signedAngle(fore, handVec, handAcross);  // Beugen/Strecken
    o[tag + 'WristDev'] = signedAngle(fore, handVec, normal);       // seitliches Abknicken
    o[tag + 'HandHeight'] = dot(sub(arm.wr, arm.sh), up) / SW;      // Hand relativ zur Schulter
    o[tag + 'ThumbRise'] = dot(sub(arm.th, arm.wr), up) / SW;       // Daumen über dem Handgelenk
    o[tag + 'ShProtract'] = dot(sub(arm.sh, hipMid), fwd) / SW;     // Schulter nach vorn
    return o;
  };

  // Bildwerte: Lage im Bild und geschätzter Abstand
  const iL = image[P.lSh], iR = image[P.rSh];
  // Schulterbreite als Anteil der Bildbreite; y wird dafür in Bildbreiten umgerechnet
  const imgSW = Math.hypot(iL.x - iR.x, (iL.y - iR.y) / aspect) || 1e-6;
  // Halber Öffnungswinkel quer zur Bildbreite (Hochformat sieht schmaler)
  const tanHalf = Math.tan(33 * Math.PI / 180) * Math.min(1, aspect);
  const visible = NEEDED.map(i => image[i] && image[i].visibility !== undefined ? image[i].visibility : 1);

  return {
    shoulderWidth_m: SW,
    // Grobe Abstandsschätzung; ersetzt die Faustregel "Schultern im Bild"
    distance_m: SW / (2 * imgSW * tanHalf),
    distanceProxy: SW / imgSW,
    shoulderRaise: dot(sub(earMid, shMid), up) / SW,     // Ohr über Schulter: kleiner = Schultern hochgezogen
    shoulderTilt: signedAngle(across, unit({ x: across.x, y: 0, z: across.z }), fwd),
    shoulderProtract: (dot(sub(shL, hipMid), fwd) + dot(sub(shR, hipMid), fwd)) / 2 / SW,
    torsoLean: signedAngle(torso, { x: 0, y: -1, z: 0 }, across),   // nach vorn/hinten
    torsoSide: signedAngle(torso, { x: 0, y: -1, z: 0 }, fwd),      // zur Seite
    headForward: dot(sub(earMid, shMid), fwd) / SW,
    headDrop: dot(sub(W[P.nose], earMid), scale(up, -1)) / SW,      // Blick nach unten
    headTilt: signedAngle(sub(W[P.lEar], W[P.rEar]), across, fwd),  // Kopf seitlich geneigt
    ...armValues(fret, 'fret'),
    ...armValues(strum, 'strum'),
    visibility: visible.reduce((a, b) => a + b, 0) / visible.length,
    imgShoulderWidth: imgSW,
    imgCenterX: (iL.x + iR.x) / 2,
    imgCenterY: (iL.y + iR.y) / 2,
  };
}

export const METRIC_KEYS = [
  'shoulderRaise', 'shoulderTilt', 'shoulderProtract', 'torsoLean', 'torsoSide',
  'headForward', 'headDrop', 'headTilt',
  'fretElbowAngle', 'fretElbowFlare', 'fretWristTotal', 'fretWristFlex', 'fretWristDev', 'fretHandHeight', 'fretThumbRise', 'fretShProtract',
  'strumElbowAngle', 'strumElbowFlare', 'strumWristTotal', 'strumWristFlex', 'strumWristDev', 'strumHandHeight', 'strumThumbRise', 'strumShProtract',
  'shoulderWidth_m', 'distance_m', 'distanceProxy', 'visibility',
];

// ---------- Fehlstellungen ----------
// Jede Regel vergleicht einen Messwert mit der Ruhehaltung vom Sitzungsstart.
// abs = nur der Betrag der Abweichung zählt (Richtung unklar), sonst entscheidet dir.
export const CATEGORIES = { schulter: 'Schultern', handgelenk: 'Handgelenke', kopf: 'Kopfhaltung', ruecken: 'Rücken', arm: 'Arme' };

export const FAULTS = {
  schulter_hoch:       { category: 'schulter',   label: 'Schultern hochgezogen',        hint: 'Schultern locker sinken lassen' },
  handgelenk_greif:    { category: 'handgelenk', label: 'Greifhand abgeknickt',         hint: 'Greifhand: Handgelenk gerader halten – Gitarrenhals etwas anheben' },
  handgelenk_anschlag: { category: 'handgelenk', label: 'Anschlaghand abgeknickt',      hint: 'Anschlaghand: Handgelenk locker und gerade lassen' },
  kopf_vor:            { category: 'kopf',       label: 'Kopf über dem Griffbrett',     hint: 'Kopf heben – nicht so tief aufs Griffbrett schauen' },
  rundruecken:         { category: 'ruecken',    label: 'Rundrücken',                   hint: 'Aufrichten – Brustbein etwas anheben' },
  seitlich:            { category: 'ruecken',    label: 'Oberkörper zur Seite gekippt', hint: 'Gerade sitzen – du kippst zur Seite' },
  ellbogen:            { category: 'arm',        label: 'Ellbogen abgespreizt',         hint: 'Greifarm: Ellbogen näher an den Körper, nicht abspreizen' },
};

// Voreinstellung, solange keine eigene Kalibrierung vorliegt
export const DEFAULT_RULES = [
  { fault: 'schulter_hoch',       metric: 'shoulderRaise',  dir: -1, delta: 0.09 },
  { fault: 'handgelenk_greif',    metric: 'fretWristTotal', dir: 1,  delta: 16 },
  { fault: 'handgelenk_anschlag', metric: 'strumWristTotal', dir: 1, delta: 18 },
  { fault: 'kopf_vor',            metric: 'headDrop',       dir: 1,  delta: 0.11 },
  { fault: 'rundruecken',         metric: 'torsoLean',      abs: true, delta: 9 },
  { fault: 'seitlich',            metric: 'torsoSide',      abs: true, delta: 8 },
  { fault: 'ellbogen',            metric: 'fretElbowFlare', abs: true, delta: 14 },
];

// Prüft alle Regeln gegen den aktuellen Messwert
export function evaluateRules(rules, m, base) {
  const out = {};
  for (const r of rules) {
    const v = m[r.metric], b = base[r.metric];
    if (v === undefined || b === undefined || !isFinite(v) || !isFinite(b)) continue;
    out[r.fault] = r.abs ? Math.abs(v - b) > r.delta : (r.dir > 0 ? v > b + r.delta : v < b - r.delta);
  }
  return out;
}

// ---------- Aufstellungs-Check ----------
export function setupChecks(image, m, brightness) {
  const checks = [];
  checks.push({ key: 'licht', label: 'Licht', ok: brightness > 0.22,
    hint: 'Zu dunkel – mehr Licht machen oder nicht mit dem Rücken zum Fenster sitzen' });
  if (!image || !m) {
    checks.push({ key: 'person', label: 'Person erkannt', ok: false, hint: 'Setz dich mit Gitarre vor die Kamera' });
    return checks;
  }
  const allVisible = NEEDED.every(i => image[i] && (image[i].visibility === undefined || image[i].visibility > 0.5));
  const inFrame = NEEDED.every(i => image[i] && image[i].x > 0.02 && image[i].x < 0.98 && image[i].y > 0.02 && image[i].y < 0.98);
  checks.push({ key: 'person', label: 'Kopf, Schultern, Hüfte, Arme und Hände im Bild', ok: allVisible && inFrame,
    hint: 'Es ist nicht alles im Bild – Handy weiter weg oder höher stellen, am besten etwa auf Brusthöhe' });
  const d = m.distance_m;
  checks.push({ key: 'abstand', label: `Abstand ${d.toFixed(1).replace('.', ',')} m`, ok: d > 1.1 && d < 2.8,
    hint: d <= 1.1 ? 'Zu nah – stell das Handy etwa einen Schritt weiter weg' : 'Zu weit weg – stell das Handy etwas näher' });
  checks.push({ key: 'mitte', label: 'Mittig im Bild', ok: m.imgCenterX > 0.28 && m.imgCenterX < 0.72,
    hint: 'Nicht mittig – dreh das Handy etwas, bis du in der Bildmitte bist' });
  checks.push({ key: 'winkel', label: 'Kamera von vorn', ok: Math.abs(m.headTilt) < 90 && Math.abs(m.shoulderTilt) < 55,
    hint: 'Kamera zu schräg – stell das Handy frontaler vor dich' });
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
const FINGERS = { Zeigefinger: [5, 6, 7, 8], Mittelfinger: [9, 10, 11, 12], Ringfinger: [13, 14, 15, 16], 'kleiner Finger': [17, 18, 19, 20] };

function angle3(a, b, c) { return angle(sub(a, b), sub(c, b)); }

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
  const w = hand.world, issues = [];
  const palm = len(sub(w[0], w[9])) || 1e-6;
  const flat = [];
  for (const [name, [mcp, pip, dip, tip]] of Object.entries(FINGERS)) {
    if (angle3(w[mcp], w[pip], w[dip]) < 150 && angle3(w[pip], w[dip], w[tip]) > 172) flat.push(name);
  }
  if (flat.length) issues.push({ key: 'finger_flach', fingers: flat, text: `${flat[0]} flach – Fingerkuppe steiler aufsetzen` });
  if (angle3(w[17], w[18], w[19]) > 160 && angle3(w[18], w[19], w[20]) > 160 && len(sub(w[20], w[16])) / palm > 0.9)
    issues.push({ key: 'kleiner_finger_weg', text: 'Kleiner Finger: locker nah am Griffbrett halten' });
  return issues;
}

// ---------- Zeichnen ----------
const POSE_LINKS = [
  [P.lSh, P.rSh, 'schulter'], [P.lHip, P.rHip, 'ruecken'],
  [P.lSh, P.lHip, 'ruecken'], [P.rSh, P.rHip, 'ruecken'],
  [P.lSh, P.lEl, 'arm_l'], [P.lEl, P.lWr, 'arm_l'], [P.rSh, P.rEl, 'arm_r'], [P.rEl, P.rWr, 'arm_r'],
  [P.lWr, P.lIn, 'hand_l'], [P.lWr, P.lPi, 'hand_l'], [P.lIn, P.lPi, 'hand_l'],
  [P.rWr, P.rIn, 'hand_r'], [P.rWr, P.rPi, 'hand_r'], [P.rIn, P.rPi, 'hand_r'],
  [P.lEar, P.nose, 'kopf'], [P.rEar, P.nose, 'kopf'],
];

export function drawPose(ctx, image, w, h, active, leftHanded) {
  ctx.clearRect(0, 0, w, h);
  if (!image) return;
  const cats = new Set();
  for (const [fault, on] of Object.entries(active || {})) if (on) cats.add(FAULTS[fault].category);
  const fretArm = leftHanded ? 'arm_r' : 'arm_l', fretHand = leftHanded ? 'hand_r' : 'hand_l';
  const bad = seg => {
    if (seg === 'schulter') return cats.has('schulter');
    if (seg === 'ruecken') return cats.has('ruecken');
    if (seg === 'kopf') return cats.has('kopf');
    if (seg === fretArm || seg === (leftHanded ? 'arm_l' : 'arm_r')) return cats.has('arm');
    if (seg.startsWith('hand')) return cats.has('handgelenk');
    return false;
  };
  ctx.lineCap = 'round';
  for (const [a, b, seg] of POSE_LINKS) {
    const pa = image[a], pb = image[b];
    if (!pa || !pb || (pa.visibility !== undefined && (pa.visibility < 0.3 || pb.visibility < 0.3))) continue;
    const isBad = bad(seg);
    ctx.strokeStyle = isBad ? '#E0533D' : 'rgba(170, 220, 160, 0.9)';
    ctx.lineWidth = isBad ? 9 : 5;
    ctx.beginPath(); ctx.moveTo(pa.x * w, pa.y * h); ctx.lineTo(pb.x * w, pb.y * h); ctx.stroke();
  }
  void fretHand;
}

const HAND_LINKS = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];

export function drawHand(ctx, hand, w, h, issues) {
  ctx.clearRect(0, 0, w, h);
  if (!hand) return;
  const lm = hand.lm, badPts = new Set();
  for (const is of issues || []) {
    if (is.key === 'finger_flach') for (const f of is.fingers) FINGERS[f].forEach(i => badPts.add(i));
    if (is.key === 'kleiner_finger_weg') [17, 18, 19, 20].forEach(i => badPts.add(i));
  }
  ctx.lineWidth = 4;
  for (const [a, b] of HAND_LINKS) {
    ctx.strokeStyle = badPts.has(a) && badPts.has(b) ? '#E0533D' : 'rgba(170, 220, 160, 0.85)';
    ctx.beginPath(); ctx.moveTo(lm[a].x * w, lm[a].y * h); ctx.lineTo(lm[b].x * w, lm[b].y * h); ctx.stroke();
  }
  for (let i = 0; i < lm.length; i++) {
    ctx.fillStyle = badPts.has(i) ? '#E0533D' : '#F3E6C8';
    ctx.beginPath(); ctx.arc(lm[i].x * w, lm[i].y * h, badPts.has(i) ? 7 : 4, 0, Math.PI * 2); ctx.fill();
  }
}
