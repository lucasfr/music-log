// Backup payloads and import planning. Pure (no React Native imports), so they're unit-tested in
// plain Node, see tests/backup.test.mjs.
//
// Why this is its own file: the JSON backup used to be written by hand-listing each field, so
//  - records carried no `id` and segments no `compositionId`: restoring a backup made every
//    record new (importing twice doubled your data) and cut every segment's link to its piece;
//  - anything not on the list (a piece's grade and tempo, a session's tomorrowFocus in the
//    all-data export, a lesson's ratings, ...) never made it into the file.
// Each record now carries its `id` and timestamps, and every field that has no name of its own in
// the file travels in `extra` under its local name. A field added to the app later is therefore
// backed up and restored without anyone remembering to edit this file (tests/backup.test.mjs
// checks that with a made-up field). Files from before this (version 1) still import.

export const BACKUP_VERSION = 2;

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// Local keys each exporter writes under a name of its own. Everything else goes in `extra`.
const SEGMENT_KEYS = new Set([
  'id', 'type', 'group', 'title', 'pieceName', 'compositionId', 'section', 'notes', 'duration',
  'feltDifficulty', 'liking', 'scales', 'octaves', 'articulation', 'tempo', 'feedback',
  'teacherFeedback', 'assignment', 'challenges', 'progress',
]);
const SESSION_KEYS = new Set(['id', 'date', 'duration', 'energy', 'enjoyment', 'wins', 'tomorrowFocus', 'segments', 'created_at', 'updated_at']);
const LESSON_KEYS = new Set(['id', 'date', 'duration', 'teacher', 'wins', 'segments', 'created_at', 'updated_at']);
const COMPOSITION_KEYS = new Set(['id', 'title', 'composer', 'status', 'keys', 'timeSigs', 'time_sigs', 'tempo', 'grade', 'notes', 'created_at', 'updated_at']);

function extrasOf(record, known) {
  const extra = {};
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined || known.has(key)) continue;
    extra[key] = value;
  }
  return Object.keys(extra).length ? extra : null;
}

const withExtra = (out, extra) => (extra ? { ...out, extra } : out);

// ─── Export ───────────────────────────────────────────────────────────────────

function exportSegment(seg, compName) {
  return withExtra({
    id:               seg.id              ?? null,
    type:             seg.type,
    group:            seg.group           || null,
    piece:            seg.compositionId ? compName(seg.compositionId) : (seg.title || seg.pieceName || null),
    title:            seg.title           ?? null,
    composition_id:   seg.compositionId   || null,
    section:          seg.section         || null,
    notes:            seg.notes           || null,
    duration_minutes: seg.duration        ?? null,
    difficulty:       seg.feltDifficulty  ?? null,
    liking:           seg.liking          ?? null,
    scales:           seg.scales          || null,
    octaves:          seg.octaves         || null,
    articulation:     seg.articulation    || null,
    tempo_bpm:        seg.tempo           ? Number(seg.tempo) : null,
    teacher_feedback: seg.feedback || seg.teacherFeedback || null,
    assignment:       seg.assignment      || null,
    challenge_tags:   seg.challenges      || [],
    progress_tags:    seg.progress        || [],
  }, extrasOf(seg, SEGMENT_KEYS));
}

function exportSession(s, compName) {
  return withExtra({
    id:               s.id         ?? null,
    date:             s.date,
    duration_minutes: s.duration   ?? null,
    energy:           s.energy     ?? null,
    enjoyment:        s.enjoyment  ?? null,
    wins:             s.wins       || null,
    tomorrow_focus:   s.tomorrowFocus || null,
    segments:         (s.segments || []).map(seg => exportSegment(seg, compName)),
    created_at:       s.created_at ?? null,
    updated_at:       s.updated_at ?? null,
  }, extrasOf(s, SESSION_KEYS));
}

function exportLesson(l, compName) {
  return withExtra({
    id:               l.id        ?? null,
    date:             l.date,
    duration_minutes: l.duration  ?? null,
    teacher:          l.teacher   || null,
    wins:             l.wins      || null,
    segments:         (l.segments || []).map(seg => exportSegment(seg, compName)),
    created_at:       l.created_at ?? null,
    updated_at:       l.updated_at ?? null,
  }, extrasOf(l, LESSON_KEYS));
}

function exportComposition(c) {
  return withExtra({
    id:         c.id        ?? null,
    title:      c.title,
    composer:   c.composer  || null,
    status:     c.status    || null,
    keys:       c.keys      || [],
    time_sigs:  c.timeSigs || c.time_sigs || [],
    tempo:      c.tempo     ?? null,
    grade:      c.grade     || null,
    notes:      c.notes     || null,
    created_at: c.created_at ?? null,
    updated_at: c.updated_at ?? null,
  }, extrasOf(c, COMPOSITION_KEYS));
}

const nameLookup = compositions => id => (compositions.find(c => c.id === id) || {}).title || id;

export function buildSessionPayload(session, compositions, now = new Date()) {
  return {
    exported_at: now.toISOString(),
    app: 'music.log',
    version: BACKUP_VERSION,
    session: exportSession(session, nameLookup(compositions)),
  };
}

