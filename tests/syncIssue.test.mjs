// Tests for which sync errors get shown (src/db/syncIssue.js).  Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '../src/db/syncIssue.js'), 'utf8');
const { syncIssue, sameIssue, isConnectivityError } =
  await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('no errors means no issue', () => {
  assert.equal(syncIssue({}), null);
  assert.equal(syncIssue(undefined), null);
  assert.equal(syncIssue({ 'push:sessions': null }), null);
});

test('being offline never raises an issue, in any of the ways it is reported', () => {
  for (const m of ['Failed to fetch', 'Network request failed', 'The Internet connection appears to be offline.',
    'Load failed', 'Request timed out', 'timeout of 10000ms exceeded', 'TypeError: NetworkError when attempting to fetch resource.', 'ECONNREFUSED', 'getaddrinfo ENOTFOUND x.supabase.co', 'The operation was aborted']) {
    assert.equal(isConnectivityError(m), true, m);
    assert.equal(syncIssue({ 'push:compositions': m }), null, m);
  }
});

test('real problems do raise one: a missing column, auth, row-level security, bad input', () => {
  for (const m of [
    'Supabase "compositions" has no "tempo" column, so it won\'t sync. Run in the SQL editor: alter table compositions add column if not exists tempo integer;',
    'JWT expired', 'new row violates row-level security policy for table "sessions"', 'invalid input syntax for type integer: ""',
  ]) {
    assert.equal(isConnectivityError(m), false, m);
    assert.ok(syncIssue({ 'push:compositions': m }), m);
  }
});

test('the title says which data and which direction', () => {
  assert.equal(syncIssue({ 'push:compositions': 'x' }).title, "Pieces didn't save to Supabase");
  assert.equal(syncIssue({ 'push:sessions': 'x' }).title, "Practice sessions didn't save to Supabase");
  assert.equal(syncIssue({ 'pull:lessons': 'x' }).title, "Lessons couldn't be loaded from Supabase");
  assert.equal(syncIssue({ sync: 'x' }).title, 'Sync problem');
  assert.equal(syncIssue({ 'push:widgets': 'x' }).title, "widgets didn't save to Supabase");
});

test('an offline error does not hide a real one next to it', () => {
  const issue = syncIssue({ 'pull:sessions': 'Failed to fetch', 'push:compositions': 'JWT expired' });
  assert.equal(issue.scope, 'push:compositions');
  assert.equal(issue.message, 'JWT expired');
});

test('sameIssue compares the problem, not the object', () => {
  const a = syncIssue({ 'push:compositions': 'JWT expired' });
  const b = syncIssue({ 'push:compositions': 'JWT expired' });
  assert.notEqual(a, b);
  assert.equal(sameIssue(a, b), true);
  assert.equal(sameIssue(a, syncIssue({ 'push:compositions': 'other' })), false);
  assert.equal(sameIssue(null, null), true);
  assert.equal(sameIssue(a, null), false);
});
