// Lokale Datenbank (IndexedDB). Struktur entspricht dem Supabase-Schema,
// damit später eine Cloud-Synchronisation ohne Umbau möglich ist.
const DB_NAME = 'gitarrencoach';
const DB_VERSION = 2;
const STORES = ['songs', 'sessions', 'setup_checks', 'posture_samples', 'finger_events', 'calibrations'];

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: 'id' });
          if (['setup_checks', 'posture_samples', 'finger_events'].includes(name)) store.createIndex('session_id', 'session_id');
          if (name === 'sessions') store.createIndex('started_at', 'started_at');
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export const uuid = () =>
  (crypto.randomUUID ? crypto.randomUUID() :
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    }));

function tx(storeNames, mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(storeNames, mode);
    let result;
    Promise.resolve(fn(t)).then(r => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

const reqP = req => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

export function put(store, obj) {
  if (!obj.id) obj.id = uuid();
  return tx([store], 'readwrite', t => { t.objectStore(store).put(obj); return obj; });
}

export function putMany(store, list) {
  if (!list.length) return Promise.resolve();
  return tx([store], 'readwrite', t => {
    const s = t.objectStore(store);
    for (const o of list) { if (!o.id) o.id = uuid(); s.put(o); }
  });
}

export function getAll(store) {
  return tx([store], 'readonly', t => reqP(t.objectStore(store).getAll()));
}

export function remove(store, id) {
  return tx([store], 'readwrite', t => { t.objectStore(store).delete(id); });
}

export async function deleteSession(id) {
  await tx(STORES.filter(s => s !== 'songs'), 'readwrite', async t => {
    t.objectStore('sessions').delete(id);
    for (const name of ['setup_checks', 'posture_samples', 'finger_events']) {
      const idx = t.objectStore(name).index('session_id');
      const keys = await reqP(idx.getAllKeys(id));
      for (const k of keys) t.objectStore(name).delete(k);
    }
  });
}

export async function exportAll() {
  const out = { app: 'gitarrencoach', version: DB_VERSION, exported_at: new Date().toISOString() };
  for (const s of STORES) out[s] = await getAll(s);
  return out;
}

export async function importAll(data) {
  for (const s of STORES) if (Array.isArray(data[s])) await putMany(s, data[s]);
}

export async function clearAll() {
  await tx(STORES, 'readwrite', t => { for (const s of STORES) t.objectStore(s).clear(); });
}

// Ruft beim Browser dauerhaften Speicher ab, damit Daten nicht automatisch gelöscht werden
export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
  } catch (e) {}
  return false;
}

// Die zuletzt gespeicherte Kalibrierung ist die gültige
export async function latestCalibration() {
  const all = await getAll('calibrations');
  return all.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0] || null;
}
