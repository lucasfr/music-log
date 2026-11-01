import test from 'node:test';
import assert from 'node:assert/strict';
import { planPull, pullChanged, isFullPullDue, FULL_PULL_EVERY_MS } from '../src/db/pullPlan.js';
import { unpackRemote, mergeRows } from '../src/db/records.js';
import { planDeletes, reconcile } from '../src/utils/syncQueue.js';
import { fakeSupabase } from './fakeSupabase.mjs';

const T = (n) => `2026-10-${String(n).padStart(2, '0')}T10:00:00.000Z`;
const row = (id, day, extra = {}) => ({ id, user_id: 'u1', date: '2026-10-01', updated_at: T(day), created_at: T(1), segments: [{ group: 'Scales' }], data: null, ...extra });

test('isFullPullDue: never pulled, stale, fresh, and a clock that went backwards', () => {
  const now = Date.parse(T(20));
  assert.equal(isFullPullDue(undefined, now), true);
  assert.equal(isFullPullDue('', now), true);
  assert.equal(isFullPullDue('garbage', now), true);
  assert.equal(isFullPullDue(new Date(now - FULL_PULL_EVERY_MS - 1).toISOString(), now), true);
  assert.equal(isFullPullDue(new Date(now - 60 * 1000).toISOString(), now), false);
  assert.equal(isFullPullDue(new Date(now + 60 * 1000).toISOString(), now), true);
});

test('planPull: unchanged rows need no download, changed and new ones do, deletions never do', () => {
  const local = [{ id: 'a', updated_at: T(5) }, { id: 'b', updated_at: T(5) }, { id: 'only-here', updated_at: T(5) }];
  const index = [
    { id: 'a', updated_at: T(5), deleted_at: null },                 // same version
    { id: 'b', updated_at: T(9), deleted_at: null },                 // changed elsewhere
    { id: 'c', updated_at: T(3), deleted_at: null },                 // new to this device
    { id: 'd', updated_at: T(7), deleted_at: T(7) },                 // deleted elsewhere, never seen here
  ];
  const { rows, fetch } = planPull(index, local);
  assert.deepEqual(fetch, ['b', 'c']);
  assert.deepEqual(rows, [
    { id: 'a', updated_at: T(5) },
    { id: 'd', updated_at: T(7), deletedAt: T(7) },
  ]);
});

test('planPull: the same moment written two ways counts as the same version', () => {
  const local = [{ id: 'a', updated_at: '2026-10-05T10:00:00.000Z' }];
  const index = [{ id: 'a', updated_at: '2026-10-05T10:00:00+00:00', deleted_at: null }];
  assert.deepEqual(planPull(index, local).fetch, []);
});

test('planPull: tolerates empty and junk input', () => {
  assert.deepEqual(planPull(undefined, undefined), { rows: [], fetch: [] });
  assert.deepEqual(planPull([null, {}], []), { rows: [], fetch: [] });
});

test('pullChanged downloads only the rows that differ', async () => {
  const server = [row('a', 5), row('b', 9), row('c', 3), row('d', 7, { data: { deletedAt: T(7) } })];
  const { client, log } = fakeSupabase({ sessions: server }, { schema: { sessions: ['id', 'user_id', 'date', 'updated_at', 'created_at', 'segments', 'data'] } });
  const local = [{ id: 'a', updated_at: T(5) }, { id: 'b', updated_at: T(5) }];
  const res = await pullChanged(client, 'sessions', 'u1', local);
  assert.equal(res.error, undefined);
  assert.deepEqual(res.fetched.map(r => r.id).sort(), ['b', 'c']);
  assert.deepEqual(res.rows.map(r => r.id).sort(), ['a', 'd']);
  const fullDownloads = log.filter(l => l.columns === '*');
  assert.equal(fullDownloads.length, 1);
  assert.deepEqual(fullDownloads[0].inValues.sort(), ['b', 'c']);
});

test('pullChanged downloads nothing when nothing changed', async () => {
  const { client, log } = fakeSupabase({ sessions: [row('a', 5), row('b', 6)] });
  const local = [{ id: 'a', updated_at: T(5) }, { id: 'b', updated_at: T(6) }];
  const res = await pullChanged(client, 'sessions', 'u1', local);
  assert.equal(res.fetched.length, 0);
  assert.equal(res.rows.length, 2);
  assert.equal(log.filter(l => l.columns === '*').length, 0);
});

