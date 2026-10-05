import * as db from './db.js';
import { parseChord, parseChordList, chordDiagramSVG, stringsForPitchClass, STRING_LABELS, NOTE_NAMES } from './chords.js';
import { AudioAnalyzer, evaluateStrum } from './audio.js';
import {
  getPoseLandmarker, getHandLandmarker, poseMetrics, postureIssues, POSTURE_HINTS, POSTURE_CATEGORIES,
  setupChecks, frameBrightness, pickHand, fingerIssues, drawPose, drawHand,
} from './vision.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

// ---------- Einstellungen ----------
const settings = {
  get leftHanded() { return safeGet('hand') === 'left'; },
  get voice() { return safeGet('voice') !== 'off'; },
};
function safeGet(k) { try { return localStorage.getItem('gc_' + k); } catch { return null; } }
function safeSet(k, v) { try { localStorage.setItem('gc_' + k, v); } catch {} }

$('#handedness').value = settings.leftHanded ? 'left' : 'right';
$('#voice').checked = settings.voice;
$('#handedness').addEventListener('change', e => safeSet('hand', e.target.value));
$('#voice').addEventListener('change', e => safeSet('voice', e.target.checked ? 'on' : 'off'));
db.requestPersistence();

// ---------- Navigation ----------
function show(id) {
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  window.scrollTo(0, 0);
  if (id === 'songs') renderSongs();
  if (id === 'history') renderHistory();
}
$$('[data-go]').forEach(b => b.addEventListener('click', () => {
  const t = b.dataset.go;
  if (t === 'posture') startSession('haltung', null);
  else show(t);
}));

// ---------- Hilfsfunktionen ----------
const grade = pct => Math.round(Math.min(6, Math.max(1, 1 + (100 - pct) / 12)) * 10) / 10;
const fmtGrade = g => g == null ? '–' : g.toFixed(1).replace('.', ',');
const gradeWord = g => g <= 1.5 ? 'sehr gut' : g <= 2.5 ? 'gut' : g <= 3.5 ? 'befriedigend' : g <= 4.5 ? 'ausreichend' : 'da geht noch was';
const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let lastSpoken = { text: '', at: 0 };
function speak(text) {
  if (!settings.voice || !('speechSynthesis' in window)) return;
  const now = Date.now();
  if (now - lastSpoken.at < 6000 || (text === lastSpoken.text && now - lastSpoken.at < 15000)) return;
  lastSpoken = { text, at: now };
  const u = new SpeechSynthesisUtterance(text.replace(/–/g, ','));
  u.lang = 'de-DE';
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

function setHint(text, kind) {
  const h = $('#hint');
  h.textContent = text || '';
  h.className = 'hint' + (text ? ' show ' + kind : '');
}

// ---------- Lieder ----------
async function renderSongs() {
  const songs = (await db.getAll('songs')).sort((a, b) => a.title.localeCompare(b.title, 'de'));
  const ul = $('#songList');
  ul.innerHTML = `<li class="song free"><button class="pick" data-song="">
      <b>Freies Spiel</b><small>Nur Fingerhaltung, ohne Akkordprüfung</small></button></li>` +
    songs.map(s => `<li class="song"><button class="pick" data-song="${s.id}">
      <b>${esc(s.title)}</b><small>${esc(s.artist ? s.artist + ': ' : '')}${esc(s.chords.join(' '))}</small></button>
      <button class="del" data-del="${s.id}" aria-label="${esc(s.title)} löschen">Löschen</button></li>`).join('');
  ul.querySelectorAll('[data-song]').forEach(b => b.addEventListener('click', () => {
    const song = songs.find(s => s.id === b.dataset.song) || null;
    startSession('finger', song);
  }));
  ul.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Lied löschen? Die Auswertungen bleiben erhalten.')) return;
    await db.remove('songs', b.dataset.del);
    renderSongs();
  }));
}

$('#songForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  const title = f.songTitle.value.trim();
  const { chords, invalid } = parseChordList(f.chords.value);
  const err = $('#songError');
  if (!title) { err.textContent = 'Gib dem Lied einen Titel.'; return; }
  if (!chords.length) { err.textContent = 'Trag mindestens einen Akkord ein, z. B. G D Em C.'; return; }
  if (invalid.length) { err.textContent = `Diese Akkorde kenne ich nicht: ${invalid.join(', ')}`; return; }
  err.textContent = '';
  await db.put('songs', { title, artist: f.artist.value.trim() || null, chords, created_at: new Date().toISOString() });
  f.reset();
  f.closest('details').open = false;
  renderSongs();
});

