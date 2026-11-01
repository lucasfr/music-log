// Web: IndexedDB only — expo-sqlite is never imported on web

// One connection for the life of the page. Every read and write used to open a new one and never close
// it, which leaves them open until the browser collects them, and an open connection from an older tab
// would block a future schema upgrade. When the browser asks this one to close (another tab is upgrading)
// or it is closed under us, it is dropped, so the next call opens a fresh one. A failed open is not kept
// either (private browsing can refuse it), so it is tried again next time.
let dbPromise = null;

function openIDB() {
  if (dbPromise) return dbPromise;
  const p = new Promise((resolve, reject) => {
    const req = indexedDB.open('musiclog', 3);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('sessions'))     db.createObjectStore('sessions',     { keyPath: 'id' });
      if (!db.objectStoreNames.contains('compositions')) db.createObjectStore('compositions', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('lessons'))      db.createObjectStore('lessons',      { keyPath: 'id' });
    };
    req.onsuccess = e => {
      const db = e.target.result;
      db.onversionchange = () => { db.close(); if (dbPromise === p) dbPromise = null; };
      db.onclose         = () => { if (dbPromise === p) dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
  p.catch(() => { if (dbPromise === p) dbPromise = null; });
  dbPromise = p;
  return p;
}

async function idbGetAll(store) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function idbPut(store, item) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readwrite').objectStore(store).put(item);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

async function idbDelete(store, id) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readwrite').objectStore(store).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

export async function getAllSessions() {
  const rows = await idbGetAll('sessions');
  return rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}
export async function saveSession(session)   { await idbPut('sessions', session); }
export async function deleteSession(id)      { await idbDelete('sessions', id); }

export async function getAllCompositions() {
  const rows = await idbGetAll('compositions');
  return rows.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
}
export async function saveComposition(comp)  { await idbPut('compositions', comp); }
export async function deleteComposition(id)  { await idbDelete('compositions', id); }

export async function getAllLessons() {
  const rows = await idbGetAll('lessons');
  return rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}
export async function saveLesson(lesson)     { await idbPut('lessons', lesson); }
export async function deleteLesson(id)       { await idbDelete('lessons', id); }

// Empties every store in one transaction: all of it empties, or none of it. Local only: to delete
// everywhere, use clearAllRecords in hooks.js, which also sends the deletes to Supabase.
export async function clearAllLocal() {
  const db = await openIDB();
  const stores = ['sessions', 'compositions', 'lessons'];
  await new Promise((resolve, reject) => {
    const tx = db.transaction(stores, 'readwrite');
    stores.forEach(s => tx.objectStore(s).clear());
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
    tx.onabort    = () => reject(tx.error);
  });
}
