import * as SQLite from 'expo-sqlite';

let _db = null;

async function getDB() {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('musiclog.db');
  await _db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      energy INTEGER NOT NULL,
      duration INTEGER,
      wins TEXT,
      tomorrow_focus TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS segments (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT,
      group_name TEXT,
      composition_id TEXT,
      section TEXT,
      duration INTEGER,
      notes TEXT,
      challenges TEXT,
      progress TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS compositions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      composer TEXT,
      status TEXT NOT NULL DEFAULT 'learning',
      grade TEXT,
      key_root TEXT,
      key_mode TEXT,
      time_sig TEXT,
      info TEXT,
      kerrin_notes TEXT,
      my_notes TEXT,
      created_at TEXT NOT NULL
    );
  `);
  return _db;
}

// ─── SESSIONS ───────────────────────────────────────────────────────────────

export async function getAllSessions() {
  const db = await getDB();
  const sessions = await db.getAllAsync(
    'SELECT * FROM sessions ORDER BY date DESC, created_at DESC'
  );
  const result = [];
  for (const s of sessions) {
    const segments = await db.getAllAsync(
      'SELECT * FROM segments WHERE session_id = ?',
      [s.id]
    );
    result.push({
      ...s,
      tomorrowFocus: s.tomorrow_focus,
      createdAt: s.created_at,
      segments: segments.map(seg => ({
        ...seg,
        groupName: seg.group_name,
        compositionId: seg.composition_id,
        challenges: seg.challenges ? JSON.parse(seg.challenges) : [],
        progress: seg.progress ? JSON.parse(seg.progress) : [],
      })),
    });
  }
  return result;
}

export async function saveSession(session) {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO sessions
       (id, date, energy, duration, wins, tomorrow_focus, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      session.id,
      session.date,
      session.energy,
      session.duration || null,
      session.wins || null,
      session.tomorrowFocus || null,
      session.createdAt || new Date().toISOString(),
    ]
  );
  // Replace segments
  await db.runAsync('DELETE FROM segments WHERE session_id = ?', [session.id]);
  for (const seg of session.segments || []) {
    await db.runAsync(
      `INSERT INTO segments
         (id, session_id, type, title, group_name, composition_id,
          section, duration, notes, challenges, progress)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        seg.id,
        session.id,
        seg.type,
        seg.title || null,
        seg.group || null,
        seg.compositionId || null,
        seg.section || null,
        seg.duration ? Number(seg.duration) : null,
        seg.notes || null,
        JSON.stringify(seg.challenges || []),
        JSON.stringify(seg.progress || []),
      ]
    );
  }
}

export async function deleteSession(id) {
  const db = await getDB();
  await db.runAsync('DELETE FROM sessions WHERE id = ?', [id]);
}

// ─── COMPOSITIONS ────────────────────────────────────────────────────────────

export async function getAllCompositions() {
  const db = await getDB();
  const rows = await db.getAllAsync(
    'SELECT * FROM compositions ORDER BY title ASC'
  );
  return rows.map(r => ({
    id: r.id,
    title: r.title,
    composer: r.composer,
    status: r.status,
    grade: r.grade,
    keyRoot: r.key_root,
    keyMode: r.key_mode,
    timeSig: r.time_sig,
    info: r.info,
    kerrinNotes: r.kerrin_notes,
    myNotes: r.my_notes,
    createdAt: r.created_at,
  }));
}

export async function saveComposition(comp) {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO compositions
       (id, title, composer, status, grade, key_root, key_mode,
        time_sig, info, kerrin_notes, my_notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      comp.id,
      comp.title,
      comp.composer || null,
      comp.status || 'learning',
      comp.grade || null,
      comp.keyRoot || null,
      comp.keyMode || null,
      comp.timeSig || null,
      comp.info || null,
      comp.kerrinNotes || null,
      comp.myNotes || null,
      comp.createdAt || new Date().toISOString(),
    ]
  );
}

export async function deleteComposition(id) {
  const db = await getDB();
  await db.runAsync('DELETE FROM compositions WHERE id = ?', [id]);
}