// ---------- Übung ----------
const video = $('#video');
const overlay = $('#overlay');
const octx = overlay.getContext('2d');
const tiny = Object.assign(document.createElement('canvas'), { width: 32, height: 32 });

let S = null; // aktuelle Einheit

async function startSession(mode, song) {
  // Audio sofort beim Tippen anlegen, sonst blockiert iOS den Ton
  let audio = null;
  if (mode === 'finger' && song) {
    audio = new AudioAnalyzer(r => onStrum(r));
    try { audio.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
  }

  S = {
    id: db.uuid(), mode, song, audio,
    chords: song ? song.chords.map(parseChord) : [],
    idx: 0,
    phase: 'setup', okSince: 0, calib: [], base: null,
    startedAt: null, lastFrameTime: -1, frame: 0, brightness: 0.5,
    counts: {}, badSince: {}, lastSeen: performance.now(),
    sample: null, samples: [], events: [], setupRecord: null,
    recentHandIssue: { key: null, at: 0 }, strumMsgUntil: 0,
    facing: 'user', raf: 0, wakeLock: null,
  };

  show('session');
  $('#modeLabel').textContent = mode === 'haltung' ? 'Haltung' : (song ? song.title : 'Fingerspiel');
  $('#clock').textContent = '0:00';
  $('#chordPanel').hidden = !song;
  $('#micLevel').hidden = !song;
  $('#setupPanel').hidden = false;
  $('#setupTitle').textContent = 'Aufstellung prüfen';
  $('#strumMsg').textContent = '';
  setHint('', '');

  const loading = $('#loading');
  loading.hidden = false;
  try {
    $('#loadingMsg').textContent = 'Kamera wird gestartet …';
    await startCamera();
    $('#loadingMsg').textContent = 'Erkennung wird geladen …';
    S.detector = mode === 'haltung' ? await getPoseLandmarker() : await getHandLandmarker();
    if (audio) {
      $('#loadingMsg').textContent = 'Mikrofon wird gestartet …';
      await audio.start();
    }
  } catch (err) {
    loading.hidden = true;
    stopMedia();
    alert(startError(err));
    show('home');
    S = null;
    return;
  }
  loading.hidden = true;
  try { S.wakeLock = await navigator.wakeLock?.request('screen'); } catch {}
  if (song) renderChordPanel();
  S.raf = requestAnimationFrame(loop);
}

function startError(err) {
  const n = err && err.name;
  if (n === 'NotAllowedError') return 'Kamera oder Mikrofon wurde nicht erlaubt. Erlaube den Zugriff in den Browser-Einstellungen und versuch es erneut.';
  if (n === 'NotFoundError') return 'Keine Kamera oder kein Mikrofon gefunden.';
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return 'Kamera geht nur über eine https-Adresse. Öffne die App über ihren https-Link.';
  return 'Die Erkennung konnte nicht geladen werden. Prüfe die Internetverbindung und versuch es erneut.\n\n' + (err && err.message || '');
}

async function startCamera() {
  if (S.stream) S.stream.getTracks().forEach(t => t.stop());
  S.stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: S.facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
  });
  video.srcObject = S.stream;
  await video.play();
  $('#stage').classList.toggle('mirror', S.facing === 'user');
}

$('#flipCam').addEventListener('click', async () => {
  if (!S) return;
  S.facing = S.facing === 'user' ? 'environment' : 'user';
  try { await startCamera(); } catch { S.facing = 'user'; await startCamera(); }
});

