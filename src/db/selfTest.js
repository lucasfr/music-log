// "Check sync": a few quick checks of the whole Supabase path, run from Settings. Pure (the client
// is passed in, nothing from React Native is imported), so it's unit-tested in plain Node, see
// tests/selfTest.test.mjs.
//
// It answers the questions that otherwise need a second device and some patience:
//   - does each table have every column the app writes (and so does `data` carry the extras)?
//   - can this account write a row, read it back intact, and remove it?
//   - do this device and the server agree on how many records there are?
//   - is anything still waiting to be sent from this device?
//
// The test row is written as an already-deleted record (a tombstone), so if another device pulls in
// the moment before it is removed, that device ignores it instead of showing a stray session.
// It is then removed for good, so it never lingers on the server either.

import { REMOTE_COLUMNS, missingColumn, missingColumnHint } from './records.js';

const TABLES = ['sessions', 'lessons', 'compositions'];
const LABELS = { sessions: 'Sessions', lessons: 'Lessons', compositions: 'Pieces' };

const ok = (label, detail) => ({ label, status: 'ok', detail });
const warn = (label, detail) => ({ label, status: 'warn', detail });
const fail = (label, detail) => ({ label, status: 'fail', detail });

const timeOf = v => {
  const t = new Date(v || 0).getTime();
  return Number.isFinite(t) ? t : 0;
};

// Does the table have every column the app writes?
async function checkColumns(client, table, uid) {
  const label = `${LABELS[table]} table`;
  const columns = REMOTE_COLUMNS[table];
  const { error } = await client.from(table).select(columns.join(', ')).eq('user_id', uid).limit(1);
  if (!error) return ok(label, 'Has every column the app writes.');
  const column = missingColumn(error.message);
  if (column) return fail(label, missingColumnHint(table, [column]));
  return fail(label, `Can't read it: ${error.message}`);
}

// Write a row, read it back, remove it.
async function checkRoundTrip(client, uid, now) {
  const label = 'Write, read back, remove';
  const id = `selftest-${Date.now().toString(36)}`;
  const at = now();
  const row = {
    id, user_id: uid, date: '1970-01-01', duration: 0, segments: [],
    created_at: at, updated_at: at,
    data: { deletedAt: at, probe: 'selftest', nested: { n: 1, list: ['a', 'b'] } },
  };
  let wrote = false;
  try {
    const put = await client.from('sessions').upsert(row, { onConflict: 'id' });
    if (put.error) return fail(label, `The server refused the write: ${put.error.message}`);
    wrote = true;

    const got = await client.from('sessions').select('*').eq('id', id).eq('user_id', uid);
    if (got.error) return fail(label, `Wrote the row but couldn't read it back: ${got.error.message}`);
    const back = got.data && got.data[0];
    if (!back) return fail(label, 'Wrote the row but it did not come back. Check the read policy on the table.');
    const intact = back.data && back.data.probe === 'selftest' && back.data.nested && back.data.nested.n === 1
      && Array.isArray(back.data.nested.list) && back.data.nested.list.length === 2;
    if (!intact) return fail(label, 'The row came back without its extra fields, so they would not sync.');
    if (timeOf(back.updated_at) !== timeOf(at)) return warn(label, 'The row came back with a different updated_at, which can confuse the merge.');

    const del = await client.from('sessions').delete().eq('id', id).eq('user_id', uid);
    wrote = !!del.error;   // still there only if the removal failed
    if (del.error) return warn(label, `Worked, but the test row could not be removed (${del.error.message}). It is marked deleted, so it does no harm.`);
    return ok(label, 'This account can write, read back and remove rows.');
  } catch (e) {
    return fail(label, `Failed: ${e.message}`);
  } finally {
    if (wrote) { try { await client.from('sessions').delete().eq('id', id).eq('user_id', uid); } catch { /* best effort */ } }
  }
}

// Do this device and the server hold the same number of (not deleted) records?
async function checkCount(client, table, uid, localCount) {
  const label = `${LABELS[table]} on this device and on the server`;
  const { count, error } = await client.from(table).select('id', { count: 'exact', head: true }).eq('user_id', uid).is('data->>deletedAt', null);
  if (error || typeof count !== 'number') return warn(label, "Couldn't count the server's rows.");
  if (typeof localCount !== 'number') return ok(label, `${count} on the server.`);
  if (count === localCount) return ok(label, `${count} on both.`);
  return warn(label, `${localCount} here, ${count} on the server. Pull or push from Settings, then check again.`);
}

// What is still waiting on this device. `queue` is { edits, deletes, conflicts } (counts).
function checkQueue(queue) {
  const label = 'Waiting to be sent';
  const edits = queue.edits || 0;
  const deletes = queue.deletes || 0;
  const conflicts = queue.conflicts || 0;
  const parts = [];
  if (edits) parts.push(`${edits} ${edits === 1 ? 'edit' : 'edits'}`);
  if (deletes) parts.push(`${deletes} ${deletes === 1 ? 'delete' : 'deletes'}`);
  const out = [];
  out.push(parts.length ? warn(label, `${parts.join(' and ')} not on the server yet. They are retried at the next sync.`) : ok(label, 'Nothing.'));
  if (conflicts) out.push(warn('Conflict copies', `${conflicts} ${conflicts === 1 ? 'record was' : 'records were'} edited on two devices. See Conflicts in Settings.`));
  return out;
}

// Run every check. `client` is a signed-in Supabase client, `uid` the user's id,
// `local` the number of records on this device per table ({ sessions, lessons, compositions }),
// `queue` the outbox counts ({ edits, deletes, conflicts }).
// -> [{ label, status: 'ok' | 'warn' | 'fail', detail }]
export async function runSyncSelfTest({ client, uid, local = {}, queue = {}, now = () => new Date().toISOString() }) {
  if (!client || !uid) return [fail('Signed in', 'Sign in first: there is nothing to check without an account.')];
  const checks = [ok('Signed in', 'Signed in to Supabase.')];

  const columnChecks = [];
  for (const table of TABLES) columnChecks.push(await checkColumns(client, table, uid));
  checks.push(...columnChecks);

  // The round trip and the counts only mean something when the tables can be read.
  const sessionsOk = columnChecks[0].status === 'ok';
  if (sessionsOk) checks.push(await checkRoundTrip(client, uid, now));
  else checks.push(warn('Write, read back, remove', 'Skipped until the sessions table is fixed.'));

  TABLES.forEach((table, i) => { if (columnChecks[i].status === 'ok') checks.push({ _count: table }); });
  for (let i = 0; i < checks.length; i++) {
    if (checks[i]._count) checks[i] = await checkCount(client, checks[i]._count, uid, local[checks[i]._count]);
  }

  checks.push(...checkQueue(queue));
  return checks;
}

// A one-line verdict for the top of the results.
export function summariseSelfTest(checks) {
  const failed = checks.filter(c => c.status === 'fail').length;
  const warned = checks.filter(c => c.status === 'warn').length;
  if (failed) return { status: 'fail', text: `${failed} ${failed === 1 ? 'problem' : 'problems'} found` + (warned ? `, ${warned} to look at` : '') };
  if (warned) return { status: 'warn', text: `Working, with ${warned} ${warned === 1 ? 'thing' : 'things'} to look at` };
  return { status: 'ok', text: 'Everything checks out' };
}
