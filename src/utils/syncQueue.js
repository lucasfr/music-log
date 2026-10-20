// Which edits still need pushing, and what to do when two devices edited the same record. Pure (no
// React Native imports), so it's unit-tested in plain Node, see tests/syncQueue.test.mjs.
//
// Before this, a record was pushed once, when it was saved. If that failed (no signal), nothing
// ever tried again, so the edit stayed on one device. And the merge was plain last-write-wins on
// `updated_at`, which has two silent failure modes:
//   - another device saved later: your offline edit was dropped;
//   - your offline edit has the later timestamp but you never saw the other device's edit: it was
//     overwritten when you pushed.
// Now every unsynced edit is remembered (the outbox) together with the version it was based on.
// When the other side has changed since that version, both sides changed: the newer still wins,
// as before, but the other version is kept as a conflict copy that can be restored.

const TABLES = ['sessions', 'lessons', 'compositions'];
const MAX_CONFLICTS = 20;

const time = v => {
  const t = new Date(v || 0).getTime();
  return Number.isFinite(t) ? t : 0;
};

// ── Outbox: { sessions: { [id]: { base, latest } }, lessons: {...}, compositions: {...} } ──
// `base` is the updated_at of the version the first unsynced edit started from (null for a record
// created here); `latest` is the updated_at of the newest local edit.

export function emptyOutbox() {
  return { sessions: {}, lessons: {}, compositions: {} };
}

// Stored JSON to a clean outbox. Anything malformed is dropped rather than crashing a screen.
export function parseOutbox(raw) {
  const out = emptyOutbox();
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return out;
    for (const t of TABLES) {
      const entries = data[t];
      if (!entries || typeof entries !== 'object' || Array.isArray(entries)) continue;
      for (const [id, e] of Object.entries(entries)) {
        if (e && typeof e === 'object' && e.latest) out[t][id] = { base: e.base || null, latest: e.latest };
      }
    }
  } catch { /* not JSON: nothing is waiting */ }
  return out;
}

export const serializeOutbox = box => JSON.stringify(box);

// Note a local edit. The base is kept from the first unsynced edit, since that is the version the
// other devices last agreed with. Returns a new outbox.
export function markDirty(box, table, id, base, latest) {
  const prev = box[table] && box[table][id];
  return {
    ...box,
    [table]: { ...box[table], [id]: { base: prev ? prev.base : (base || null), latest } },
  };
}

// Note that a push of the version `pushedAt` succeeded. If the record has been edited again since,
// that newer edit is still waiting, so the entry stays.
export function clearDirty(box, table, id, pushedAt) {
  const prev = box[table] && box[table][id];
  if (!prev || time(prev.latest) !== time(pushedAt)) return box;
  const { [id]: _gone, ...rest } = box[table];
  return { ...box, [table]: rest };
}

// Forget an unsynced edit altogether (the record has been deleted, so there is nothing to push).
export function dropDirty(box, table, id) {
  if (!box[table] || !(id in box[table])) return box;
  const { [id]: _gone, ...rest } = box[table];
  return { ...box, [table]: rest };
}

export function dirtyCount(box) {
  return TABLES.reduce((n, t) => n + Object.keys(box[t] || {}).length, 0);
}

// ── Deciding what to do with each unsynced record after a pull ──

