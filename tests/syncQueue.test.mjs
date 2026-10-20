// Tests for the sync outbox and conflict handling (src/utils/syncQueue.js).  Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '../src/utils/syncQueue.js'), 'utf8');
const {
  emptyOutbox, parseOutbox, serializeOutbox, markDirty, clearDirty, dirtyCount, reconcile,
  parseConflicts, serializeConflicts, addConflict, removeConflict, recordLabel, createOutbox,
  dropDirty, emptyDeletes, parseDeletes, serializeDeletes, isTombstone, planDeletes, tombstoneIndex, blockedByDeletion,
} = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

const at = (h, m = 0) => `2026-10-19T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`;
const rec = (id, h, extra = {}) => ({ id, date: '2026-10-19', updated_at: at(h), ...extra });

// ── outbox bookkeeping ──────────────────────────────────────────────────────────────

test('an edit is remembered with the version it started from; later edits keep that base', () => {
  let box = markDirty(emptyOutbox(), 'sessions', 's1', at(8), at(10));
  assert.deepEqual(box.sessions.s1, { base: at(8), latest: at(10) });
  box = markDirty(box, 'sessions', 's1', at(10), at(11)); // edited again, still offline
  assert.deepEqual(box.sessions.s1, { base: at(8), latest: at(11) });
});

test('a record created here has no base', () => {
  const box = markDirty(emptyOutbox(), 'lessons', 'l1', undefined, at(9));
  assert.equal(box.lessons.l1.base, null);
});

test('a successful push clears the entry, unless the record was edited again meanwhile', () => {
  let box = markDirty(emptyOutbox(), 'sessions', 's1', at(8), at(10));
  box = markDirty(box, 'sessions', 's1', at(10), at(11)); // second edit while the first push was in flight
  assert.equal(dirtyCount(clearDirty(box, 'sessions', 's1', at(10))), 1, 'the 10:00 push must not clear the 11:00 edit');
  assert.equal(dirtyCount(clearDirty(box, 'sessions', 's1', at(11))), 0);
});

test('the outbox survives being stored, and junk is ignored', () => {
  const box = markDirty(emptyOutbox(), 'compositions', 'c1', at(8), at(9));
  assert.deepEqual(parseOutbox(serializeOutbox(box)), box);
  assert.deepEqual(parseOutbox('not json'), emptyOutbox());
  assert.deepEqual(parseOutbox('{"sessions":[1,2],"lessons":{"x":null}}'), emptyOutbox());
  assert.deepEqual(parseOutbox(null), emptyOutbox());
});

// ── retrying edits that never reached the server ───────────────────────────────────────

test('an edit made offline is pushed on the next reload (it used to be left on this device)', () => {
  const local = [rec('s1', 10)];
  const remote = [rec('s1', 8)]; // the server still has the old version
  const out = reconcile(local, remote, { s1: { base: at(8), latest: at(10) } });
  assert.deepEqual(out.push.map(r => r.id), ['s1']);
  assert.equal(out.conflicts.length, 0);
});

test('a record the server does not have yet is pushed', () => {
  const out = reconcile([rec('s9', 10)], [], { s9: { base: null, latest: at(10) } });
  assert.deepEqual(out.push.map(r => r.id), ['s9']);
});

test('an edit already on the server is cleared, not pushed again', () => {
  const out = reconcile([rec('s1', 10)], [rec('s1', 10)], { s1: { base: at(8), latest: at(10) } });
  assert.deepEqual(out.clear, ['s1']);
  assert.equal(out.push.length, 0);
});

test('an entry for a record deleted here is dropped', () => {
  const out = reconcile([], [rec('s1', 8)], { s1: { base: at(8), latest: at(10) } });
  assert.deepEqual(out.clear, ['s1']);
  assert.equal(out.push.length, 0);
});

// ── both devices edited ──────────────────────────────────────────────────────────────────────

test('failure mode 1: the other device saved later, so your offline edit would be dropped; it is kept as a copy', () => {
  // Base 08:00. You edited offline at 10:00. The other device saved at 11:00.
  const mine = rec('s1', 10, { wins: 'mine' });
  const theirs = rec('s1', 11, { wins: 'theirs' });
  const out = reconcile([mine], [theirs], { s1: { base: at(8), latest: at(10) } });
  assert.equal(out.conflicts.length, 1);
  assert.equal(out.conflicts[0].winner, 'remote');
  assert.equal(out.conflicts[0].keep.wins, 'mine');
  assert.equal(out.push.length, 0, 'the newer remote version stays as it is');
});

