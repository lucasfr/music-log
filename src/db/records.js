// Helpers for records coming back from Supabase. Pure (no React Native imports), so they're
// unit-tested in plain Node, see tests/records.test.mjs.

// A list stored remotely as an array, a JSON string, or nothing at all, to a clean array.
function toList(v) {
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (typeof v === 'string' && v.trim()) {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
    } catch { /* not JSON: treat as empty */ }
  }
  return [];
}

// A Supabase `compositions` row, reshaped into what the rest of the app reads.
//
// Supabase uses snake_case (`time_sigs`, `created_at`) where the app uses camelCase
// (`timeSigs`, `createdAt`). Without this, a piece that arrived from another device had no
// `timeSigs` at all, so the metronome's "use piece tempo" always fell back to 4/4 on a phone.
//
// `tempo` and `timeSigs` are only set when the remote row actually has a value. An empty one
// almost always means "never synced from here", not "deliberately cleared", and the merge
// that follows is `{ ...local, ...remote }`, so setting it to null/[] would wipe the value
// already stored on this device.
export function fromRemoteComposition(row) {
  if (!row || typeof row !== 'object') return row;
  const out = { ...row };

  const sigs = toList(out.time_sigs);
  delete out.time_sigs;
  if (sigs.length) out.timeSigs = sigs; else delete out.timeSigs;

  const tempo = Math.round(Number(out.tempo));
  if (Number.isFinite(tempo) && tempo > 0) out.tempo = tempo; else delete out.tempo;

  if (out.created_at && !out.createdAt) out.createdAt = out.created_at;
  return out;
}

// Which column does a Supabase/PostgREST error say the table lacks? Returns its name, or null.
// e.g. "Could not find the 'tempo' column of 'compositions' in the schema cache" -> 'tempo'.
export function missingColumn(message) {
  const text = String(message || '');
  const m = /Could not find the '([^']+)' column/i.exec(text)
    || /column "([^"]+)" of relation "[^"]+" does not exist/i.exec(text);
  return m ? m[1] : null;
}

// Column types we know, so the hint can be a statement that can be pasted as it is.
const SQL_TYPES = { tempo: 'integer', data: 'jsonb' };

// The message shown when columns had to be left out of a push. It names the fix.
export function missingColumnHint(table, columns) {
  const list = columns.map(c => `"${c}"`).join(', ');
  const sql = columns.filter(c => SQL_TYPES[c]).map(c => `alter table ${table} add column if not exists ${c} ${SQL_TYPES[c]};`).join(' ');
  return `Supabase "${table}" has no ${list} column, so ${columns.length === 1 ? 'it' : 'they'} won't sync.`
    + (sql ? ` Run in the SQL editor: ${sql}` : ' Add it in the Supabase dashboard.');
}

// ── Native (SQLite) storage ──
//
// The native tables have a fixed set of columns, so anything else a record carries (a piece's keys
// and shelvedAt, a practice segment's articulation, tempo_bpm and scales, a lesson's extras, and
// the updated_at that sync compares) used to be dropped on save and only came back because sync
// restored it. Each row now also keeps the whole record as JSON in a `data` column. Web storage
// (IndexedDB) keeps whole objects already, so it never had the problem.

// The whole record, as text for the `data` column.
export const packRecord = record => JSON.stringify(record);

// A record as read from the columns, overlaid with the full copy from `data` when there is one.
// Rows saved before the column existed have no `data`, so they read as they always did. A damaged
// or unexpected `data` is ignored rather than breaking the read.
export function unpackRecord(fromColumns, dataText) {
  if (!dataText) return fromColumns;
  try {
    const full = JSON.parse(dataText);
    return full && typeof full === 'object' && !Array.isArray(full) ? { ...fromColumns, ...full } : fromColumns;
  } catch {
    return fromColumns;
  }
}

// ── Fields with no column of their own (Supabase) ──
//
// The Supabase tables have a fixed set of columns, and anything else a record carried was stripped
// before pushing, so it never left the device: a session's tomorrowFocus, a lesson's ratings and
// notes, and nearly everything about a piece (grade, difficulty, liking, tags, dates, notes...).
// A piece that reached a second device through sync arrived with only its title, keys, time
// signatures and tempo. Each table now also has a `data jsonb` column carrying those extras.

// The columns the app writes, per table. These must match the tables in Supabase;
// tests/records.test.mjs holds the schema they were checked against.
export const REMOTE_COLUMNS = {
  sessions:     ['id', 'user_id', 'date', 'duration', 'energy', 'enjoyment', 'wins', 'segments', 'created_at', 'updated_at', 'data'],
  lessons:      ['id', 'user_id', 'date', 'duration', 'teacher', 'wins', 'segments', 'created_at', 'updated_at', 'data'],
  compositions: ['id', 'user_id', 'title', 'composer', 'status', 'keys', 'time_sigs', 'tempo', 'notes', 'created_at', 'updated_at', 'data'],
};

// Local fields that reach a column under another name, so they are not extras.
const RENAMED = ['createdAt', 'updatedAt', 'timeSigs', 'userId'];

// Everything a record carries that has no column of its own, for the `data` column; undefined when
// there is nothing (or the table is not one we know).
export function extrasFor(table, record) {
  const columns = REMOTE_COLUMNS[table];
  if (!columns || !record) return undefined;
  const extras = {};
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined || columns.includes(key) || RENAMED.includes(key)) continue;
    extras[key] = value;
  }
  return Object.keys(extras).length ? extras : undefined;
}

// A pulled row with its `data` folded back into it. A column's value wins over `data` for any
// field in both. An unreadable `data` is dropped rather than breaking the pull.
export function unpackRemote(row) {
  if (!row || typeof row !== 'object') return row;
  const { data, ...columns } = row;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return columns;
  return { ...data, ...columns };
}

// ── Merging pulled rows with local ones ──

// A value a record was never given. 0 counts, because a rating of 0 is "unset" in this app.
const isBlank = v => v === undefined || v === null || v === '' || v === 0 || (Array.isArray(v) && v.length === 0);

// `local` with every blank field filled from `remote`; the very same object when nothing was
// filled, so callers can tell nothing changed.
function fillGaps(local, remote) {
  let filled = null;
  for (const [key, value] of Object.entries(remote)) {
    if (isBlank(value) || !isBlank(local[key])) continue;
    if (!filled) filled = { ...local };
    filled[key] = value;
  }
  return filled || local;
}

// Merges remote rows into local rows by id.
//  - A remote row that is newer wins, but fields it doesn't carry are kept from the local row.
//  - At the same timestamp (the same version of the record) only blank local fields are filled
//    from the remote row, so fields that have only just started syncing arrive, and nothing is
//    ever overwritten.
//  - A local row that is newer is kept as it is: a field cleared on purpose stays cleared.
// A row that needed no change is returned as the very same object, so a caller can tell which
// rows changed (and need saving) by comparing references.
export function mergeRows(localRows, remoteRows, keyField = 'id') {
  if (!remoteRows) return localRows;
  const map = new Map();
  for (const row of localRows) map.set(row[keyField], row);
  for (const row of remoteRows) {
    const key = row[keyField];
    const local = map.get(key);
    if (!local) { map.set(key, row); continue; }
    const localTs = new Date(local.updated_at || 0).getTime();
    const remoteTs = new Date(row.updated_at || 0).getTime();
    if (remoteTs > localTs) map.set(key, { ...local, ...row });
    else if (remoteTs === localTs) map.set(key, fillGaps(local, row));
  }
  return Array.from(map.values());
}
