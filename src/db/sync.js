// Supabase sync layer — fire-and-forget push, pull on load.
// All functions are safe to call when not signed in (no-ops).

import { getClient, getSession } from '../lib/supabase';
import { reportSyncStart, reportSyncSuccess, reportSyncError } from './syncStatus';
import { missingColumn, missingColumnHint, REMOTE_COLUMNS, extrasFor, unpackRemote, mergeRows } from './records';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function authedClient() {
  const session = await getSession();
  if (!session) return null;
  return await getClient();
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
  // Fields with no column of their own travel in `data` (see records.js); everything else is cut
  // down to the columns the tables have.
  const allowed = REMOTE_COLUMNS[table];
  if (allowed) {
    row.data = extrasFor(table, record) || null;
    for (const key of Object.keys(row)) {
      if (!allowed.includes(key)) delete row[key];
    }
  }
  // Map camelCase local fields to snake_case Supabase columns
  if (table === 'compositions') {
    if (record.timeSigs !== undefined) row.time_sigs = record.timeSigs;
    // The form keeps tempo as text, so a cleared field is ''. Postgres rejects '' for an
    // integer column, which would fail the push for the whole piece, not just the tempo.
    if ('tempo' in row) row.tempo = Number(row.tempo) > 0 ? Math.round(Number(row.tempo)) : null;
  }
  return row;
}

// ─── Push (save) ──────────────────────────────────────────────────────────────

// Resolves true when the record reached Supabase (possibly without a column the table lacks,
// see below), false when it didn't, so callers like "Push all" can count real failures, and null
// when nothing was attempted because nobody is signed in (falsy too, so `if (ok)` still works).
export async function pushRecord(table, record) {
  const scope = `push:${table}`;
  try {
    const session = await getSession();
    if (!session) return null;
    reportSyncStart();
    const client = await getClient();
    let row = toRow(table, record, userId(session));
    // A column the Supabase table doesn't have makes it reject the whole row, not just that
    // field, so a piece with a tempo set never synced at all. Drop the column and try again so
    // the rest of the record gets through, and keep reporting the gap until the column exists.
    const skipped = [];
    let error = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      ({ error } = await client.from(table).upsert(row, { onConflict: 'id' }));
      const column = error ? missingColumn(error.message) : null;
      if (!column || !(column in row)) break;
      skipped.push(column);
      const { [column]: _left, ...rest } = row;
      row = rest;
    }
    if (error) {
      console.warn(`[sync] push ${table} failed:`, error.message, error.details);
      reportSyncError(error.message, scope);
      return false;
    }
    if (skipped.length) {
      console.warn(`[sync] push ${table} left out missing columns:`, skipped.join(', '));
      reportSyncError(missingColumnHint(table, skipped), scope);
      return true;
    }
    reportSyncSuccess(scope);
    return true;
  } catch (e) {
    console.warn(`[sync] push ${table} exception:`, e.message);
    reportSyncError(e.message, scope);
    return false;
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
// Paginates in chunks of 1000 to bypass Supabase's default server-side row
// limit, which would otherwise silently truncate older records.
// Caller is responsible for merging with local data (newer updated_at wins).
export async function pullTable(table) {
  try {
    const session = await getSession();
    if (!session) return null;
    reportSyncStart();
    const client = await getClient();
    const PAGE_SIZE = 1000;
    let allData = [];
    let from = 0;
    while (true) {
      const { data, error } = await client
        .from(table)
        .select('*')
        .eq('user_id', userId(session))
        .order('created_at', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        console.warn(`[sync] pull ${table} failed:`, error.message);
        reportSyncError(error.message, `pull:${table}`);
        return null;
      }
      if (!data || data.length === 0) break;
      allData = allData.concat(data);
      if (data.length < PAGE_SIZE) break; // last page
      from += PAGE_SIZE;
    }
    reportSyncSuccess(`pull:${table}`);
    return allData.map(unpackRemote);
  } catch (e) {
    console.warn(`[sync] pull ${table} exception:`, e.message);
    reportSyncError(e.message, `pull:${table}`);
    return null;
  }
}

// ─── Merge ────────────────────────────────────────────────────────────────────

// The merge itself lives in records.js (pure and unit-tested); it is re-exported here so the hooks
// keep importing it from this file.
export { mergeRows };
