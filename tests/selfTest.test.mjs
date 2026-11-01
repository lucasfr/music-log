import test from 'node:test';
import assert from 'node:assert/strict';
import { runSyncSelfTest, summariseSelfTest } from '../src/db/selfTest.js';
import { REMOTE_COLUMNS } from '../src/db/records.js';
import { fakeSupabase } from './fakeSupabase.mjs';

const FULL_SCHEMA = { sessions: REMOTE_COLUMNS.sessions, lessons: REMOTE_COLUMNS.lessons, compositions: REMOTE_COLUMNS.compositions };
const live = (id, user = 'u1') => ({ id, user_id: user, date: '2026-10-01', updated_at: '2026-10-01T10:00:00.000Z', created_at: '2026-10-01T10:00:00.000Z', data: null });
const byLabel = (checks, label) => checks.find(c => c.label === label);

test('everything fine: all checks pass and the test row is gone afterwards', async () => {
  const db = fakeSupabase({ sessions: [live('s1'), live('s2')], lessons: [live('l1')], compositions: [] }, { schema: FULL_SCHEMA });
  const checks = await runSyncSelfTest({ client: db.client, uid: 'u1', local: { sessions: 2, lessons: 1, compositions: 0 }, queue: {} });
  assert.deepEqual(checks.filter(c => c.status !== 'ok'), []);
  assert.equal(summariseSelfTest(checks).status, 'ok');
  assert.equal(db.tables.sessions.length, 2);                       // the probe was removed
  assert.ok(db.tables.sessions.every(r => !String(r.id).startsWith('selftest')));
});

test('the test row is written as an already-deleted record', async () => {
  const db = fakeSupabase({ sessions: [], lessons: [], compositions: [] }, { schema: FULL_SCHEMA });
  const seen = [];
  const spy = { from: t => { const q = db.client.from(t); const up = q.upsert.bind(q); q.upsert = r => { seen.push(r); return up(r); }; return q; } };
  await runSyncSelfTest({ client: spy, uid: 'u1' });
  assert.equal(seen.length, 1);
  assert.ok(seen[0].data.deletedAt, 'other devices must see it as a deletion');
  assert.equal(seen[0].user_id, 'u1');
});

test('a table without the data column fails with the statement to fix it, and skips the round trip', async () => {
  const schema = { ...FULL_SCHEMA, sessions: REMOTE_COLUMNS.sessions.filter(c => c !== 'data') };
  const db = fakeSupabase({ sessions: [], lessons: [], compositions: [] }, { schema });
  const checks = await runSyncSelfTest({ client: db.client, uid: 'u1' });
  const table = byLabel(checks, 'Sessions table');
  assert.equal(table.status, 'fail');
  assert.match(table.detail, /add column if not exists data jsonb/);
  assert.equal(byLabel(checks, 'Write, read back, remove').status, 'warn');
  assert.equal(summariseSelfTest(checks).status, 'fail');
  assert.equal(db.log.filter(l => l.mode === 'upsert').length, 0);   // nothing written
});

test('a refused write is a failure', async () => {
  const db = fakeSupabase({ sessions: [], lessons: [], compositions: [] }, { schema: FULL_SCHEMA, failOn: { 'sessions:upsert': 'new row violates row-level security policy' } });
  const checks = await runSyncSelfTest({ client: db.client, uid: 'u1' });
  const rt = byLabel(checks, 'Write, read back, remove');
  assert.equal(rt.status, 'fail');
  assert.match(rt.detail, /row-level security/);
});

test('a row that comes back without its extra fields is a failure, and is still cleaned up', async () => {
  const db = fakeSupabase({ sessions: [], lessons: [], compositions: [] }, { schema: FULL_SCHEMA });
  // A server that drops what is inside `data`.
  const lossy = { from: t => { const q = db.client.from(t); const up = q.upsert.bind(q); q.upsert = r => up({ ...r, data: {} }); return q; } };
  const checks = await runSyncSelfTest({ client: lossy, uid: 'u1' });
  assert.equal(byLabel(checks, 'Write, read back, remove').status, 'fail');
  assert.equal(db.tables.sessions.length, 0);
});

test('counts that differ are a warning that says by how much', async () => {
  const db = fakeSupabase({ sessions: [live('s1'), live('s2'), live('s3')], lessons: [], compositions: [] }, { schema: FULL_SCHEMA });
  const checks = await runSyncSelfTest({ client: db.client, uid: 'u1', local: { sessions: 2, lessons: 0, compositions: 0 } });
  const c = byLabel(checks, 'Sessions on this device and on the server');
  assert.equal(c.status, 'warn');
  assert.match(c.detail, /2 here, 3 on the server/);
  assert.equal(summariseSelfTest(checks).status, 'warn');
});

test('deleted records do not count towards the server total', async () => {
  const gone = { ...live('s9'), data: { deletedAt: '2026-10-02T10:00:00.000Z' } };
  const db = fakeSupabase({ sessions: [live('s1'), gone], lessons: [], compositions: [] }, { schema: FULL_SCHEMA });
  const checks = await runSyncSelfTest({ client: db.client, uid: 'u1', local: { sessions: 1, lessons: 0, compositions: 0 } });
  assert.equal(byLabel(checks, 'Sessions on this device and on the server').status, 'ok');
});

test("another user's rows are not counted", async () => {
  const db = fakeSupabase({ sessions: [live('s1'), live('x', 'u2')], lessons: [], compositions: [] }, { schema: FULL_SCHEMA });
  const checks = await runSyncSelfTest({ client: db.client, uid: 'u1', local: { sessions: 1, lessons: 0, compositions: 0 } });
  assert.equal(byLabel(checks, 'Sessions on this device and on the server').status, 'ok');
});

test('unsent edits, deletes and conflict copies are reported', async () => {
  const db = fakeSupabase({ sessions: [], lessons: [], compositions: [] }, { schema: FULL_SCHEMA });
  const checks = await runSyncSelfTest({ client: db.client, uid: 'u1', queue: { edits: 1, deletes: 2, conflicts: 3 } });
  const waiting = byLabel(checks, 'Waiting to be sent');
  assert.equal(waiting.status, 'warn');
  assert.match(waiting.detail, /1 edit and 2 deletes/);
  assert.match(byLabel(checks, 'Conflict copies').detail, /3 records were/);
});

test('not signed in: one failed check, nothing run', async () => {
  const checks = await runSyncSelfTest({ client: null, uid: null });
  assert.equal(checks.length, 1);
  assert.equal(checks[0].status, 'fail');
});

test('summariseSelfTest wording', () => {
  assert.equal(summariseSelfTest([{ status: 'ok' }]).text, 'Everything checks out');
  assert.equal(summariseSelfTest([{ status: 'warn' }]).text, 'Working, with 1 thing to look at');
  assert.equal(summariseSelfTest([{ status: 'fail' }, { status: 'fail' }, { status: 'warn' }]).text, '2 problems found, 1 to look at');
});