test('failure mode 2: your offline edit has the later timestamp but you never saw their edit; theirs is kept as a copy', () => {
  // Base 08:00. The other device saved at 09:00. You edited offline at 10:00 without seeing it.
  const mine = rec('s1', 10, { wins: 'mine' });
  const theirs = rec('s1', 9, { wins: 'theirs' });
  const out = reconcile([mine], [theirs], { s1: { base: at(8), latest: at(10) } });
  assert.equal(out.conflicts.length, 1);
  assert.equal(out.conflicts[0].winner, 'local');
  assert.equal(out.conflicts[0].keep.wins, 'theirs', 'this is the edit plain last-write-wins used to overwrite silently');
  assert.deepEqual(out.push.map(r => r.wins), ['mine']);
});

test('a server copy that has not changed since your base is not a conflict', () => {
  const out = reconcile([rec('s1', 10)], [rec('s1', 8)], { s1: { base: at(8), latest: at(10) } });
  assert.equal(out.conflicts.length, 0);
});

test('with no known base the timestamps decide and nothing is flagged', () => {
  const out = reconcile([rec('s1', 10)], [rec('s1', 9)], { s1: { base: null, latest: at(10) } });
  assert.equal(out.conflicts.length, 0);
  assert.deepEqual(out.push.map(r => r.id), ['s1']);
});

test('several records are handled independently', () => {
  const local = [rec('a', 10), rec('b', 10), rec('c', 10)];
  const remote = [rec('a', 8), rec('b', 9), rec('c', 10)];
  const entries = {
    a: { base: at(8), latest: at(10) },
    b: { base: at(7), latest: at(10) },
    c: { base: at(8), latest: at(10) },
  };
  const out = reconcile(local, remote, entries);
  assert.deepEqual(out.push.map(r => r.id).sort(), ['a', 'b']);
  assert.deepEqual(out.clear, ['c']);
  assert.deepEqual(out.conflicts.map(c => c.id), ['b']);
});

// ── conflict copies ──────────────────────────────────────────────────────────────────────────

test('a conflict copy is stored with a readable label, newest first, and survives storage', () => {
  let list = [];
  list = addConflict(list, 'sessions', 's1', rec('s1', 10, { date: '2026-10-18' }), 'this device', at(12));
  list = addConflict(list, 'compositions', 'c1', { id: 'c1', title: 'Minuet in F', updated_at: at(9) }, 'other device', at(13));
  assert.equal(list[0].label, 'Minuet in F');
  assert.equal(list[1].label, 'Practice on 2026-10-18');
  assert.deepEqual(parseConflicts(serializeConflicts(list)), list);
});

test('the same version of a record is not kept twice, and the list is capped', () => {
  let list = addConflict([], 'sessions', 's1', rec('s1', 10), 'this device', at(12));
  assert.equal(addConflict(list, 'sessions', 's1', rec('s1', 10), 'this device', at(13)).length, 1);
  for (let i = 0; i < 30; i++) list = addConflict(list, 'sessions', `x${i}`, rec(`x${i}`, 10), 'this device', at(12));
  assert.equal(list.length, 20);
  assert.equal(list[0].id, 'x29');
});

test('restoring or dismissing a copy removes exactly that version', () => {
  let list = addConflict([], 'sessions', 's1', rec('s1', 10), 'this device', at(12));
  list = addConflict(list, 'sessions', 's1', rec('s1', 11), 'this device', at(12));
  assert.equal(removeConflict(list, 'sessions', 's1', at(10)).length, 1);
  assert.equal(removeConflict(list, 'sessions', 'other', at(10)).length, 2);
});

test('malformed stored conflicts are ignored', () => {
  assert.deepEqual(parseConflicts('nope'), []);
  assert.deepEqual(parseConflicts('{"a":1}'), []);
  assert.deepEqual(parseConflicts('[{"table":"sessions"},null,{"table":"sessions","id":"s","record":{"id":"s"}}]').length, 1);
});

test('recordLabel names each kind of record', () => {
  assert.equal(recordLabel('lessons', { date: '2026-10-05' }), 'Lesson on 2026-10-05');
  assert.equal(recordLabel('compositions', {}), 'Untitled piece');
  assert.equal(recordLabel('sessions', null), 'record');
});