export function buildAllPayload(sessions, lessons, compositions, now = new Date()) {
  const compName = nameLookup(compositions);
  return {
    exported_at: now.toISOString(),
    app: 'music.log',
    version: BACKUP_VERSION,
    sessions: [...sessions].sort((a, b) => a.date.localeCompare(b.date)).map(s => exportSession(s, compName)),
    lessons: [...lessons].sort((a, b) => a.date.localeCompare(b.date)).map(l => exportLesson(l, compName)),
    compositions: [...compositions].sort((a, b) => (a.title || '').localeCompare(b.title || '')).map(exportComposition),
  };
}

// ─── Import ───────────────────────────────────────────────────────────────────

function importSegment(seg) {
  const local = isObj(seg.extra) ? { ...seg.extra } : {};
  return Object.assign(local, {
    id:             seg.id || uuid(),
    type:           seg.type || 'repertoire',
    group:          seg.group || null,
    // Version 1 files only have `piece`; version 2 keeps the segment's own label in `title`.
    title:          'title' in seg ? (seg.title ?? null) : (seg.piece || null),
    compositionId:  seg.composition_id || seg.compositionId || null,
    section:        seg.section || null,
    notes:          seg.notes || null,
    duration:       seg.duration_minutes ?? seg.duration ?? null,
    feltDifficulty: seg.difficulty ?? seg.feltDifficulty ?? null,
    liking:         seg.liking ?? null,
    scales:         seg.scales || null,
    octaves:        seg.octaves || null,
    feedback:       seg.teacher_feedback || seg.teacherFeedback || seg.feedback || null,
    articulation:   seg.articulation || null,
    tempo:          seg.tempo_bpm ?? seg.tempo ?? null,
    assignment:     seg.assignment || null,
    challenges:     seg.challenge_tags || seg.challenges || [],
    progress:       seg.progress_tags || seg.progress || seg.progressTags || [],
  });
}

// `_generatedId` marks a record the file gave no id (a version 1 file), so the id is made up and
// can't be used to recognise it later; planImport matches such records by content instead.
function stamp(record, now) {
  return {
    created_at: record.created_at || now,
    updated_at: record.updated_at || now,
  };
}

function importSession(s, now) {
  return {
    ...(isObj(s.extra) ? s.extra : {}),
    id:        s.id || uuid(),
    date:      s.date,
    duration:  s.duration_minutes ?? s.duration ?? null,
    energy:    s.energy ?? null,
    enjoyment: s.enjoyment ?? null,
    wins:      s.wins || null,
    ...((s.tomorrow_focus || s.tomorrowFocus) ? { tomorrowFocus: s.tomorrow_focus || s.tomorrowFocus } : {}),
    segments:  (s.segments || []).map(importSegment),
    ...stamp(s, now),
    ...(s.id ? {} : { _generatedId: true }),
  };
}

function importLesson(l, now) {
  return {
    ...(isObj(l.extra) ? l.extra : {}),
    id:       l.id || uuid(),
    date:     l.date,
    duration: l.duration_minutes ?? l.duration ?? null,
    teacher:  l.teacher || null,
    wins:     l.wins || null,
    segments: (l.segments || []).map(importSegment),
    ...stamp(l, now),
    ...(l.id ? {} : { _generatedId: true }),
  };
}

function importComposition(c, now) {
  return {
    ...(isObj(c.extra) ? c.extra : {}),
    id:       c.id || uuid(),
    title:    c.title,
    composer: c.composer || null,
    status:   c.status || null,
    keys:     c.keys || [],
    timeSigs: c.time_sigs || c.timeSigs || [],
    notes:    c.notes || null,
    ...(c.tempo != null && c.tempo !== '' ? { tempo: c.tempo } : {}),
    ...(c.grade ? { grade: c.grade } : {}),
    ...stamp(c, now),
    ...(c.id ? {} : { _generatedId: true }),
  };
}

// Parses a music.log export and returns { sessions, lessons, compositions } as local records.
// Nothing is saved or compared with what's on the device here; see planImport.
export function parseImportJSON(json, now = new Date().toISOString()) {
  let data;
  try {
    data = typeof json === 'string' ? JSON.parse(json) : json;
  } catch {
    throw new Error('Invalid JSON — could not parse file.');
  }
  if (!data || typeof data !== 'object') throw new Error('Unrecognised format.');

  // A single-session export has `session` rather than `sessions`.
  const sessionsIn = data.sessions || (data.session ? [data.session] : []);
  return {
    sessions:     sessionsIn.map(s => importSession(s, now)),
    lessons:      (data.lessons || []).map(l => importLesson(l, now)),
    compositions: (data.compositions || []).map(c => importComposition(c, now)),
  };
}

// ─── Deciding what an import should save ──────────────────────────────────────

const norm = v => String(v ?? '').trim().toLowerCase();
const ts = r => new Date(r.updated_at || 0).getTime();
const newer = (a, b) => ts(a) > ts(b);

