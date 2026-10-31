// "Clear all data", end to end with the real outbox and the real merge. The hooks in src/db/hooks.js
// do the reload steps below on every reload; they can't run without React, so this repeats them (same
// order) over the real functions, as deleteFlow.test.mjs does.
// Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const load = file => import('data:text/javascript;base64,' + Buffer.from(readFileSync(join(here, '../src', file), 'utf8')).toString('base64'));
const { createOutbox, isTombstone } = await load('utils/syncQueue.js');
const { mergeRows, unpackRemote } = await load('db/records.js');
const { clearAllData, describeClear, CLEAR_TABLES } = await load('utils/clearData.js');

const at = h => `2026-10-19T${String(h).padStart(2, '0')}:00:00.000Z`;
const rec = (id, h = 8, extra = {}) => ({ id, date: '2026-10-19', updated_at: at(h), ...extra });

// One server shared by devices; each device has its own storage and outbox. Offline: every request fails.
const makeServer = () => ({ rows: { sessions: new Map(), lessons: new Map(), compositions: new Map() }, online: true, signedOut: false });

function device({ stored = {}, server = makeServer() } = {}) {
  const prefs = {};
  const db = { sessions: new Map(), lessons: new Map(), compositions: new Map() };
  for (const t of CLEAR_TABLES) (stored[t] || []).forEach(r => db[t].set(r.id, r));
  const outbox = createOutbox({
    getPref: (k, f) => (k in prefs ? prefs[k] : f),
    setPref: (k, v) => { prefs[k] = v; },
    push: async (table, r) => { if (server.signedOut) return null; if (!server.online) return false; server.rows[table].set(r.id, { ...r }); return true; },
    tombstone: async (table, id, deletedAt) => {
      if (server.signedOut) return null;
      if (!server.online) return false;
      const row = server.rows[table].get(id);
      if (row) server.rows[table].set(id, { ...row, updated_at: deletedAt, data: { deletedAt } });
      return true;
    },
    now: () => at(10),
  });
  const guards = { held: [], released: 0 };
  const list = t => [...db[t].values()];

  const d = {
    db, server, outbox, prefs, guards, list,
    // what the hooks' clearAllRecords wires in
    clear: (opts = {}) => clearAllData({
      local: { sessions: list('sessions'), lessons: list('lessons'), compositions: list('compositions') },
      pullRemote: async t => (server.online && !server.signedOut ? [...server.rows[t].values()].map(unpackRemote).filter(r => !isTombstone(r)) : null),
      wipeLocal: async () => { for (const t of CLEAR_TABLES) db[t].clear(); },
      trackDelete: (t, id) => outbox.trackDelete(t, id),
      guard: (t, ids) => { guards.held.push([t, ids.length]); return () => { guards.released++; }; },
      dropConflicts: () => outbox.conflicts().forEach(c => outbox.resolveConflict(c.table, c.id, c.record.updated_at)),
      ...opts,
    }),
    // hooks.js reload(), for one table
    async reload(table) {
      const local = list(table);
      const remote = [...server.rows[table].values()].map(unpackRemote);
      outbox.processPull(table, local, remote);
      const plan = outbox.processDeletes(table, local, remote);
      for (const id of plan.deleteLocal) db[table].delete(id);
      const kept = plan.deleteLocal.length ? local.filter(r => !plan.deleteLocal.includes(r.id)) : local;
      const merged = mergeRows(kept, remote.filter(r => !plan.skip.has(r.id)));
      for (const row of merged) if (!db[table].has(row.id) || db[table].get(row.id) !== row) db[table].set(row.id, row);
      await new Promise(r => setTimeout(r, 0));
      return merged.map(r => r.id).sort();
    },
    // hooks.js save(): stamp, store, track, push
    async save(table, r, stamp) {
      const record = { ...r, updated_at: stamp };
      db[table].set(record.id, record);
      outbox.trackEdit(table, record, r.updated_at);
      await outbox.pushTracked(table, record);
    },
  };
  return d;
}

const seed = (dev, rows) => {
  for (const [t, list] of Object.entries(rows)) list.forEach(r => { dev.db[t].set(r.id, r); dev.server.rows[t].set(r.id, { ...r }); });
};
const allReload = async d => ({ sessions: await d.reload('sessions'), lessons: await d.reload('lessons'), compositions: await d.reload('compositions') });
const EMPTY = { sessions: [], lessons: [], compositions: [] };