// ── the outbox as the app uses it (fake storage, fake network) ─────────────────────────────

function harness(pushResults = []) {
  const prefs = {};
  const pushed = [];
  const queue = [...pushResults];
  const outbox = createOutbox({
    getPref: (k, f) => (k in prefs ? prefs[k] : f),
    setPref: (k, v) => { prefs[k] = v; },
    push: async (table, record) => { pushed.push({ table, id: record.id, updated_at: record.updated_at }); return queue.length ? queue.shift() : true; },
    now: () => at(20),
  });
  return { outbox, prefs, pushed };
}
const settle = () => new Promise(r => setTimeout(r, 0));

test('offline then online: the edit waits, then goes out on the next pull and stops waiting', async () => {
  const { outbox, pushed } = harness([false, true]); // first push fails (offline), second works
  const edited = rec('s1', 10, { wins: 'offline edit' });

  outbox.trackEdit('sessions', edited, at(8));
  assert.equal(await outbox.pushTracked('sessions', edited), false);
  assert.equal(outbox.pendingCount(), 1, 'a failed push leaves the edit waiting');

  // Later, the app reloads and pulls: the server still has the old version.
  const result = outbox.processPull('sessions', [edited], [rec('s1', 8)]);
  await settle();
  assert.deepEqual(result, { pushed: 1, conflicts: 0 });
  assert.equal(pushed.length, 2);
  assert.equal(outbox.pendingCount(), 0, 'the retry succeeded');
});

test('the waiting edits are remembered across an app restart', async () => {
  const first = harness([false]);
  const edited = rec('s1', 10);
  first.outbox.trackEdit('sessions', edited, at(8));
  await first.outbox.pushTracked('sessions', edited);

  // A fresh outbox reading the same stored preferences, as after the app is reopened.
  const reopened = createOutbox({ getPref: (k, f) => (k in first.prefs ? first.prefs[k] : f), setPref() {}, push: async () => true });
  assert.equal(reopened.pendingCount(), 1);
});

test('when nobody is signed in nothing is left waiting', async () => {
  const { outbox } = harness([null]);
  const edited = rec('s1', 10);
  outbox.trackEdit('sessions', edited, at(8));
  assert.equal(await outbox.pushTracked('sessions', edited), null);
  assert.equal(outbox.pendingCount(), 0);
});

test('a push that throws is treated as a failed push', async () => {
  const outbox = createOutbox({ getPref: (k, f) => f, setPref() {}, push: async () => { throw new Error('network'); } });
  const edited = rec('s1', 10);
  outbox.trackEdit('sessions', edited, at(8));
  assert.equal(await outbox.pushTracked('sessions', edited), false);
  assert.equal(outbox.pendingCount(), 1);
});

test('an edit made while an earlier push was in flight is still waiting afterwards', async () => {
  const { outbox } = harness();
  outbox.trackEdit('sessions', rec('s1', 10), at(8));
  const inFlight = outbox.pushTracked('sessions', rec('s1', 10));
  outbox.trackEdit('sessions', rec('s1', 11), at(10)); // edited again before the push returned
  await inFlight;
  assert.equal(outbox.pendingCount(), 1);
});

test('both sides changed: the loser is kept as a copy and the winner is pushed or left alone', async () => {
  // Failure mode 2 end to end: offline edit at 10:00 on a base of 08:00, server changed at 09:00.
  const { outbox, pushed } = harness();
  const mine = rec('s1', 10, { wins: 'mine' });
  outbox.trackEdit('sessions', mine, at(8));
  const out = outbox.processPull('sessions', [mine], [rec('s1', 9, { wins: 'theirs' })]);
  await settle();
  assert.deepEqual(out, { pushed: 1, conflicts: 1 });
  assert.equal(outbox.conflicts()[0].record.wins, 'theirs');
  assert.equal(outbox.conflicts()[0].side, 'other device');
  assert.equal(pushed.length, 1);

  // Failure mode 1: when the other side is newer it wins, our copy is kept, and nothing is pushed or left waiting.
  const b = harness();
  const old = rec('s2', 10, { wins: 'mine' });
  b.outbox.trackEdit('sessions', old, at(8));
  const out2 = b.outbox.processPull('sessions', [old], [rec('s2', 11, { wins: 'theirs' })]);
  await settle();
  assert.deepEqual(out2, { pushed: 0, conflicts: 1 });
  assert.equal(b.outbox.conflicts()[0].record.wins, 'mine');
  assert.equal(b.outbox.conflicts()[0].side, 'this device');
  assert.equal(b.pushed.length, 0);
  assert.equal(b.outbox.pendingCount(), 0, 'the remote version replaces ours, so there is nothing left to push');
});

