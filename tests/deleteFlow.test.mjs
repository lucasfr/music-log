// The whole "delete a record, then reload" pipeline, with the real merge. The hooks in src/db/hooks.js do
// this on every reload; they can't run without React, so this repeats their steps (in the same order) over
// the real functions: processPull / processDeletes from syncQueue.js, then mergeRows from records.js.
// Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const load = file => import('data:text/javascript;base64,' + Buffer.from(readFileSync(join(here, '../src', file), 'utf8')).toString('base64'));
const { createOutbox } = await load('utils/syncQueue.js');
const { mergeRows, unpackRemote } = await load('db/records.js');

const at = h => `2026-10-19T${String(h).padStart(2, '0')}:00:00.000Z`;
const live = (id, h, extra = {}) => ({ id, date: '2026-10-19', updated_at: at(h), ...extra });

// A device: its own stored records, its outbox, and a server that may be offline.
const makeServer = (online = true) => ({ rows: new Map(), online });

function device({ stored = [], tombstoneWorks = true, server = makeServer(tombstoneWorks) } = {}) {
  const prefs = {};
  const db = new Map(stored.map(r => [r.id, r]));
  const outbox = createOutbox({
    getPref: (k, f) => (k in prefs ? prefs[k] : f),
    setPref: (k, v) => { prefs[k] = v; },
    push: async (table, r) => { if (!server.online) return false; server.rows.set(r.id, { ...r }); return true; },
    tombstone: async (table, id, deletedAt) => {
      if (!server.online) return false;
      const row = server.rows.get(id);
      if (row) server.rows.set(id, { ...row, updated_at: deletedAt, data: { deletedAt } });
      return true;
    },
    now: () => at(10),
  });
  const list = () => [...db.values()];
  return {
    db, server, outbox, list,
    // hooks.js remove(): remove it here, then record the delete (which tries to send it)
    async remove(id) { db.delete(id); await outbox.trackDelete('sessions', id); },
    // hooks.js reload(): pull, then the steps in the same order as the hook, then what the screen shows
    async reload() {
      const local = list();
      const remote = [...server.rows.values()].map(unpackRemote);
      outbox.processPull('sessions', local, remote);
      const plan = outbox.processDeletes('sessions', local, remote);
      for (const id of plan.deleteLocal) db.delete(id);
      const kept = plan.deleteLocal.length ? local.filter(r => !plan.deleteLocal.includes(r.id)) : local;
      const merged = mergeRows(kept, remote.filter(r => !plan.skip.has(r.id)));
      for (const row of merged) if (!db.has(row.id) || db.get(row.id) !== row) db.set(row.id, row);
      await new Promise(r => setTimeout(r, 0));
      return merged;
    },
  };
}

test('THE BUG: a record deleted while the request fails does not come back when the network returns', async () => {
  const a = device({ stored: [live('s1', 8)], tombstoneWorks: false });
  a.server.rows.set('s1', live('s1', 8));                        // the server has it
  await a.remove('s1');                                          // offline: the tombstone cannot be sent
  assert.equal(a.outbox.pendingDeleteCount(), 1);

  assert.deepEqual((await a.reload()).map(r => r.id), [], 'still offline: the server copy is not put back');
  a.server.online = true;                                        // the network returns
  assert.deepEqual((await a.reload()).map(r => r.id), [], 'back online: not put back either');
  assert.equal(a.outbox.pendingDeleteCount(), 0, 'and the server now has the delete');
  assert.ok(a.server.rows.get('s1').data.deletedAt, 'recorded as a tombstone');
});

test('before this fix the same sequence brought the record back (the pipeline without the delete steps)', async () => {
  // The old reload: merge the server's rows straight in, with nothing remembering the delete.
  const local = [];
  const remote = [live('s1', 8)];
  assert.deepEqual(mergeRows(local, remote).map(r => r.id), ['s1'], 'this is what used to happen');
});

test('a record deleted on one device disappears from the other on its next reload', async () => {
  const server = makeServer();
  const a = device({ stored: [live('s1', 8)], server });
  const b = device({ stored: [live('s1', 8)], server });
  server.rows.set('s1', live('s1', 8));
  await a.remove('s1');
  assert.deepEqual((await b.reload()).map(r => r.id), []);
  assert.equal(b.db.has('s1'), false, 'removed from the other device\'s storage too');
});

test('a stale device cannot bring a deleted record back by editing it offline and syncing later', async () => {
  const server = makeServer();
  const a = device({ stored: [live('s1', 8)], server });
  const b = device({ stored: [live('s1', 8)], server });
  server.rows.set('s1', live('s1', 8));
  await a.remove('s1');                                          // 10:00 (the outbox clock)
  // b edited it at 09:00 without having seen the delete: older than the deletion, so the deletion wins
  const edit = live('s1', 9, { wins: 'edited offline' });
  b.db.set('s1', edit);
  b.outbox.trackEdit('sessions', edit, at(8));
  const shown = await b.reload();
  assert.deepEqual(shown.map(r => r.id), [], 'deleted, not resurrected');
  assert.equal(b.outbox.conflicts().length, 1, 'but the edit is kept so it can be restored');
  assert.equal(b.outbox.conflicts()[0].record.wins, 'edited offline');
});

test('an edit made after the deletion does bring the record back, on every device', async () => {
  const server = makeServer();
  const a = device({ stored: [live('s1', 8)], server });
  const b = device({ stored: [live('s1', 8)], server });
  server.rows.set('s1', live('s1', 8));
  await a.remove('s1');                                          // 10:00
  const later = live('s1', 12, { wins: 'edited afterwards' });
  b.db.set('s1', later);
  b.outbox.trackEdit('sessions', later, at(8));
  assert.deepEqual((await b.reload()).map(r => r.id), ['s1'], 'the newer edit wins');
  assert.equal(b.outbox.conflicts().length, 0, 'there is nothing worth keeping from the deletion');
  assert.deepEqual((await a.reload()).map(r => r.id), ['s1'], 'and the device that deleted it gets it back');
});

test('a delete with no signal at all is still honoured after signing in', async () => {
  const a = device({ stored: [live('s1', 8)], tombstoneWorks: false });
  a.server.rows.set('s1', live('s1', 8));
  await a.remove('s1');
  a.server.online = true;
  assert.deepEqual((await a.reload()).map(r => r.id), []);
});

test('deleting one record leaves every other record alone', async () => {
  const a = device({ stored: [live('s1', 8), live('s2', 8), live('s3', 8)] });
  for (const id of ['s1', 's2', 's3']) a.server.rows.set(id, live(id, 8));
  await a.remove('s2');
  assert.deepEqual((await a.reload()).map(r => r.id).sort(), ['s1', 's3']);
});

test('a record this device never synced is simply gone, and nothing is left owed', async () => {
  const a = device({ stored: [live('s1', 8)] });
  await a.remove('s1');                                          // the server never had it
  assert.deepEqual((await a.reload()).map(r => r.id), []);
  assert.equal(a.outbox.pendingDeleteCount(), 0);
});