// For one table: `local` and `remote` are row lists, `entries` the outbox for the table.
// -> { push: [local records to push now], clear: [ids already on the server], conflicts: [...] }
// A conflict is { id, winner: 'local' | 'remote', keep: the record that loses and would otherwise
// vanish }. The winner is the one with the later updated_at, which is what the merge already picks.
export function reconcile(local, remote, entries) {
  const remoteById = new Map((remote || []).map(r => [r.id, r]));
  const localById = new Map((local || []).map(r => [r.id, r]));
  const push = [];
  const clear = [];
  const conflicts = [];

  for (const [id, entry] of Object.entries(entries || {})) {
    const mine = localById.get(id);
    if (!mine) { clear.push(id); continue; } // deleted here since: nothing to push
    const theirs = remoteById.get(id);
    if (!theirs) { push.push(mine); continue; }

    const theirTs = time(theirs.updated_at);
    if (theirTs === time(entry.latest)) { clear.push(id); continue; } // our edit is already there

    const baseTs = time(entry.base);
    // Without a known base (a record created here, or one from before timestamps) there is no way
    // to tell whether they changed it, so the timestamps decide, as they always did.
    const theyChanged = baseTs > 0 && theirTs > baseTs;
    if (!theyChanged) { push.push(mine); continue; }

    const localWins = time(mine.updated_at) >= theirTs;
    // When the other side is a deletion (a tombstone) that loses to this newer edit, there is nothing
    // worth keeping a copy of; when this edit loses to a deletion, the edit is kept so it can be restored.
    if (!(localWins && theirs.deletedAt)) conflicts.push({ id, winner: localWins ? 'local' : 'remote', keep: localWins ? theirs : mine });
    if (localWins) push.push(mine);
  }
  return { push, clear, conflicts };
}

// ── Conflict copies ──

export function parseConflicts(raw) {
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.filter(c => c && c.table && c.id && c.record && typeof c.record === 'object').slice(0, MAX_CONFLICTS);
  } catch {
    return [];
  }
}

export const serializeConflicts = list => JSON.stringify(list);

// A short name for a record, for the list in Settings.
export function recordLabel(table, record) {
  if (!record) return 'record';
  if (table === 'compositions') return record.title || 'Untitled piece';
  const kind = table === 'lessons' ? 'Lesson' : 'Practice';
  return `${kind} on ${record.date || 'an unknown day'}`;
}

// Add a conflict copy (newest first, capped). The same version of the same record is not kept twice.
export function addConflict(list, table, id, record, side, at) {
  const dup = list.some(c => c.table === table && c.id === id && time(c.record.updated_at) === time(record.updated_at));
  if (dup) return list;
  const entry = { table, id, at, side, label: recordLabel(table, record), record };
  return [entry, ...list].slice(0, MAX_CONFLICTS);
}

export function removeConflict(list, table, id, updatedAt) {
  return list.filter(c => !(c.table === table && c.id === id && time(c.record.updated_at) === time(updatedAt)));
}

// ── Deletes ──
//
// Deleting a record used to remove the row from the server and nothing else. If that request failed (no
// signal) nothing retried it, and a pull then put the record straight back from the server; and any
// device that still had the record could push it back at any time. Now a delete is a tombstone: the
// server row is kept and marked `deletedAt` (in its `data` column, so the tables need no change), which
// every device learns of on its next pull. And a delete made here is remembered (and retried) until the
// server has the tombstone.

const MAX_DELETES = 300;   // per table, newest kept, so a device that never syncs doesn't grow this for ever

export const emptyDeletes = () => ({ sessions: {}, lessons: {}, compositions: {} });

// Stored JSON -> { [table]: { [id]: deletedAt } }. Anything malformed is dropped.
export function parseDeletes(raw) {
  const out = emptyDeletes();
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return out;
    for (const t of TABLES) {
      const entries = data[t];
      if (!entries || typeof entries !== 'object' || Array.isArray(entries)) continue;
      for (const [id, at] of Object.entries(entries)) if (typeof at === 'string' && at) out[t][id] = at;
    }
  } catch { /* not JSON: nothing is waiting */ }
  return out;
}

export const serializeDeletes = deletes => JSON.stringify(deletes);

// A pulled row that records a deletion. (`unpackRemote` folds the `data` column into the row, so
// `deletedAt` is on it directly.)
export const isTombstone = row => !!(row && row.deletedAt);