const DATA = () => ({
  sessions: [rec('s1'), rec('s2'), rec('s3')],
  lessons: [rec('l1')],
  compositions: [rec('c1'), rec('c2')],
});

test('clears every table, and nothing comes back on the next reload', async () => {
  const a = device();
  seed(a, DATA());
  const r = await a.clear();
  assert.deepEqual(r.counts, { sessions: 3, lessons: 1, compositions: 2 });
  assert.equal(r.total, 6);
  assert.equal(r.sent, 6);
  assert.equal(r.owed, 0);
  assert.deepEqual(r.unchecked, []);
  for (const t of CLEAR_TABLES) assert.equal(a.db[t].size, 0, `${t} emptied locally`);
  assert.deepEqual(await allReload(a), EMPTY, 'the server copies are not pulled back');
  assert.equal(a.server.rows.sessions.get('s1').data.deletedAt != null, true, 'recorded on the server as tombstones');
});

test('a plain local wipe would have been undone by the next pull (why tombstones are needed)', async () => {
  const a = device();
  seed(a, DATA());
  for (const t of CLEAR_TABLES) a.db[t].clear();                 // wipe only, no tombstones
  assert.deepEqual((await allReload(a)).sessions, ['s1', 's2', 's3'], 'everything is back');
});

test('rows only the server has (made on another device) are cleared too', async () => {
  const a = device();
  seed(a, { ...EMPTY, sessions: [rec('s1')] });
  a.server.rows.sessions.set('s-elsewhere', rec('s-elsewhere'));  // never pulled here
  const r = await a.clear();
  assert.equal(r.counts.sessions, 2);
  assert.deepEqual(await a.reload('sessions'), []);
});

test('another device loses its copies on its next reload', async () => {
  const server = makeServer();
  const a = device({ server });
  const b = device({ server });
  seed(a, DATA());
  for (const t of CLEAR_TABLES) b.db[t] = new Map(a.db[t]);
  await a.clear();
  assert.deepEqual(await allReload(b), EMPTY);
  for (const t of CLEAR_TABLES) assert.equal(b.db[t].size, 0);
});

test('offline: the deletes are owed, nothing comes back, and the server gets them when the network returns', async () => {
  const a = device();
  seed(a, DATA());
  a.server.online = false;
  const r = await a.clear();
  assert.equal(r.sent, 0);
  assert.equal(r.owed, 6);
  assert.deepEqual(r.unchecked, CLEAR_TABLES, 'the server could not be read');
  assert.equal(a.outbox.pendingDeleteCount(), 6);
  assert.deepEqual(await allReload(a), EMPTY, 'still offline: the server copies are not put back');
  a.server.online = true;
  assert.deepEqual(await allReload(a), EMPTY, 'back online: not put back either');
  assert.equal(a.outbox.pendingDeleteCount(), 0, 'and the server now has every delete');
});

test('unsynced edits waiting in the outbox are dropped, not pushed back after the clear', async () => {
  const a = device();
  seed(a, DATA());
  const edit = rec('s1', 9, { wins: 'edited, never synced' });
  a.db.sessions.set('s1', edit);
  a.outbox.trackEdit('sessions', edit, at(8));
  assert.equal(a.outbox.pendingCount(), 1);
  await a.clear();
  assert.equal(a.outbox.pendingCount(), 0);
  assert.deepEqual(await a.reload('sessions'), []);
});

test('saved "edits replaced by sync" copies are forgotten, so they cannot restore deleted records', async () => {
  const a = device();
  seed(a, DATA());
  // a conflict copy: this device edited s1 offline while another device changed it too
  a.server.rows.sessions.set('s1', rec('s1', 12, { wins: 'other device' }));
  const mine = rec('s1', 11, { wins: 'mine' });
  a.db.sessions.set('s1', mine);
  a.outbox.trackEdit('sessions', mine, at(8));
  await a.reload('sessions');
  assert.equal(a.outbox.conflicts().length, 1, 'precondition: a conflict copy exists');
  await a.clear();
  assert.equal(a.outbox.conflicts().length, 0);
});

test('importing a backup after clearing brings the same records back (a fresh save is newer than the delete)', async () => {
  const a = device();
  seed(a, DATA());
  await a.clear();
  // Settings import saves through the hooks, which stamp updated_at = now (after the tombstone at 10:00)
  for (const r of DATA().sessions) await a.save('sessions', r, at(15));
  assert.deepEqual(await a.reload('sessions'), ['s1', 's2', 's3']);
  assert.equal(a.server.rows.sessions.get('s1').data?.deletedAt, undefined, 'no longer marked deleted on the server');
  const b = device({ server: a.server });
  assert.deepEqual(await b.reload('sessions'), ['s1', 's2', 's3'], 'and other devices get them');
});