function stopMedia() {
  if (!S) return;
  cancelAnimationFrame(S.raf);
  if (S.stream) S.stream.getTracks().forEach(t => t.stop());
  if (S.audio) S.audio.stop();
  if (S.wakeLock) S.wakeLock.release().catch(() => {});
  video.srcObject = null;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

function loop() {
  S.raf = requestAnimationFrame(loop);
  if (video.readyState < 2 || video.currentTime === S.lastFrameTime) return;
  S.lastFrameTime = video.currentTime;
  const w = video.videoWidth, h = video.videoHeight;
  if (overlay.width !== w) { overlay.width = w; overlay.height = h; }
  if (S.frame++ % 15 === 0) S.brightness = frameBrightness(video, tiny);
  const now = performance.now();

  if (S.startedAt) $('#clock').textContent = fmtTime((Date.now() - S.startedAt) / 1000);
  if (S.audio) $('#micLevel i').style.width = Math.min(100, S.audio.level * 600) + '%';

  if (S.mode === 'haltung') postureFrame(now, w, h);
  else fingerFrame(now, w, h);
}

// ----- Haltungsmodus -----
function postureFrame(now, w, h) {
  const res = S.detector.detectForVideo(video, now);
  const lm = res.landmarks && res.landmarks[0];
  const aspect = w / h;

  if (S.phase === 'setup') {
    drawPose(octx, lm, w, h, null, settings.leftHanded);
    const checks = setupChecks(lm, aspect, S.brightness);
    renderChecks(checks);
    const allOk = checks.every(c => c.ok);
    if (!allOk) { S.okSince = 0; $('#setupMsg').textContent = checks.find(c => !c.ok).hint; return; }
    S.okSince ||= now;
    $('#setupMsg').textContent = 'Passt. Gleich geht es los …';
    if (now - S.okSince > 1500) {
      const sw = Math.abs(lm[11].x - lm[12].x);
      S.setupRecord = {
        session_id: S.id, shoulder_width_px: Math.round(sw * w),
        camera_angle_deg: Math.round(Math.abs(lm[11].z - lm[12].z) * 100) / 100,
        brightness: Math.round(S.brightness * 100) / 100, all_visible: true, passed: true,
      };
      S.phase = 'calib'; S.calibStart = now;
      $('#setupTitle').textContent = 'Kalibrieren';
      $('#checkList').innerHTML = '';
      $('#setupMsg').textContent = 'Sitz 3 Sekunden ruhig in deiner Spielhaltung: Schultern locker, Blick geradeaus.';
      speak('Sitz drei Sekunden ruhig, Schultern locker, Blick geradeaus.');
    }
    return;
  }

  if (S.phase === 'calib') {
    drawPose(octx, lm, w, h, null, settings.leftHanded);
    if (lm) S.calib.push(poseMetrics(lm, aspect, settings.leftHanded));
    const left = Math.ceil((3000 - (now - S.calibStart)) / 1000);
    $('#setupTitle').textContent = `Kalibrieren … ${Math.max(left, 0)}`;
    if (now - S.calibStart > 3000 && S.calib.length > 5) {
      const avg = k => S.calib.reduce((a, m) => a + m[k], 0) / S.calib.length;
      S.base = { earShL: avg('earShL'), earShR: avg('earShR'), tilt: avg('tilt'), headDrop: avg('headDrop') };
      beginRun();
    }
    return;
  }

  // Laufende Analyse
  if (!lm) {
    drawPose(octx, null, w, h);
    if (now - S.lastSeen > 2000) setHint('Ich sehe dich nicht – rück zurück ins Bild', 'info');
    return;
  }
  S.lastSeen = now;
  const m = poseMetrics(lm, aspect, settings.leftHanded);
  const issues = postureIssues(m, S.base);
  drawPose(octx, lm, w, h, issues, settings.leftHanded);

  for (const [cat, keys] of Object.entries(POSTURE_CATEGORIES)) {
    const vals = keys.map(k => issues[k]).filter(v => v !== null);
    if (!vals.length) continue;
    const c = S.counts[cat] ||= { ok: 0, bad: 0 };
    vals.some(Boolean) ? c.bad++ : c.ok++;
  }
  updatePersistentHint(issues, POSTURE_HINTS, now);
  collectSample(m, issues, now);
}

function collectSample(m, issues, now) {
  const s = S.sample ||= { start: now, n: 0, ok: 0, sums: {}, cnt: {} };
  s.n++;
  if (!Object.values(issues).some(v => v === true)) s.ok++;
  const shoulderRaise = Math.min(m.earShL / S.base.earShL, m.earShR / S.base.earShR);
  const vals = { wristFret: m.wristFret, wristStrum: m.wristStrum, shoulderRaise, headTilt: m.headDrop - S.base.headDrop, elbowFret: m.elbowFret };
  for (const [k, v] of Object.entries(vals)) if (v !== null && isFinite(v)) { s.sums[k] = (s.sums[k] || 0) + v; s.cnt[k] = (s.cnt[k] || 0) + 1; }
  if (now - s.start >= 5000) flushSample();
}

function flushSample() {
  const s = S.sample;
  if (!s || !s.n) return;
  const a = k => s.cnt[k] ? Math.round(s.sums[k] / s.cnt[k] * 100) / 100 : null;
  S.samples.push({
    session_id: S.id, t_offset_s: Math.round((Date.now() - S.startedAt) / 1000),
    wrist_fret_deg: a('wristFret'), wrist_strum_deg: a('wristStrum'), shoulder_raise: a('shoulderRaise'),
    head_tilt_deg: a('headTilt'), elbow_fret_deg: a('elbowFret'), posture_ok: s.ok / s.n >= 0.7,
  });
  S.sample = null;
}

// Hinweis erst zeigen, wenn ein Problem 1,5 s anhält – sonst flackert es
function updatePersistentHint(issues, texts, now) {
  let worst = null, longest = 0;
  for (const [k, bad] of Object.entries(issues)) {
    if (bad) { S.badSince[k] ||= now; const d = now - S.badSince[k]; if (d > longest) { longest = d; worst = k; } }
    else delete S.badSince[k];
  }
  if (now < S.strumMsgUntil) return;
  if (worst && longest > 1500) { setHint(texts[worst], 'bad'); speak(texts[worst]); }
  else if (!worst) setHint(S.mode === 'haltung' ? 'Haltung gut' : 'Hand locker – weiter so', 'good');
}

function renderChecks(checks) {
  $('#checkList').innerHTML = checks.map(c => `<li class="${c.ok ? 'ok' : ''}">${esc(c.label)}</li>`).join('');
}

function beginRun() {
  S.phase = 'run';
  S.startedAt = Date.now();
  $('#setupPanel').hidden = true;
  setHint('Los geht’s', 'good');
  speak('Los geht’s');
}

// ----- Fingermodus -----
const FINGER_HINTS = {};
function fingerFrame(now, w, h) {
  const res = S.detector.detectForVideo(video, now);
  const hand = pickHand(res);

  if (S.phase === 'setup') {
    drawHand(octx, hand, w, h, []);
    const checks = [
      { label: 'Licht', ok: S.brightness > 0.22, hint: 'Zu dunkel – mehr Licht machen' },
      { label: 'Greifhand im Bild', ok: !!hand, hint: 'Kamera nah an die Greifhand, Griffbrett und Finger im Bild' },
    ];
    renderChecks(checks);
    const allOk = checks.every(c => c.ok);
    if (!allOk) { S.okSince = 0; $('#setupMsg').textContent = checks.find(c => !c.ok).hint; return; }
    S.okSince ||= now;
    $('#setupMsg').textContent = 'Passt. Gleich geht es los …';
    if (now - S.okSince > 1200) {
      S.setupRecord = { session_id: S.id, shoulder_width_px: null, camera_angle_deg: null,
        brightness: Math.round(S.brightness * 100) / 100, all_visible: true, passed: true };
      beginRun();
    }
    return;
  }

  const issues = hand ? fingerIssues(hand) : [];
  drawHand(octx, hand, w, h, issues);
  if (!hand) { if (now - S.lastSeen > 2000 && now > S.strumMsgUntil) setHint('Greifhand nicht im Bild', 'info'); return; }
  S.lastSeen = now;
  const c = S.counts.fingerhaltung ||= { ok: 0, bad: 0 };
  issues.length ? c.bad++ : c.ok++;
  if (issues.length) S.recentHandIssue = { key: issues[0].key, at: now };
  const flags = {};
  for (const is of issues) { flags[is.key] = true; FINGER_HINTS[is.key] = is.text; }
  for (const k of Object.keys(FINGER_HINTS)) flags[k] ||= false;
  updatePersistentHint(flags, FINGER_HINTS, now);
}

function renderChordPanel(highlight = []) {
  const cur = S.chords[S.idx], next = S.chords[(S.idx + 1) % S.chords.length];
  $('#chordNow').textContent = cur.name;
  $('#chordNext').textContent = S.chords.length > 1 ? next.name : '';
  $('#diagram').innerHTML = chordDiagramSVG(cur, highlight);
}

function onStrum(sound) {
  if (!S || S.phase !== 'run' || !S.chords.length) return;
  const n = S.chords.length;
  let cur = S.chords[S.idx];
  const next = n > 1 ? S.chords[(S.idx + 1) % n] : null;
  let r = evaluateStrum(sound, cur, next);
  if (r.advance) {
    S.idx = (S.idx + 1) % n;
    cur = S.chords[S.idx];
    r = evaluateStrum(sound, cur, n > 1 ? S.chords[(S.idx + 1) % n] : null);
  }

  const now = performance.now();
  const handIssueRecent = now - S.recentHandIssue.at < 1500 ? S.recentHandIssue.key : null;
  let affected = [], cause = null, msg;

  if (r.clean) {
    msg = `${cur.name} sauber`;
  } else if (r.error === 'gedaempft') {
    affected = r.missing.flatMap(pc => stringsForPitchClass(cur.shape, pc));
    const where = affected.length ? STRING_LABELS[affected[0]] : `Ton ${r.missingNames[0]}`;
    cause = handIssueRecent === 'finger_flach' ? 'finger_flach' : 'beruehrt_nachbarsaite';
    msg = `${where} klingt nicht. ` + (cause === 'finger_flach'
      ? 'Ein Finger liegt flach und dämpft sie – Kuppe steiler aufsetzen.'
      : 'Finger steil aufsetzen, Nachbarsaite nicht berühren.');
  } else if (r.error === 'falscher_ton') {
    cause = 'falscher_bund_oder_saite';
    msg = `Ton ${r.extraNames[0]} gehört nicht zu ${cur.name} – Griff im Bild vergleichen.`;
  } else if (r.error === 'falscher_akkord') {
    cause = 'falscher_griff';
    msg = `Klang eher nach ${r.heard} statt ${cur.name}.`;
  } else if (r.error === 'schnarren') {
    cause = 'zu_weit_vom_bund';
    msg = 'Es schnarrt – Finger näher ans Bundstäbchen, etwas fester drücken.';
  }

  S.events.push({
    session_id: S.id, t_offset_s: Math.round((Date.now() - S.startedAt) / 1000),
    chord: cur.name, clean: r.clean, error_type: r.error,
    affected_string: affected.length ? 6 - affected[0] : null, likely_cause: cause,
  });

  renderChordPanel(affected);
  const el = $('#strumMsg');
  el.textContent = msg;
  el.className = 'strummsg ' + (r.clean ? 'ok' : 'bad');
  if (!r.clean) {
    S.strumMsgUntil = now + 2500;
    setHint(msg, 'bad');
    speak(msg);
  }
}

// ----- Beenden und auswerten -----
$('#stopBtn').addEventListener('click', endSession);

async function endSession() {
  if (!S) return;
  stopMedia();
  if (S.phase !== 'run') { S = null; show('home'); return; }
  if (S.sample) flushSample();

  const details = {};
  for (const [cat, c] of Object.entries(S.counts)) {
    const tot = c.ok + c.bad;
    if (tot > 30) details[cat] = { note: grade(100 * c.ok / tot), ok_prozent: Math.round(100 * c.ok / tot) };
  }
  if (S.events.length) {
    const clean = S.events.filter(e => e.clean).length;
    details.sauberkeit = { note: grade(100 * clean / S.events.length), ok_prozent: Math.round(100 * clean / S.events.length) };
    const per = {};
    for (const e of S.events) { const p = per[e.chord] ||= { versuche: 0, sauber: 0 }; p.versuche++; if (e.clean) p.sauber++; }
    details.akkorde = per;
  }
  const notes = Object.values(details).map(d => d.note).filter(x => typeof x === 'number');
  const total = notes.length ? Math.round(notes.reduce((a, b) => a + b, 0) / notes.length * 10) / 10 : null;

  S.result = {
    id: S.id, mode: S.mode, song_id: S.song ? S.song.id : null, song_title: S.song ? S.song.title : null,
    started_at: new Date(S.startedAt).toISOString(), ended_at: new Date().toISOString(),
    score_total: total, score_details: details, pain_after: null, notes: null,
    created_at: new Date().toISOString(),
  };
  // Sofort speichern, damit nichts verloren geht, auch wenn die App geschlossen wird
  await db.put('sessions', S.result);
  if (S.setupRecord) await db.put('setup_checks', S.setupRecord);
  await db.putMany('posture_samples', S.samples);
  await db.putMany('finger_events', S.events);
  renderResult();
  show('result');
}

const CAT_LABELS = { handgelenk: 'Handgelenke', schulter: 'Schultern', kopf: 'Kopfhaltung', fingerhaltung: 'Fingerhaltung', sauberkeit: 'Saubere Akkorde' };

function renderResult() {
  const r = S.result;
  $('#gradeTotal').textContent = fmtGrade(r.score_total);
  $('#gradeWord').textContent = r.score_total == null ? 'zu kurz für eine Note' : gradeWord(r.score_total);
  $('#gradeDetails').innerHTML = Object.entries(r.score_details)
    .filter(([k]) => k !== 'akkorde')
    .map(([k, d]) => `<dt>${CAT_LABELS[k] || k}</dt><dd>${fmtGrade(d.note)} <small>${d.ok_prozent} % gut</small></dd>`).join('');
  const ak = r.score_details.akkorde;
  $('#chordResults').innerHTML = ak ? `<div class="tablewrap"><table><tr><th>Akkord</th><th>Anschläge</th><th>sauber</th></tr>${
    Object.entries(ak).map(([c, p]) => `<tr><td>${esc(c)}</td><td>${p.versuche}</td><td>${Math.round(100 * p.sauber / p.versuche)} %</td></tr>`).join('')
  }</table></div>` : '';
  $('#pain').value = 0; $('#painOut').textContent = '0'; $('#notes').value = '';
}

$('#pain').addEventListener('input', e => { $('#painOut').textContent = e.target.value; });
$('#saveResult').addEventListener('click', async () => {
  S.result.pain_after = Number($('#pain').value);
  S.result.notes = $('#notes').value.trim() || null;
  await db.put('sessions', S.result);
  S = null;
  show('history');
});
$('#discardResult').addEventListener('click', async () => {
  if (!confirm('Diese Einheit wirklich löschen?')) return;
  await db.deleteSession(S.result.id);
  S = null;
  show('home');
});

// ---------- Verlauf ----------
async function renderHistory() {
  const sessions = (await db.getAll('sessions')).filter(s => s.score_total != null)
    .sort((a, b) => a.started_at.localeCompare(b.started_at));
  const events = await db.getAll('finger_events');

  $('#chart').innerHTML = sessions.length < 2
    ? '<p class="empty">Nach zwei Einheiten siehst du hier deinen Notenverlauf.</p>'
    : chartSVG(sessions);

  const per = {};
  for (const e of events) {
    const p = per[e.chord] ||= { n: 0, clean: 0, errs: {} };
    p.n++; if (e.clean) p.clean++; else if (e.error_type) p.errs[e.error_type] = (p.errs[e.error_type] || 0) + 1;
  }
  const ERR = { gedaempft: 'Saite gedämpft', falscher_ton: 'falscher Ton', falscher_akkord: 'falscher Griff', schnarren: 'Schnarren' };
  const rows = Object.entries(per).sort((a, b) => a[1].clean / a[1].n - b[1].clean / b[1].n);
  $('#chordStats').innerHTML = rows.length
    ? `<tr><th>Akkord</th><th>Anschläge</th><th>sauber</th><th>häufigster Fehler</th></tr>` + rows.map(([c, p]) => {
      const top = Object.entries(p.errs).sort((a, b) => b[1] - a[1])[0];
      return `<tr><td>${esc(c)}</td><td>${p.n}</td><td>${Math.round(100 * p.clean / p.n)} %</td><td>${top ? ERR[top[0]] || top[0] : '–'}</td></tr>`;
    }).join('')
    : '<tr><td class="empty">Noch keine Akkorde geübt.</td></tr>';

  const list = [...sessions].reverse();
  $('#sessionList').innerHTML = list.length ? list.map(s => {
    const d = new Date(s.started_at);
    const dur = s.ended_at ? fmtTime((new Date(s.ended_at) - d) / 1000) : '';
    const what = s.mode === 'haltung' ? 'Haltung' : (s.song_title ? `Finger: ${esc(s.song_title)}` : 'Finger: freies Spiel');
    const pain = s.pain_after != null ? `, Schmerz ${s.pain_after}/10` : '';
    return `<li><div>${what}<small>${d.toLocaleDateString('de-DE')} ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}, ${dur} min${pain}</small></div>
      <span class="g">${fmtGrade(s.score_total)}</span><button data-delsession="${s.id}">Löschen</button></li>`;
  }).join('') : '<li class="empty">Noch keine Einheiten. Starte eine Übung auf der Startseite.</li>';
  $$('[data-delsession]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Einheit löschen?')) return;
    await db.deleteSession(b.dataset.delsession);
    renderHistory();
  }));
}