test('pulling again after a conflict does not raise it again', async () => {
  const { outbox } = harness();
  const mine = rec('s1', 10, { wins: 'mine' });
  outbox.trackEdit('sessions', mine, at(8));
  outbox.processPull('sessions', [mine], [rec('s1', 9)]);
  await settle();
  outbox.processPull('sessions', [mine], [rec('s1', 10)]); // the server now has our version
  assert.equal(outbox.conflicts().length, 1);
});

test('a pull with nothing waiting does nothing', () => {
  const { outbox, pushed } = harness();
  assert.deepEqual(outbox.processPull('sessions', [rec('s1', 10)], [rec('s1', 12)]), { pushed: 0, conflicts: 0 });
  assert.equal(pushed.length, 0);
});

test('resolving a conflict copy removes it from the list', async () => {
  const { outbox } = harness();
  const mine = rec('s1', 10);
  outbox.trackEdit('sessions', mine, at(8));
  outbox.processPull('sessions', [mine], [rec('s1', 9)]);
  const [c] = outbox.conflicts();
  outbox.resolveConflict(c.table, c.id, c.record.updated_at);
  assert.equal(outbox.conflicts().length, 0);
});

// ── deleting a record ─────────────────────────────────────────────────────────────────────────

const gone = (id, h, extra = {}) => ({ id, date: '2026-10-19', updated_at: at(h), deletedAt: at(h), ...extra });   // a tombstone, as pulled

test('a row marked deletedAt is a tombstone', () => {
  assert.equal(isTombstone(gone('s1', 10)), true);
  assert.equal(isTombstone(rec('s1', 10)), false);
  assert.equal(isTombstone(null), false);
  assert.equal(isTombstone({ id: 'x', deletedAt: null }), false);
});

test('deleted on another device: it is removed here, and the tombstone is kept out of the merge', () => {
  const plan = planDeletes([rec('s1', 8)], [gone('s1', 10)], {});
  assert.deepEqual(plan.deleteLocal, ['s1']);
  assert.ok(plan.skip.has('s1'));
  assert.deepEqual([plan.revive, plan.push, plan.forget], [[], [], []]);
});

test('a record edited here after it was deleted elsewhere comes back; the newer edit wins', () => {
  const plan = planDeletes([rec('s1', 12)], [gone('s1', 10)], {});
  assert.deepEqual(plan.deleteLocal, []);
  assert.deepEqual(plan.revive, ['s1']);
  assert.ok(plan.skip.has('s1'), 'the tombstone itself is never merged in as if it were a record');
});

test('the same moment counts as deleted, not edited', () => {
  assert.deepEqual(planDeletes([rec('s1', 10)], [gone('s1', 10)], {}).deleteLocal, ['s1']);
});

test('a delete made here that the server has not recorded is kept out of the merge and sent again', () => {
  // The record was deleted at 10:00 and the request failed; the server still has the version from 08:00.
  const plan = planDeletes([], [rec('s1', 8)], { s1: at(10) });
  assert.ok(plan.skip.has('s1'));
  assert.deepEqual(plan.push, ['s1']);
  assert.deepEqual(plan.forget, []);
});

test('a record that was edited on another device after this delete is not suppressed', () => {
  const plan = planDeletes([], [rec('s1', 12)], { s1: at(10) });
  assert.ok(!plan.skip.has('s1'));
  assert.deepEqual(plan.push, []);
  assert.deepEqual(plan.forget, ['s1'], 'the edit wins, so this device stops insisting on the delete');
});

test('once the server has the tombstone, or has no row at all, the owed delete is dropped', () => {
  assert.deepEqual(planDeletes([], [gone('s1', 10)], { s1: at(10) }).forget, ['s1']);
  assert.deepEqual(planDeletes([], [], { s9: at(10) }).forget, ['s9'], 'never synced, or already removed: nothing to mark');
});