const compKey = c => `${norm(c.title)}~${norm(c.composer)}`;
const segSig = segs => (segs || []).map(g => norm(g.title || g.group)).join('|');
const sessionKey = s => [s.date, Number(s.duration) || 0, (s.segments || []).length, segSig(s.segments)].join('~');
const lessonKey = l => [l.date, norm(l.teacher), Number(l.duration) || 0, (l.segments || []).length, segSig(l.segments)].join('~');

function clean(record) {
  const { _generatedId, ...rest } = record; // eslint-disable-line no-unused-vars
  return rest;
}

// Compares what an import carries with what is already on the device and returns only what
// should be saved:
//  - a record whose id is already here is skipped, unless the file's copy is newer;
//  - a record from a version 1 file (no ids) is skipped when the same one is already here (same
//    date, length and segments; same title and composer for pieces), so importing an old backup
//    twice doesn't double everything;
//  - segments are pointed at the right piece: through the id of the piece already on the device
//    when the file's piece is the same one, and (version 1 files, which only named the piece) by
//    title when exactly one piece has that title.
// -> { sessions, lessons, compositions (to save), stats }
export function planImport(parsed, existing = {}) {
  const have = {
    sessions: existing.sessions || [],
    lessons: existing.lessons || [],
    compositions: existing.compositions || [],
  };
  const stats = {
    sessions: { added: 0, updated: 0, skipped: 0 },
    lessons: { added: 0, updated: 0, skipped: 0 },
    compositions: { added: 0, updated: 0, skipped: 0 },
    relinked: 0,
  };

  // Pieces first, so segments can be pointed at them.
  const idMap = new Map(); // id in the file -> id to use
  const compsToSave = [];
  const compById = new Map(have.compositions.map(c => [c.id, c]));
  const compByKey = new Map(have.compositions.map(c => [compKey(c), c]));
  const titleIds = new Map(); // normalised title -> ids of pieces with it
  const addTitle = c => {
    const k = norm(c.title);
    if (!k) return;
    if (!titleIds.has(k)) titleIds.set(k, new Set());
    titleIds.get(k).add(c.id);
  };
  have.compositions.forEach(addTitle);

  for (const c of parsed.compositions || []) {
    let match = compById.get(c.id);
    if (!match && c._generatedId) match = compByKey.get(compKey(c));
    if (match) {
      idMap.set(c.id, match.id);
      if (!c._generatedId && newer(c, match)) { compsToSave.push(clean(c)); stats.compositions.updated++; } else stats.compositions.skipped++;
      continue;
    }
    const rec = clean(c);
    compsToSave.push(rec);
    compById.set(rec.id, rec);
    compByKey.set(compKey(rec), rec);
    addTitle(rec);
    stats.compositions.added++;
  }

  const fixSegments = segs => (segs || []).map(seg => {
    let id = seg.compositionId;
    if (id && idMap.has(id)) id = idMap.get(id);
    else if (!id && seg.type === 'repertoire') {
      const ids = titleIds.get(norm(seg.title));
      if (ids && ids.size === 1) { id = [...ids][0]; stats.relinked++; }
    }
    return id === seg.compositionId ? seg : { ...seg, compositionId: id };
  });

  const plan = (records, haveList, keyOf, kind) => {
    const byId = new Map(haveList.map(r => [r.id, r]));
    const keys = new Set(haveList.map(keyOf));
    const out = [];
    for (const raw of records) {
      const rec = { ...raw, segments: fixSegments(raw.segments) };
      const match = byId.get(rec.id);
      if (match) {
        if (!rec._generatedId && newer(rec, match)) { out.push(clean(rec)); stats[kind].updated++; } else stats[kind].skipped++;
        continue;
      }
      if (rec._generatedId && keys.has(keyOf(rec))) { stats[kind].skipped++; continue; }
      keys.add(keyOf(rec));
      byId.set(rec.id, rec);
      out.push(clean(rec));
      stats[kind].added++;
    }
    return out;
  };

  return {
    sessions: plan(parsed.sessions || [], have.sessions, sessionKey, 'sessions'),
    lessons: plan(parsed.lessons || [], have.lessons, lessonKey, 'lessons'),
    compositions: compsToSave,
    stats,
  };
}

// One line for the import result, e.g. "3 sessions, 1 lesson, 2 pieces imported; 12 already here".
export function describeImport(stats) {
  const n = (k, one, many) => {
    const c = stats[k].added + stats[k].updated;
    return c ? `${c} ${c === 1 ? one : many}` : null;
  };
  const parts = [n('sessions', 'session', 'sessions'), n('lessons', 'lesson', 'lessons'), n('compositions', 'piece', 'pieces')].filter(Boolean);
  const skipped = stats.sessions.skipped + stats.lessons.skipped + stats.compositions.skipped;
  if (!parts.length) return skipped ? `Nothing new to import (${skipped} already here)` : 'Nothing found to import';
  return `${parts.join(', ')} imported${skipped ? `; ${skipped} already here` : ''}${stats.relinked ? `; ${stats.relinked} re-linked to pieces` : ''}`;
}
