// Web: IndexedDB only — expo-sqlite is never imported on web

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('musiclog', 3);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('sessions'))     db.createObjectStore('sessions',     { keyPath: 'id' });
      if (!db.objectStoreNames.contains('compositions')) db.createObjectStore('compositions', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('lessons'))      db.createObjectStore('lessons',      { keyPath: 'id' });
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = ()  => reject(req.error);
  });
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
