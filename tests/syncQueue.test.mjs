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