function chartSVG(sessions) {
  const W = 600, H = 240, L = 34, R = 10, T = 14, B = 34;
  const n = sessions.length;
  const x = i => L + (n === 1 ? 0 : i * (W - L - R) / (n - 1));
  const y = g => T + (g - 1) / 5 * (H - T - B);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Notenverlauf">`;
  for (let g = 1; g <= 6; g++) s += `<line class="axis" x1="${L}" x2="${W - R}" y1="${y(g)}" y2="${y(g)}"/><text x="${L - 8}" y="${y(g) + 4}" text-anchor="end">${g}</text>`;
  for (const mode of ['haltung', 'finger']) {
    const pts = sessions.map((ss, i) => ss.mode === mode ? `${x(i)},${y(ss.score_total)}` : null).filter(Boolean);
    if (pts.length) {
      s += `<polyline class="l-${mode}" fill="none" stroke-width="2.5" points="${pts.join(' ')}"/>`;
      for (const p of pts) { const [px, py] = p.split(','); s += `<circle cx="${px}" cy="${py}" r="3.5" class="l-${mode}" fill="var(--rosewood)" stroke-width="2"/>`; }
    }
  }
  const first = new Date(sessions[0].started_at).toLocaleDateString('de-DE');
  const last = new Date(sessions[n - 1].started_at).toLocaleDateString('de-DE');
  s += `<text x="${L}" y="${H - 6}">${first}</text><text x="${W - R}" y="${H - 6}" text-anchor="end">${last}</text></svg>`;
  return s + `<div class="legend"><span><i style="background:var(--spruce)"></i>Haltung</span><span><i style="background:var(--good)"></i>Fingerspiel</span></div>`;
}