test('pullChanged pages the index and chunks the downloads', async () => {
  const server = Array.from({ length: 7 }, (_, i) => row(`r${i}`, 5, { created_at: T(1 + i) }));
  const { client, log } = fakeSupabase({ sessions: server });
  const res = await pullChanged(client, 'sessions', 'u1', [], { pageSize: 3, chunk: 2 });
  assert.equal(res.fetched.length, 7);
  assert.equal(log.filter(l => l.columns !== '*').length, 3);   // 3 + 3 + 1 rows: three index pages
  assert.equal(log.filter(l => l.columns === '*').length, 4);   // 2 + 2 + 2 + 1 ids: four downloads
});

test('pullChanged only sees this user\'s rows', async () => {
  const { client } = fakeSupabase({ sessions: [row('mine', 5), row('theirs', 5, { user_id: 'u2' })] });
  const res = await pullChanged(client, 'sessions', 'u1', []);
  assert.deepEqual(res.fetched.map(r => r.id), ['mine']);
});

test('pullChanged reports an error (so the caller can fall back to a full pull) when the index fails', async () => {
  const { client } = fakeSupabase({ sessions: [row('a', 5)] }, { schema: { sessions: ['id', 'user_id', 'updated_at', 'created_at'] } });
  const res = await pullChanged(client, 'sessions', 'u1', []);   // this table has no `data` column
  assert.ok(res.error);
  assert.match(res.error.message, /data/);
});

test('pullChanged reports an error when a download fails', async () => {
  const { client } = fakeSupabase({ sessions: [row('a', 5)] }, { failOn: {} });
  const flaky = { from: t => { const q = client.from(t); const sel = q.select.bind(q); q.select = (c, o) => { sel(c, o); if (c === '*') q.run = () => ({ data: null, error: { message: 'boom' } }); return q; }; return q; } };
  const res = await pullChanged(flaky, 'sessions', 'u1', []);
  assert.equal(res.error.message, 'boom');
});

// ── The rows it returns behave like a full pull's rows for everything downstream ──

test('a stub for an unchanged row leaves the local record exactly as it was in the merge', () => {
  const local = [{ id: 'a', updated_at: T(5), notes: 'mine', rating: 4 }];
  const { rows } = planPull([{ id: 'a', updated_at: T(5), deleted_at: null }], local);
  const merged = mergeRows(local, rows);
  assert.equal(merged[0], local[0]);   // the very same object: nothing to save
});

test('a downloaded row wins the merge exactly as before', () => {
  const local = [{ id: 'a', updated_at: T(5), notes: 'old' }];
  const fetched = [unpackRemote(row('a', 9, { data: { notes: 'new' } }))];
  const merged = mergeRows(local, fetched);
  assert.equal(merged[0].notes, 'new');
});

test('delete handling: a deletion from another device arrives without downloading the row', () => {
  const local = [{ id: 'gone', updated_at: T(5) }];
  const { rows, fetch } = planPull([{ id: 'gone', updated_at: T(8), deleted_at: T(8) }], local);
  assert.deepEqual(fetch, []);
  const plan = planDeletes(local, rows, {});
  assert.deepEqual(plan.deleteLocal, ['gone']);
  assert.ok(plan.skip.has('gone'));
});

test('delete handling: an edit made here after the deletion still revives the record', () => {
  const local = [{ id: 'x', updated_at: T(12) }];
  const { rows } = planPull([{ id: 'x', updated_at: T(8), deleted_at: T(8) }], local);
  const plan = planDeletes(local, rows, {});
  assert.deepEqual(plan.revive, ['x']);
});

test('delete handling: a delete made here that the server has not seen yet is still sent', () => {
  // This device deleted 'x' (so local no longer has it); the server still has it live. It is not in
  // local, so it is downloaded in full, and planDeletes sees a live row owed a deletion.
  const { rows, fetch } = planPull([{ id: 'x', updated_at: T(4), deleted_at: null }], []);
  assert.deepEqual(fetch, ['x']);
  const full = [unpackRemote(row('x', 4))];
  const plan = planDeletes([], [...rows, ...full], { x: T(9) });
  assert.deepEqual(plan.push, ['x']);
  assert.ok(plan.skip.has('x'));
});

test('outbox reconcile: an edit that already reached the server is recognised from the stub', () => {
  const local = [{ id: 'a', updated_at: T(5) }];
  const { rows } = planPull([{ id: 'a', updated_at: T(5), deleted_at: null }], local);
  const out = reconcile(local, rows, { a: { base: T(2), latest: T(5) } });
  assert.deepEqual(out.clear, ['a']);
  assert.deepEqual(out.push, []);
});
