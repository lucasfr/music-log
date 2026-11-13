// Round-trip tests for records (src/db/records.js): what the app pushes to Supabase, what the server
// keeps, and what comes back on a pull.  Run with: npm test
//
// records.test.mjs checks the pieces one at a time. These run the real push (toRemoteRow, which used to
// live in sync.js where nothing could reach it) into the real pull (unpackRemote and
// fromRemoteComposition) and check that nothing is lost or renamed on the way. They go field by field
// from a fixture, and they add fields that do not exist yet: the bug this guards against is a new field
// that is saved on one device and silently missing on the next (a name in the wrong case, a field left
// out of a list), and the answer is that no field is ever listed by hand.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '../src/db/records.js'), 'utf8');
const { toRemoteRow, unpackRemote, fromRemoteComposition, REMOTE_COLUMNS } =
  await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

const NOW = '2026-11-13T12:00:00.000Z';

// Records as the forms save them (the same ones records.test.mjs uses).
const SESSION = { id: 's1', date: '2026-10-14', energy: 1, enjoyment: 4, duration: 25, segments: [{ id: 'g1', type: 'technique', group: 'Scales', articulation: { rh: 'legato' }, tempo_bpm: 80 }], wins: 'ok', tomorrowFocus: 'Hanon 3', createdAt: '2026-10-14T20:00:00Z', updated_at: '2026-10-14T20:00:01Z' };
const LESSON = { id: 'l1', type: 'lesson', date: '2026-10-12', teacher: 'Kerrin', duration: 45, energy: 2, enjoyment: 5, segments: [], overallNotes: 'good', wins: 'w', nextFocus: 'scales', createdAt: '2026-10-12T18:00:00Z', updated_at: '2026-10-12T19:00:00Z' };
const PIECE = {
  id: 'c1', title: 'Minuet', composer: 'Mozart', arrangement: '', collection: 'Anna Magdalena', status: 'consolidating', grade: 'Grade 3',
  keys: [{ root: 'F', mode: 'major' }], timeSigs: ['3/4'], tempo: 96, difficulty: 3, liking: 4, year: '1725', tags: ['baroque'],
  dateStarted: '2026-02-01', dateCompleted: '', info: 'x', technicalChallenges: 't', musicalFocus: 'm', practiceNotes: 'p',
  kerrinNotes: 'k', teacherFeedback: 'f', myNotes: 'n', resourceSheet: 's', resourceRecordings: 'r', resourceTutorials: 'u',
  shelvedAt: undefined, createdAt: '2026-01-01T00:00:00Z', updated_at: '2026-10-14T10:00:00Z',
};
const FIXTURES = { sessions: SESSION, lessons: LESSON, compositions: PIECE };

// Fields that do not exist yet, in both spellings: a future camelCase one and a future snake_case one.
const FUTURE = { futureField: { nested: [1, 2, { deep: true }] }, some_future_snake: 'kept', futureZero: 0, futureEmpty: '' };

// What comes back on a pull, after the row has been through the server (only its columns, as JSON).
function trip(table, record) {
  const row = toRemoteRow(table, record, 'user-1', NOW);
  for (const key of Object.keys(row)) {
    assert.ok(REMOTE_COLUMNS[table].includes(key), `${table}: the pushed row has "${key}", which is not a column, so Supabase would reject the whole row`);
  }
  const stored = JSON.parse(JSON.stringify(row));
  const pulled = unpackRemote(stored);
  return table === 'compositions' ? fromRemoteComposition(pulled) : pulled;
}

for (const [table, fixture] of Object.entries(FIXTURES)) {
  test(`${table}: every field comes back from a push and a pull, including fields that do not exist yet`, () => {
    const record = { ...fixture, ...FUTURE };
    const pulled = trip(table, record);
    for (const [key, value] of Object.entries(record)) {
      if (value === undefined) continue;
      assert.deepEqual(pulled[key], value, `${table}.${key} was lost or changed on the way`);
    }
  });

  test(`${table}: a push and a pull add nothing but the two fields the server owns`, () => {
    const pulled = trip(table, { ...fixture, ...FUTURE });
    const allowed = new Set([...Object.keys(fixture), ...Object.keys(FUTURE), 'user_id', 'created_at']);
    for (const key of Object.keys(pulled)) assert.ok(allowed.has(key), `${table}: "${key}" appeared from nowhere`);
  });

  test(`${table}: pushing does not change the record it was given`, () => {
    const record = { ...fixture, ...FUTURE };
    const copy = JSON.parse(JSON.stringify(record));
    toRemoteRow(table, record, 'user-1', NOW);
    assert.deepEqual(JSON.parse(JSON.stringify(record)), copy);
  });
}

test('camelCase timestamps become the columns, and a missing updated_at is filled in', () => {
  const row = toRemoteRow('sessions', { id: 'a', date: 'd', createdAt: 'c', updatedAt: 'u' }, 'me', NOW);
  assert.equal(row.created_at, 'c');
  assert.equal(row.updated_at, 'u');
  assert.equal('createdAt' in row, false);
  assert.equal('updatedAt' in row, false);
  assert.equal(toRemoteRow('sessions', { id: 'a', date: 'd' }, 'me', NOW).updated_at, NOW);
  assert.equal(toRemoteRow('sessions', { id: 'a', date: 'd' }, 'me', NOW).user_id, 'me');
});

test('a piece\'s tempo goes out as a whole number or null, never as text, and its time signatures use the column name', () => {
  assert.equal(toRemoteRow('compositions', { id: 'c', title: 't', tempo: '96' }, 'me', NOW).tempo, 96);
  assert.equal(toRemoteRow('compositions', { id: 'c', title: 't', tempo: 91.6 }, 'me', NOW).tempo, 92);
  for (const bad of ['', 0, -3, 'fast', null]) assert.equal(toRemoteRow('compositions', { id: 'c', title: 't', tempo: bad }, 'me', NOW).tempo, null, String(bad));
  assert.equal('tempo' in toRemoteRow('compositions', { id: 'c', title: 't' }, 'me', NOW), false, 'no tempo given, none sent');
  const row = toRemoteRow('compositions', { id: 'c', title: 't', timeSigs: ['6/8'] }, 'me', NOW);
  assert.deepEqual(row.time_sigs, ['6/8']);
  assert.equal('timeSigs' in row, false);
});

test('a table the app has no column list for is sent whole, with the user id', () => {
  assert.deepEqual(toRemoteRow('widgets', { id: 'w', anything: 1 }, 'me', NOW), { id: 'w', anything: 1, user_id: 'me', updated_at: NOW });
});