// ---------- Export / Import ----------
function download(name, text, type) {
  const blob = new Blob([text], { type });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function toCSV(rows) {
  if (!rows.length) return '';
  const cols = [...new Set(rows.flatMap(r => Object.keys(r)))];
  const cell = v => {
    if (v == null) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // Semikolon als Trenner, damit Excel mit deutscher Einstellung es direkt öffnet
  return '\ufeff' + [cols.join(';'), ...rows.map(r => cols.map(c => cell(r[c])).join(';'))].join('\n');
}
$$('[data-export]').forEach(b => b.addEventListener('click', async () => {
  const kind = b.dataset.export;
  const stamp = new Date().toISOString().slice(0, 10);
  if (kind === 'json') download(`gitarrencoach-${stamp}.json`, JSON.stringify(await db.exportAll(), null, 2), 'application/json');
  else {
    const rows = await db.getAll(kind);
    if (!rows.length) { alert('Dazu gibt es noch keine Daten.'); return; }
    download(`gitarrencoach-${kind}-${stamp}.csv`, toCSV(rows), 'text/csv');
  }
}));
$('#importFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'gitarrencoach') throw new Error('Keine Gitarrencoach-Datei');
    await db.importAll(data);
    alert('Daten importiert.');
    renderHistory();
  } catch (err) { alert('Import fehlgeschlagen: ' + err.message); }
  e.target.value = '';
});
$('#wipe').addEventListener('click', async () => {
  if (!confirm('Alle Einheiten, Lieder und Messwerte endgültig löschen? Exportiere sie vorher, wenn du sie behalten willst.')) return;
  await db.clearAll();
  renderHistory();
});

// Beim Verlassen der App laufende Einheit sauber beenden
document.addEventListener('visibilitychange', () => {
  if (document.hidden && S && S.phase === 'run') endSession();
});

// Offline-Fähigkeit nach dem ersten Laden
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
