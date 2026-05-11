// Supabase sync layer — fire-and-forget push, pull on load.
// All functions are safe to call when not signed in (no-ops).

import { getClient, getSession } from '../lib/supabase';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function authedClient() {
  const session = await getSession();
  if (!session) return null;
  return getClient();
}

function userId(session) {
  return session?.user?.id ?? null;
}

// Strips local-only fields and adds user_id before pushing to Supabase.
// segments and keys/timeSigs are already JSON-serialisable objects — Supabase
// accepts them directly as jsonb.
function toRow(table, record, uid) {
  const row = { ...record, user_id: uid };
  // Normalise created_at / updated_at (local may use camelCase)
  if (row.createdAt)  { row.created_at  = row.createdAt;  delete row.createdAt; }
  if (row.updatedAt)  { row.updated_at  = row.updatedAt;  delete row.updatedAt; }
  if (!row.updated_at) row.updated_at = new Date().toISOString();
  // Strip fields that don't exist in the Supabase schema
  const KNOWN = {
    sessions:     ['id','user_id','date','duration','energy','enjoyment','wins','segments','created_at','updated_at'],
    lessons:      ['id','user_id','date','duration','teacher','wins','segments','created_at','updated_at'],
    compositions: ['id','user_id','title','composer','status','keys','time_sigs','notes','created_at','updated_at'],
  };
  const allowed = KNOWN[table];
  if (allowed) {
    for (const key of Object.keys(row)) {
      if (!allowed.includes(key)) delete row[key];
    }
  }
  // Map camelCase local fields to snake_case Supabase columns
  if (table === 'compositions') {
    if (record.timeSigs !== undefined) row.time_sigs = record.timeSigs;
  }
  return row;
}

// ─── Push (save) ──────────────────────────────────────────────────────────────

export async function pushRecord(table, record) {
  try {
    const session = await getSession();
    if (!session) return;
    const client = getClient();
    const row = toRow(table, record, userId(session));
    const { error } = await client.from(table).upsert(row, { onConflict: 'id' });
    if (error) console.warn(`[sync] push ${table} failed:`, error.message, error.details);
  } catch (e) {
    console.warn(`[sync] push ${table} exception:`, e.message);
  }
}

// ─── Push (delete) ────────────────────────────────────────────────────────────

export async function deleteRecord(table, id) {
  try {
    const client = await authedClient();
    if (!client) return;
    const { error } = await client.from(table).delete().eq('id', id);
    if (error) console.warn(`[sync] delete ${table} failed:`, error.message);
  } catch (e) {
    console.warn(`[sync] delete ${table} exception:`, e.message);
  }
}

// ─── Pull (load) ──────────────────────────────────────────────────────────────

// Fetches all rows for the current user from a table.
// Caller is responsible for merging with local data (newer updated_at wins).
export async function pullTable(table) {
  try {
    const session = await getSession();
    if (!session) return null;
    const client = getClient();
    const { data, error } = await client
      .from(table)
      .select('*')
      .eq('user_id', userId(session));
    if (error) { console.warn(`[sync] pull ${table} failed:`, error.message); return null; }
    return data;
  } catch (e) {
    console.warn(`[sync] pull ${table} exception:`, e.message);
    return null;
  }
}

// ─── Merge ────────────────────────────────────────────────────────────────────

// Merges remote rows into local rows. When remote is newer, it wins — but
// local-only fields (not present on the remote row) are always preserved.
// This prevents stripped Supabase columns from erasing local-only data.
export function mergeRows(localRows, remoteRows, keyField = 'id') {
  if (!remoteRows) return localRows;
  const map = new Map();
  for (const row of localRows)  map.set(row[keyField], row);
  for (const row of remoteRows) {
    const local = map.get(row[keyField]);
    if (!local) {
      map.set(row[keyField], row);
    } else {
      const localTs  = new Date(local.updated_at  || 0).getTime();
      const remoteTs = new Date(row.updated_at || 0).getTime();
      if (remoteTs > localTs) {
        // Remote is newer: use remote as base but keep any local-only fields
        // that the remote row doesn't carry (e.g. fields not in Supabase schema).
        map.set(row[keyField], { ...local, ...row });
      }
    }
  }
  return Array.from(map.values());
}
