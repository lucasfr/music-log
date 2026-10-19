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
const SQL_TYPES = { tempo: 'integer' };

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
