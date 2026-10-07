// Speichert App und Erkennungsmodelle nach dem ersten Laden, damit sie auch offline starten
const CACHE = 'gitarrencoach-v5';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'db.js', 'chords.js', 'audio.js', 'vision.js', 'calib.js', 'listen.js', 'songbook.js', 'manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const external = /(cdn\.jsdelivr\.net|storage\.googleapis\.com|fonts\.(googleapis|gstatic)\.com)$/.test(url.hostname);
  if (external) {
    // Bibliothek und Modelle ändern sich nicht: erst Cache, sonst Netz
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
  } else if (url.origin === location.origin) {
    // Eigene Dateien: Netz zuerst (für Updates), bei Funkloch aus dem Cache
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
    }).catch(() => caches.match(req)));
  }
});
