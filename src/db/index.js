import { Platform } from 'react-native';

// ─── Web: IndexedDB ──────────────────────────────────────────────────────────

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('musiclog', 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('sessions'))     db.createObjectStore('sessions',     { keyPath: 'id' });
      if (!db.objectStoreNames.contains('compositions')) db.createObjectStore('compositions', { keyPath: 'id' });
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

// ─── Native: expo-sqlite ────────────────────────────────────────────────────

let _db = null;

async function getDB() {
  if (_db) return _db;
  const SQLite = await import('expo-sqlite');
  _db = await SQLite.openDatabaseAsync('musiclog.db');
  await _db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, date TEXT NOT NULL, energy INTEGER NOT NULL,
      duration INTEGER, wins TEXT, tomorrow_focus TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS segments (
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL, type TEXT NOT NULL,
      title TEXT, group_name TEXT, composition_id TEXT, section TEXT,
      duration INTEGER, notes TEXT, challenges TEXT, progress TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS compositions (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, composer TEXT, status TEXT NOT NULL DEFAULT 'learning',
      grade TEXT, key_root TEXT, key_mode TEXT, time_sig TEXT,
      info TEXT, kerrin_notes TEXT, my_notes TEXT, created_at TEXT NOT NULL
    );
  `);
  return _db;
}

// ─── SESSIONS ────────────────────────────────────────────────────────────────

export async function getAllSessions() {
  if (Platform.OS === 'web') {
    const rows = await idbGetAll('sessions');
    return rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  const db = await getDB();
  const sessions = await db.getAllAsync('SELECT * FROM sessions ORDER BY date DESC, created_at DESC');
  const result = [];
  for (const s of sessions) {
    const segments = await db.getAllAsync('SELECT * FROM segments WHERE session_id = ?', [s.id]);
    result.push({
      ...s,
      tomorrowFocus: s.tomorrow_focus,
      createdAt: s.created_at,
      segments: segments.map(seg => ({
        ...seg,
        group: seg.group_name,
        compositionId: seg.composition_id,
        challenges: seg.challenges ? JSON.parse(seg.challenges) : [],
        progress:   seg.progress   ? JSON.parse(seg.progress)   : [],
      })),
    });
  }
  return result;
}

export async function saveSession(session) {
  if (Platform.OS === 'web') {
    await idbPut('sessions', session);
    return;
  }

  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO sessions (id, date, energy, duration, wins, tomorrow_focus, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [session.id, session.date, session.energy, session.duration || null,
     session.wins || null, session.tomorrowFocus || null,
     session.createdAt || new Date().toISOString()]
  );
  await db.runAsync('DELETE FROM segments WHERE session_id = ?', [session.id]);
  for (const seg of session.segments || []) {
    await db.runAsync(
      `INSERT INTO segments (id, session_id, type, title, group_name, composition_id,
        section, duration, notes, challenges, progress)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [seg.id, session.id, seg.type, seg.title || null, seg.group || null,
       seg.compositionId || null, seg.section || null,
       seg.duration ? Number(seg.duration) : null, seg.notes || null,
       JSON.stringify(seg.challenges || []), JSON.stringify(seg.progress || [])]
    );
  }
}

export async function deleteSession(id) {
  if (Platform.OS === 'web') { await idbDelete('sessions', id); return; }
  const db = await getDB();
  await db.runAsync('DELETE FROM sessions WHERE id = ?', [id]);
}

// ─── COMPOSITIONS ────────────────────────────────────────────────────────────

export async function getAllCompositions() {
  if (Platform.OS === 'web') {
    const rows = await idbGetAll('compositions');
    return rows.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  }

  const db = await getDB();
  const rows = await db.getAllAsync('SELECT * FROM compositions ORDER BY title ASC');
  return rows.map(r => ({
    id: r.id, title: r.title, composer: r.composer, status: r.status,
    grade: r.grade, keyRoot: r.key_root, keyMode: r.key_mode, timeSig: r.time_sig,
    info: r.info, kerrinNotes: r.kerrin_notes, myNotes: r.my_notes, createdAt: r.created_at,
  }));
}

export async function saveComposition(comp) {
  if (Platform.OS === 'web') { await idbPut('compositions', comp); return; }

  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO compositions
       (id, title, composer, status, grade, key_root, key_mode,
        time_sig, info, kerrin_notes, my_notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [comp.id, comp.title, comp.composer || null, comp.status || 'learning',
     comp.grade || null, comp.keyRoot || null, comp.keyMode || null,
     comp.timeSig || null, comp.info || null, comp.kerrinNotes || null,
     comp.myNotes || null, comp.createdAt || new Date().toISOString()]
  );
}

export async function deleteComposition(id) {
  if (Platform.OS === 'web') { await idbDelete('compositions', id); return; }
  const db = await getDB();
  await db.runAsync('DELETE FROM compositions WHERE id = ?', [id]);
}