test('rows nobody deleted are left completely alone', () => {
  const plan = planDeletes([rec('a', 8), rec('b', 8)], [rec('a', 9), rec('c', 9)], {});
  assert.equal(plan.skip.size, 0);
  assert.deepEqual([plan.deleteLocal, plan.revive, plan.push, plan.forget], [[], [], [], []]);
});

test('Push all must not undo a deletion: a record is blocked by a deletion at least as new as it', () => {
  const index = tombstoneIndex([gone('s1', 10), rec('s2', 10), gone('s3', 6)]);
  assert.equal(blockedByDeletion(rec('s1', 8), index), true);
  assert.equal(blockedByDeletion(rec('s1', 10), index), true, 'the same moment');
  assert.equal(blockedByDeletion(rec('s1', 11), index), false, 'edited after the deletion');
  assert.equal(blockedByDeletion(rec('s2', 8), index), false, 'a live row is not a deletion');
  assert.equal(blockedByDeletion(rec('zzz', 8), index), false);
  assert.equal(index.size, 2);
});

test('the owed deletes are stored and read back, and junk is ignored', () => {
  const d = emptyDeletes();
  d.sessions.s1 = at(10); d.compositions.c1 = at(11);
  assert.deepEqual(parseDeletes(serializeDeletes(d)), d);
  assert.deepEqual(parseDeletes('nope'), emptyDeletes());
  assert.deepEqual(parseDeletes('{"sessions":{"a":5,"b":"","c":"2026"},"lessons":[1]}'), { ...emptyDeletes(), sessions: { c: '2026' } });
  assert.deepEqual(parseDeletes(null), emptyDeletes());
});

test('an unsynced edit can be dropped whatever was pushed', () => {
  const box = markDirty(emptyOutbox(), 'sessions', 's1', at(8), at(10));
  assert.equal(dirtyCount(dropDirty(box, 'sessions', 's1')), 0);
  assert.equal(dropDirty(box, 'sessions', 'other'), box, 'unchanged when it is not there');
});

test('a deletion that loses to a newer edit leaves no conflict copy, but an edit that loses to a deletion is kept', () => {
  // Edited offline at 10:00 on a base of 08:00; the other device deleted it at 09:00: the edit is newer.
  const win = reconcile([rec('s1', 10, { wins: 'mine' })], [gone('s1', 9)], { s1: { base: at(8), latest: at(10) } });
  assert.equal(win.conflicts.length, 0, 'there is nothing worth keeping from a deletion');
  assert.deepEqual(win.push.map(r => r.id), ['s1']);
  // Edited offline at 10:00; the other device deleted it at 11:00: the deletion is newer.
  const lose = reconcile([rec('s1', 10, { wins: 'mine' })], [gone('s1', 11)], { s1: { base: at(8), latest: at(10) } });
  assert.equal(lose.conflicts.length, 1);
  assert.equal(lose.conflicts[0].winner, 'remote');
  assert.equal(lose.conflicts[0].keep.wins, 'mine', 'the edit is kept, so it can be restored');
  assert.equal(lose.push.length, 0);
});

// ── the delete flow as the app uses it ──────────────────────────────────────────────────────────

function deleteHarness(tombstoneResults = []) {
  const prefs = {};
  const sent = [];
  const pushed = [];
  const queue = [...tombstoneResults];
  const outbox = createOutbox({
    getPref: (k, f) => (k in prefs ? prefs[k] : f),
    setPref: (k, v) => { prefs[k] = v; },
    push: async (table, record) => { pushed.push({ table, id: record.id }); return true; },
    tombstone: async (table, id, deletedAt) => { sent.push({ table, id, deletedAt }); return queue.length ? queue.shift() : true; },
    now: () => at(10),
  });
  return { outbox, prefs, sent, pushed };
}

test('deleting while online sends the tombstone and nothing is left owed', async () => {
  const { outbox, sent } = deleteHarness([true]);
  assert.equal(await outbox.trackDelete('sessions', 's1'), true);
  assert.deepEqual(sent, [{ table: 'sessions', id: 's1', deletedAt: at(10) }]);
  assert.equal(outbox.pendingDeleteCount(), 0);
});