// What to do about deletions after a pull, for one table. `local` and `remote` are row lists (remote as
// pulled, tombstones included) and `pending` is this device's { id: deletedAt } for deletes the server
// may not have yet. A deletion and an edit are compared by timestamp, so the newer one wins.
// -> {
//   skip:        ids of remote rows to leave out of the merge (a tombstone, or a row this device deleted),
//   deleteLocal: ids to remove from this device (deleted elsewhere, not edited here since),
//   revive:      ids of local rows edited after the deletion (they come back, and are pushed),
//   push:        ids whose tombstone should be (re)sent,
//   forget:      ids to drop from `pending` (the server knows, was edited since, or has no row),
// }
export function planDeletes(local, remote, pending) {
  const mineById = new Map((local || []).map(r => [r.id, r]));
  const owed = pending || {};
  const skip = new Set();
  const deleteLocal = [];
  const revive = [];
  const push = [];
  const forget = [];
  const seen = new Set();

  for (const r of remote || []) {
    seen.add(r.id);
    const mine = mineById.get(r.id);
    const owedAt = owed[r.id];
    if (isTombstone(r)) {
      skip.add(r.id);
      if (owedAt) forget.push(r.id);
      if (mine) (time(mine.updated_at) > time(r.updated_at) ? revive : deleteLocal).push(r.id);
    } else if (owedAt) {
      if (time(r.updated_at) > time(owedAt)) forget.push(r.id);          // edited elsewhere after this delete: the edit wins
      else { skip.add(r.id); push.push(r.id); }                           // still to be deleted: keep it out, send the tombstone
    }
  }
  for (const id of Object.keys(owed)) if (!seen.has(id)) forget.push(id); // no row on the server: nothing to mark
  return { skip, deleteLocal, revive, push, forget };
}

// For pushing everything ("Push all"): the deletions on the server, by id, as timestamps; and whether a
// record would only undo one (the server's deletion is at least as new as the record).
export function tombstoneIndex(remote) {
  const index = new Map();
  (remote || []).forEach(r => { if (isTombstone(r)) index.set(r.id, time(r.updated_at)); });
  return index;
}
export const blockedByDeletion = (record, index) => index.has(record.id) && index.get(record.id) >= time(record.updated_at);

// ── The outbox as the app uses it ──
//
// Storage and the network are passed in, so the whole flow is testable without a device:
//   getPref(key, fallback) / setPref(key, value)   the app's local preferences
//   push(table, record) -> true | false | null     db/sync.js pushRecord (null: nobody signed in)
// db/outbox.js wires in the real ones.

const BOX_KEY = 'syncOutbox';
const CONFLICTS_KEY = 'syncConflicts';
const DELETES_KEY = 'syncDeletes';

