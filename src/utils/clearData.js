// Clearing every stored record (sessions, lessons, pieces). Pure (no React Native imports), so it's
// unit-tested in plain Node, see tests/clearData.test.mjs.
//
// Why this isn't "empty the local database": a device that is signed in pulls everything back from
// Supabase on its next reload, and another device would push its copies back. A delete only sticks
// when it is a tombstone (see the Deletes section of syncQueue.js), so each record is deleted here and
// then recorded through the outbox, which sends the tombstone and keeps retrying it if there is no
// signal. Deleting one record at a time through the screens' remove() would work but reloads (and
// pulls all three tables) after every single delete, so this wipes once and sends the tombstones in
// small batches instead.
//
// Everything the app does with the outside world is passed in, so the whole flow can be tested:
//   local          { sessions, lessons, compositions }, the records currently on this device
//   pullRemote(t)  the live (not deleted) rows the server has for table t, or null if it can't be read
//   wipeLocal()    empties this device's storage
//   trackDelete(t, id)  outbox.trackDelete: remembers the delete and tries to send it (true / false / null)
//   guard(t, ids)  keeps a concurrent reload from putting these back; returns a function that lets go
//   dropConflicts() forgets the saved "edits replaced by sync" copies, which could restore deleted records
// -> { counts, total, sent, owed, signedOut, unchecked }
//   counts     records deleted per table
//   sent       tombstones the server has already confirmed
//   owed       deletes the server doesn't have yet because the request failed (offline); they are retried
//              after each pull
//   signedOut  deletes that were not attempted because nobody is signed in; also remembered, so they are
//              sent if the device signs in later
//   unchecked  tables whose server rows could not be read, so rows only the server has were not included

export const CLEAR_TABLES = ['sessions', 'lessons', 'compositions'];

export async function clearAllData({ local = {}, pullRemote, wipeLocal, trackDelete, guard, dropConflicts, batch = 10 }) {
  const ids = {};
  const unchecked = [];
  const release = [];

  // What to delete: everything here, plus rows only the server has (made on another device and not
  // pulled here yet), so a signed-in clear leaves nothing behind to come back.
  for (const table of CLEAR_TABLES) {
    const all = new Set((local[table] || []).map(r => r.id));
    let remote = null;
    try { remote = await pullRemote(table); } catch { remote = null; }
    if (remote) remote.forEach(r => all.add(r.id)); else unchecked.push(table);
    ids[table] = [...all];
    release.push(guard(table, ids[table]));
  }

  await wipeLocal();
  if (dropConflicts) dropConflicts();

  const result = { counts: {}, total: 0, sent: 0, owed: 0, signedOut: 0, unchecked };
  for (const table of CLEAR_TABLES) {
    result.counts[table] = ids[table].length;
    result.total += ids[table].length;
    for (let i = 0; i < ids[table].length; i += batch) {
      const outcomes = await Promise.all(
        ids[table].slice(i, i + batch).map(id => Promise.resolve(trackDelete(table, id)).catch(() => false)),
      );
      for (const o of outcomes) { if (o === true) result.sent++; else if (o === null) result.signedOut++; else result.owed++; }
    }
  }
  release.forEach(fn => { if (typeof fn === 'function') fn(); });
  return result;
}

const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// One line for the result, e.g. "Deleted 137 sessions, 13 lessons, 18 pieces".
export function describeClear(r) {
  if (!r || !r.total) return 'Nothing to clear';
  const c = r.counts || {};
  const parts = [
    c.sessions     ? count(c.sessions, 'session', 'sessions') : null,
    c.lessons      ? count(c.lessons, 'lesson', 'lessons') : null,
    c.compositions ? count(c.compositions, 'piece', 'pieces') : null,
  ].filter(Boolean);
  let msg = `Deleted ${parts.join(', ')}`;
  const syncing = r.signedOut < r.total;   // somebody is signed in, so the server matters
  if (syncing && r.owed) msg += `; ${count(r.owed, 'delete', 'deletes')} still to reach Supabase, sent automatically when you are back online`;
  if (syncing && r.unchecked && r.unchecked.length) msg += '; could not check Supabase for records made on other devices';
  return msg;
}