test('deleting while the request fails: it is owed, kept out of the next pull, and sent again until it lands', async () => {
  const { outbox, sent } = deleteHarness([false, true]);       // the first send fails (no signal), the retry works
  assert.equal(await outbox.trackDelete('sessions', 's1'), false);
  assert.equal(outbox.pendingDeleteCount(), 1);

  // The next pull still has the record on the server. It must not come back.
  const serverCopy = rec('s1', 8);
  const plan = outbox.processDeletes('sessions', [], [serverCopy]);
  assert.ok(plan.skip.has('s1'), 'the record is kept out of the merge');
  await settle();
  assert.equal(sent.length, 2, 'and the tombstone was sent again');
  assert.equal(outbox.pendingDeleteCount(), 0, 'it landed, so it is no longer owed');
});

test('deleting while signed out is remembered, so signing in does not bring the record back', async () => {
  const { outbox } = deleteHarness([null, true]);
  assert.equal(await outbox.trackDelete('lessons', 'l1'), null);
  assert.equal(outbox.pendingDeleteCount(), 1);
  const plan = outbox.processDeletes('lessons', [], [rec('l1', 8)]);
  assert.ok(plan.skip.has('l1'));
  await settle();
  assert.equal(outbox.pendingDeleteCount(), 0);
});

test('an owed delete survives restarting the app', async () => {
  const first = deleteHarness([false]);
  await first.outbox.trackDelete('compositions', 'c1');
  const reopened = createOutbox({ getPref: (k, f) => (k in first.prefs ? first.prefs[k] : f), setPref() {}, push: async () => true });
  assert.equal(reopened.pendingDeleteCount(), 1);
});

test('a record deleted on another device is removed here', () => {
  const { outbox } = deleteHarness();
  const plan = outbox.processDeletes('sessions', [rec('s1', 8), rec('s2', 8)], [gone('s1', 10), rec('s2', 9)]);
  assert.deepEqual(plan.deleteLocal, ['s1']);
  assert.ok(plan.skip.has('s1') && !plan.skip.has('s2'));
});

test('a record edited here after it was deleted elsewhere is pushed back', async () => {
  const { outbox, pushed } = deleteHarness();
  const plan = outbox.processDeletes('sessions', [rec('s1', 12)], [gone('s1', 10)]);
  await settle();
  assert.deepEqual(plan.revive, ['s1']);
  assert.deepEqual(pushed, [{ table: 'sessions', id: 's1' }]);
});

test('saving a record again after deleting it (an undo) cancels the owed delete', async () => {
  const { outbox } = deleteHarness([false]);
  await outbox.trackDelete('sessions', 's1');
  assert.equal(outbox.pendingDeleteCount(), 1);
  outbox.trackEdit('sessions', rec('s1', 11), at(8));
  assert.equal(outbox.pendingDeleteCount(), 0);
});

test('deleting a record forgets any unsynced edit of it, so it is not pushed back by the retry', async () => {
  const { outbox } = deleteHarness();
  outbox.trackEdit('sessions', rec('s1', 9), at(8));
  assert.equal(outbox.pendingCount(), 1);
  await outbox.trackDelete('sessions', 's1');
  assert.equal(outbox.pendingCount(), 0);
});

test('a thrown error while sending counts as a failed send and keeps the delete owed', async () => {
  const prefs = {};
  const outbox = createOutbox({ getPref: (k, f) => (k in prefs ? prefs[k] : f), setPref: (k, v) => { prefs[k] = v; }, push: async () => true, tombstone: async () => { throw new Error('network'); }, now: () => at(10) });
  assert.equal(await outbox.trackDelete('sessions', 's1'), false);
  assert.equal(outbox.pendingDeleteCount(), 1);
});

test('only the newest 300 owed deletes per table are kept', async () => {
  const { outbox } = deleteHarness(Array(400).fill(false));
  for (let i = 0; i < 350; i++) await outbox.trackDelete('sessions', `s${i}`, `2026-10-19T10:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}.000Z`);
  assert.equal(outbox.pendingDeleteCount(), 300);
});

test('an outbox made without a tombstone sender still works (nothing is sent; the delete stays owed)', async () => {
  const prefs = {};
  const outbox = createOutbox({ getPref: (k, f) => (k in prefs ? prefs[k] : f), setPref: (k, v) => { prefs[k] = v; }, push: async () => true });
  assert.equal(await outbox.trackDelete('sessions', 's1'), null);
  assert.equal(outbox.pendingDeleteCount(), 1);
});