export function createOutbox({ getPref, setPref, push, tombstone = async () => null, now = () => new Date().toISOString() }) {
  let box = null;
  const load = () => box || (box = parseOutbox(getPref(BOX_KEY, '')));
  const store = next => { box = next; setPref(BOX_KEY, serializeOutbox(next)); };
  const conflictList = () => parseConflicts(getPref(CONFLICTS_KEY, '[]'));
  const storeConflicts = list => setPref(CONFLICTS_KEY, serializeConflicts(list));

  // Deletes the server may not have yet: { [table]: { [id]: deletedAt } }, kept across restarts.
  const loadDeletes = () => parseDeletes(getPref(DELETES_KEY, ''));
  const rememberDelete = (table, id, at) => {
    const all = loadDeletes();
    all[table][id] = at;
    const ids = Object.keys(all[table]);
    if (ids.length > MAX_DELETES) {
      ids.sort((a, b) => all[table][a].localeCompare(all[table][b])).slice(0, ids.length - MAX_DELETES).forEach(k => delete all[table][k]);
    }
    setPref(DELETES_KEY, serializeDeletes(all));
  };
  const forgetDelete = (table, id) => {
    const all = loadDeletes();
    if (!(id in all[table])) return;
    delete all[table][id];
    setPref(DELETES_KEY, serializeDeletes(all));
  };
  // Send a tombstone; it stops being owed only once the server has it (true). Nobody signed in (null) or
  // a failure keeps it owed, to be sent again after the next pull.
  async function sendTombstone(table, id, at) {
    let ok;
    try { ok = await tombstone(table, id, at); } catch { ok = false; }
    if (ok === true) forgetDelete(table, id);
    return ok;
  }

  // Push a record and, if it got there, forget it was waiting. A push that fails (or throws) leaves
  // it waiting; so does an edit made again while this push was in flight. When nobody is signed in
  // nothing is attempted and nothing is kept waiting: "Push all" covers that case after sign-in.
  async function pushTracked(table, record) {
    let ok;
    try { ok = await push(table, record); } catch { ok = false; }
    if (ok !== false) store(clearDirty(load(), table, record.id, record.updated_at));
    return ok;
  }

  return {
    pushTracked,

    // Call when a record is saved locally, before pushing. `base` is the updated_at it had before
    // this edit (undefined for a new record).
    trackEdit(table, record, base) {
      store(markDirty(load(), table, record.id, base, record.updated_at));
      forgetDelete(table, record.id);   // saved again after being deleted (an undo): it is back
    },

    // Call when a record is deleted here, after removing it from this device. Remembers the delete,
    // forgets any unsynced edit of the record, and sends the tombstone. Resolves to true / false / null
    // like push.
    trackDelete(table, id, at = now()) {
      store(dropDirty(load(), table, id));
      rememberDelete(table, id, at);
      return sendTombstone(table, id, at);
    },

    // Call after pulling a table, before merging: sorts out deletions (see planDeletes), sends owed
    // tombstones again, and pushes back any record edited after it was deleted elsewhere. The caller
    // removes `deleteLocal` from the device and leaves `skip` out of the merge.
    processDeletes(table, local, remote) {
      const owed = loadDeletes()[table];
      const plan = planDeletes(local, remote, owed);
      plan.forget.forEach(id => forgetDelete(table, id));
      plan.push.forEach(id => { sendTombstone(table, id, owed[id]); });
      const mineById = new Map((local || []).map(r => [r.id, r]));
      plan.revive.forEach(id => { pushTracked(table, mineById.get(id)); });
      return plan;
    },

    pendingDeleteCount: () => TABLES.reduce((n, t) => n + Object.keys(loadDeletes()[t]).length, 0),

    // Call after pulling a table: pushes edits that never got there, and keeps a copy of whichever
    // side loses when both changed. `remote` is the pulled rows as they came, before any merge.
    // -> { pushed, conflicts } (counts)
    processPull(table, local, remote) {
      const entries = load()[table];
      if (!entries || !Object.keys(entries).length) return { pushed: 0, conflicts: 0 };
      const { push: toPush, clear, conflicts } = reconcile(local, remote, entries);

      let next = load();
      for (const id of clear) next = clearDirty(next, table, id, entries[id].latest);
      let list = conflictList();
      for (const c of conflicts) {
        list = addConflict(list, table, c.id, c.keep, c.winner === 'local' ? 'other device' : 'this device', now());
        // When the other side wins, this device's copy is replaced by the merge, so nothing is left to push.
        if (c.winner === 'remote') next = clearDirty(next, table, c.id, entries[c.id].latest);
      }
      if (conflicts.length) storeConflicts(list);
      store(next);

      toPush.forEach(r => { pushTracked(table, r); });
      return { pushed: toPush.length, conflicts: conflicts.length };
    },

    pendingCount: () => dirtyCount(load()),
    conflicts: conflictList,

    // After the app has saved a conflict copy back as the current version, or the user dismisses it.
    resolveConflict(table, id, updatedAt) {
      storeConflicts(removeConflict(conflictList(), table, id, updatedAt));
    },
  };
}