test('the reload guard is held for every table and let go once, after all the deletes are sent', async () => {
  const a = device();
  seed(a, DATA());
  await a.clear();
  assert.deepEqual(a.guards.held, [['sessions', 3], ['lessons', 1], ['compositions', 2]]);
  assert.equal(a.guards.released, 3);
});

test('deletes are sent in small batches, not all at once', async () => {
  const a = device();
  seed(a, { ...EMPTY, sessions: Array.from({ length: 25 }, (_, i) => rec(`s${i}`)) });
  let inFlight = 0, peak = 0;
  await a.clear({
    trackDelete: async (t, id) => { inFlight++; peak = Math.max(peak, inFlight); await new Promise(r => setTimeout(r, 2)); inFlight--; return true; },
  });
  assert.equal(peak, 10);
});

test('one failing delete does not stop the others, and is counted as owed', async () => {
  const a = device();
  seed(a, DATA());
  const r = await a.clear({ trackDelete: async (t, id) => { if (id === 's2') throw new Error('boom'); return true; } });
  assert.equal(r.sent, 5);
  assert.equal(r.owed, 1);
});

test('a table that cannot be read from the server is reported, and the rest still clears', async () => {
  const a = device();
  seed(a, DATA());
  const r = await a.clear({ pullRemote: async t => { if (t === 'lessons') throw new Error('500'); return [...a.server.rows[t].values()].map(unpackRemote); } });
  assert.deepEqual(r.unchecked, ['lessons']);
  assert.equal(r.total, 6);
  assert.equal(a.db.lessons.size, 0);
});

test('with nothing stored it does nothing and says so', async () => {
  const a = device();
  const r = await a.clear();
  assert.equal(r.total, 0);
  assert.deepEqual(r.counts, { sessions: 0, lessons: 0, compositions: 0 });
});

test('signed out: nothing is attempted, the deletes are remembered, and they are sent after signing in', async () => {
  const a = device();
  seed(a, DATA());
  a.server.signedOut = true;
  const r = await a.clear();
  assert.equal(r.sent, 0);
  assert.equal(r.owed, 0, 'not a failure: nobody was signed in to send to');
  assert.equal(r.signedOut, 6);
  assert.deepEqual(r.unchecked, CLEAR_TABLES);
  assert.equal(a.outbox.pendingDeleteCount(), 6, 'remembered');
  a.server.signedOut = false;                                    // signs in later
  assert.deepEqual(await allReload(a), EMPTY, 'the server copies do not come back');
  assert.equal(a.outbox.pendingDeleteCount(), 0, 'and the server now has every delete');
});

test('describeClear: plain counts when everything reached the server', () => {
  assert.equal(describeClear({ total: 6, counts: { sessions: 3, lessons: 1, compositions: 2 }, sent: 6, owed: 0, signedOut: 0, unchecked: [] }),
    'Deleted 3 sessions, 1 lesson, 2 pieces');
});

test('describeClear: singular, and tables with nothing are left out', () => {
  assert.equal(describeClear({ total: 1, counts: { sessions: 0, lessons: 0, compositions: 1 }, sent: 1, owed: 0, signedOut: 0, unchecked: [] }),
    'Deleted 1 piece');
});

test('describeClear: failed deletes while signed in are called out', () => {
  const m = describeClear({ total: 4, counts: { sessions: 4, lessons: 0, compositions: 0 }, sent: 1, owed: 3, signedOut: 0, unchecked: ['lessons'] });
  assert.match(m, /3 deletes still to reach Supabase/);
  assert.match(m, /could not check Supabase/);
});

test('describeClear: signed out says nothing about Supabase', () => {
  const m = describeClear({ total: 4, counts: { sessions: 4, lessons: 0, compositions: 0 }, sent: 0, owed: 0, signedOut: 4, unchecked: ['sessions', 'lessons', 'compositions'] });
  assert.equal(m, 'Deleted 4 sessions');
});

test('describeClear: nothing stored', () => {
  assert.equal(describeClear({ total: 0, counts: {}, sent: 0, owed: 0, signedOut: 0, unchecked: [] }), 'Nothing to clear');
});
