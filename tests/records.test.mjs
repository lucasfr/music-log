// Tests for the remote record helpers (src/db/records.js).  Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '../src/db/records.js'), 'utf8');
const { fromRemoteComposition, missingColumn, missingColumnHint, packRecord, unpackRecord, REMOTE_COLUMNS, extrasFor, unpackRemote, mergeRows } =
  await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

// What the sync merge does when the remote row wins (see mergeRows in src/db/sync.js).
const mergeRemoteWins = (local, remote) => ({ ...local, ...fromRemoteComposition(remote) });

test('time_sigs becomes timeSigs, so the metronome can read a piece that came from another device', () => {
  const c = fromRemoteComposition({ id: 'a', title: 'Minuet', time_sigs: ['3/4'], tempo: 92 });
  assert.deepEqual(c.timeSigs, ['3/4']);
  assert.equal('time_sigs' in c, false);
  assert.equal(c.tempo, 92);
});

test('a piece pulled from Supabase gives the metronome both its tempo and its time signature', () => {
  // the same reads MetronomeControl does
  const c = fromRemoteComposition({ id: 'a', time_sigs: ['6/8'], tempo: '72' });
  assert.equal(Number(c?.tempo) || 90, 72);
  assert.equal((c?.timeSigs && c.timeSigs[0]) || '4/4', '6/8');
});

test('time_sigs may arrive as a JSON string or not at all', () => {
  assert.deepEqual(fromRemoteComposition({ time_sigs: '["2/4","3/4"]' }).timeSigs, ['2/4', '3/4']);
  assert.equal('timeSigs' in fromRemoteComposition({ time_sigs: null }), false);
  assert.equal('timeSigs' in fromRemoteComposition({ time_sigs: [] }), false);
  assert.equal('timeSigs' in fromRemoteComposition({ time_sigs: 'not json' }), false);
  assert.equal('timeSigs' in fromRemoteComposition({}), false);
});

test('tempo is a whole number, and a missing, zero or junk tempo is left out rather than set to null', () => {
  assert.equal(fromRemoteComposition({ tempo: '92' }).tempo, 92);
  assert.equal(fromRemoteComposition({ tempo: 91.6 }).tempo, 92);
  for (const bad of [null, undefined, '', 0, -5, 'fast', NaN]) {
    assert.equal('tempo' in fromRemoteComposition({ tempo: bad }), false, `tempo ${String(bad)} is dropped`);
  }
});

test('an empty remote tempo or time signature does not wipe what this device already has', () => {
  const local = { id: 'a', title: 'Minuet', tempo: 100, timeSigs: ['3/4'] };
  const merged = mergeRemoteWins(local, { id: 'a', title: 'Minuet', tempo: null, time_sigs: null, updated_at: '2026-10-14T10:00:00Z' });
  assert.equal(merged.tempo, 100);
  assert.deepEqual(merged.timeSigs, ['3/4']);
});

test('a real remote tempo and time signature do replace the local ones', () => {
  const local = { id: 'a', tempo: 100, timeSigs: ['3/4'] };
  const merged = mergeRemoteWins(local, { id: 'a', tempo: 80, time_sigs: ['4/4'] });
  assert.equal(merged.tempo, 80);
  assert.deepEqual(merged.timeSigs, ['4/4']);
});

test('created_at is mirrored to createdAt without overwriting one that is already there', () => {
  assert.equal(fromRemoteComposition({ created_at: '2026-01-01T00:00:00Z' }).createdAt, '2026-01-01T00:00:00Z');
  assert.equal(fromRemoteComposition({ created_at: 'x', createdAt: 'y' }).createdAt, 'y');
});

test('other fields are left alone, the input is not mutated, and bad input is returned as is', () => {
  const row = { id: 'a', title: 'T', composer: 'C', keys: [{ root: 'C', mode: 'major' }], updated_at: 'u', time_sigs: ['4/4'] };
  const copy = JSON.parse(JSON.stringify(row));
  const out = fromRemoteComposition(row);
  assert.deepEqual(row, copy, 'input untouched');
  assert.equal(out.title, 'T');
  assert.deepEqual(out.keys, [{ root: 'C', mode: 'major' }]);
  assert.equal(out.updated_at, 'u');
  assert.equal(fromRemoteComposition(null), null);
  assert.equal(fromRemoteComposition(undefined), undefined);
});

// ── missing-column errors from Supabase ────────────────────────────────────────────────

test('missingColumn reads the column name out of a PostgREST or Postgres error', () => {
  assert.equal(missingColumn("Could not find the 'tempo' column of 'compositions' in the schema cache"), 'tempo');
  assert.equal(missingColumn('column "tempo" of relation "compositions" does not exist'), 'tempo');
  assert.equal(missingColumn("Could not find the 'time_sigs' column of 'compositions' in the schema cache"), 'time_sigs');
});

test('missingColumn ignores every other kind of error', () => {
  for (const m of ['JWT expired', 'new row violates row-level security policy', 'invalid input syntax for type integer: ""', '', null, undefined]) {
    assert.equal(missingColumn(m), null, String(m));
  }
});

test('the hint names the fix, as SQL when the column type is known', () => {
  const h = missingColumnHint('compositions', ['tempo']);
  assert.match(h, /"tempo"/);
  assert.match(h, /alter table compositions add column if not exists tempo integer;/);
  const other = missingColumnHint('compositions', ['mystery']);
  assert.doesNotMatch(other, /alter table/);
  assert.match(other, /dashboard/);
});

// ── native storage keeps the whole record ──

test('a packed record comes back whole, including fields the native tables have no column for', () => {
  const piece = { id: 'c1', title: 'Minuet', keys: [{ root: 'F', mode: 'major' }], shelvedAt: '2026-09-01', updated_at: '2026-10-14T10:00:00Z' };
  assert.deepEqual(unpackRecord({}, packRecord(piece)), piece);
});

test('the full copy wins over what the columns say, and the columns fill in the rest', () => {
  const fromColumns = { id: 'c1', title: 'Old title', tempo: 80, timeSigs: [] };
  const merged = unpackRecord(fromColumns, packRecord({ id: 'c1', title: 'New title', keys: [1] }));
  assert.equal(merged.title, 'New title');
  assert.deepEqual(merged.keys, [1]);
  assert.equal(merged.tempo, 80, 'a field only the columns have is kept');
});

test('a row saved before the data column existed reads as it always did', () => {
  const fromColumns = { id: 'c1', title: 'Old piece' };
  for (const none of [null, undefined, '']) assert.equal(unpackRecord(fromColumns, none), fromColumns);
});

test('damaged or unexpected data never breaks a read', () => {
  const fromColumns = { id: 'c1', title: 'Piece' };
  for (const bad of ['{not json', '[1,2,3]', '42', 'null', '"text"']) {
    assert.deepEqual(unpackRecord(fromColumns, bad), fromColumns, bad);
  }
});

// ── the Supabase columns, and the fields that have none ──

// The tables as they are in Supabase (before the `data` column is added), copied from the project.
const SUPABASE_SCHEMA = `
CREATE TABLE public.sessions (
  id text NOT NULL,
  user_id text NOT NULL,
  date text NOT NULL,
  duration integer,
  energy integer,
  enjoyment integer,
  wins text,
  segments jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sessions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.lessons (
  id text NOT NULL,
  user_id text NOT NULL,
  date text NOT NULL,
  duration integer,
  teacher text,
  wins text,
  segments jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT lessons_pkey PRIMARY KEY (id)
);
CREATE TABLE public.compositions (
  id text NOT NULL,
  user_id text NOT NULL,
  title text NOT NULL,
  composer text,
  status text,
  keys jsonb DEFAULT '[]'::jsonb,
  time_sigs jsonb DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  tempo integer,
  CONSTRAINT compositions_pkey PRIMARY KEY (id)
);`;

function schemaColumns(table) {
  const body = new RegExp(`CREATE TABLE public\\.${table} \\(([\\s\\S]*?)\\n\\);`).exec(SUPABASE_SCHEMA)[1];
  return body.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('CONSTRAINT')).map(l => l.split(' ')[0]);
}

for (const table of ['sessions', 'lessons', 'compositions']) {
  test(`${table}: the columns the app writes are the table's columns, plus data`, () => {
    assert.deepEqual([...REMOTE_COLUMNS[table]].sort(), [...schemaColumns(table), 'data'].sort());
  });
}

// Records as the forms actually save them (LogModal, LessonModal, CompositionsScreen blank()).
const SESSION = { id: 's1', date: '2026-10-14', energy: 1, enjoyment: 4, duration: 25, segments: [{ id: 'g1' }], wins: 'ok', tomorrowFocus: 'Hanon 3', createdAt: '2026-10-14T20:00:00Z', updated_at: '2026-10-14T20:00:01Z' };
const LESSON = { id: 'l1', type: 'lesson', date: '2026-10-12', teacher: 'Kerrin', duration: 45, energy: 2, enjoyment: 5, segments: [], overallNotes: 'good', wins: 'w', nextFocus: 'scales', createdAt: '2026-10-12T18:00:00Z', updated_at: '2026-10-12T19:00:00Z' };
const PIECE = {
  id: 'c1', title: 'Minuet', composer: 'Mozart', arrangement: '', collection: 'Anna Magdalena', status: 'consolidating', grade: 'Grade 3',
  keys: [{ root: 'F', mode: 'major' }], timeSigs: ['3/4'], tempo: 96, difficulty: 3, liking: 4, year: '1725', tags: ['baroque'],
  dateStarted: '2026-02-01', dateCompleted: '', info: 'x', technicalChallenges: 't', musicalFocus: 'm', practiceNotes: 'p',
  kerrinNotes: 'k', teacherFeedback: 'f', myNotes: 'n', resourceSheet: 's', resourceRecordings: 'r', resourceTutorials: 'u',
  shelvedAt: undefined, createdAt: '2026-01-01T00:00:00Z', updated_at: '2026-10-14T10:00:00Z',
};

test('a session\'s only extra is the one field with no column: tomorrowFocus', () => {
  assert.deepEqual(extrasFor('sessions', SESSION), { tomorrowFocus: 'Hanon 3' });
});

test('a lesson\'s extras are its ratings and notes', () => {
  assert.deepEqual(extrasFor('lessons', LESSON), { type: 'lesson', energy: 2, enjoyment: 5, overallNotes: 'good', nextFocus: 'scales' });
});

test('a piece\'s extras are everything the table has no column for, and nothing it has', () => {
  const extras = extrasFor('compositions', PIECE);
  for (const k of ['grade', 'difficulty', 'liking', 'tags', 'dateStarted', 'dateCompleted', 'info', 'technicalChallenges', 'musicalFocus', 'practiceNotes', 'kerrinNotes', 'teacherFeedback', 'myNotes', 'arrangement', 'collection', 'year', 'resourceSheet', 'resourceRecordings', 'resourceTutorials']) {
    assert.ok(k in extras, `${k} should travel in data`);
  }
  for (const k of ['id', 'title', 'composer', 'status', 'keys', 'tempo', 'updated_at', 'createdAt', 'timeSigs', 'shelvedAt']) {
    assert.equal(k in extras, false, `${k} should not be in data`);
  }
});

test('with nothing extra, or an unknown table, there is no data to send', () => {
  assert.equal(extrasFor('sessions', { id: 's', date: 'd', energy: 1, segments: [] }), undefined);
  assert.equal(extrasFor('widgets', SESSION), undefined);
  assert.equal(extrasFor('sessions', null), undefined);
});

test('a pulled row gets its data folded back in, and a column wins over data', () => {
  const row = { id: 'c1', title: 'Minuet', grade: 'old', data: { grade: 'Grade 3', difficulty: 3 } };
  assert.deepEqual(unpackRemote(row), { id: 'c1', title: 'Minuet', grade: 'old', difficulty: 3 });
  assert.equal('data' in unpackRemote(row), false);
});

test('a row with no data, or unreadable data, still pulls', () => {
  for (const data of [null, undefined, '', 'text', 42, [1, 2]]) assert.deepEqual(unpackRemote({ id: 'x', data }), { id: 'x' });
  assert.equal(unpackRemote(null), null);
  assert.equal(unpackRemote(undefined), undefined);
});

test('a piece survives the trip: what is pushed, pulled and reshaped matches what was saved', () => {
  const columns = Object.fromEntries(Object.entries(PIECE).filter(([k]) => REMOTE_COLUMNS.compositions.includes(k)));
  const pushed = { ...columns, time_sigs: PIECE.timeSigs, created_at: PIECE.createdAt, data: extrasFor('compositions', PIECE) };
  const pulled = fromRemoteComposition(unpackRemote(pushed));
  for (const k of ['title', 'grade', 'difficulty', 'liking', 'tags', 'kerrinNotes', 'resourceSheet', 'dateStarted', 'tempo']) {
    assert.deepEqual(pulled[k], PIECE[k], k);
  }
  assert.deepEqual(pulled.timeSigs, ['3/4']);
});

// ── merging pulled rows with local ones ──

const T1 = '2026-10-14T10:00:00.000Z';
const T2 = '2026-10-15T10:00:00.000Z';

test('merge: a remote-only row is added, and no remote rows leaves local alone', () => {
  assert.equal(mergeRows([{ id: 'a' }], null).length, 1);
  assert.deepEqual(mergeRows([], [{ id: 'r', updated_at: T1 }]).map(r => r.id), ['r']);
});

test('merge: a newer remote row wins, but fields it does not carry are kept', () => {
  const local = { id: 'a', title: 'Old', mood: 'calm', updated_at: T1 };
  const [merged] = mergeRows([local], [{ id: 'a', title: 'New', updated_at: T2 }]);
  assert.equal(merged.title, 'New');
  assert.equal(merged.mood, 'calm');
});

test('merge: an older remote row changes nothing, and the local row is the very same object', () => {
  const local = { id: 'a', title: 'Mine', grade: '', updated_at: T2 };
  const [merged] = mergeRows([local], [{ id: 'a', title: 'Theirs', grade: 'Grade 3', updated_at: T1 }]);
  assert.equal(merged, local);
  assert.equal(merged.grade, '', 'a field cleared on purpose is not refilled from an older copy');
});

test('merge: at the same timestamp, blank local fields are filled from remote', () => {
  const local = { id: 'c1', title: 'Minuet', grade: '', difficulty: 0, liking: 0, tags: [], updated_at: T1 };
  const remote = { id: 'c1', title: 'Minuet', grade: 'Grade 3', difficulty: 3, liking: 4, tags: ['baroque'], updated_at: T1 };
  const [merged] = mergeRows([local], [remote]);
  assert.deepEqual([merged.grade, merged.difficulty, merged.liking, merged.tags], ['Grade 3', 3, 4, ['baroque']]);
  assert.notEqual(merged, local, 'a changed row is a new object, so the caller knows to save it');
});

test('merge: at the same timestamp nothing local is ever overwritten', () => {
  const local = { id: 'c1', title: 'Mine', grade: 'Grade 4', tags: ['a'], updated_at: T1 };
  const [merged] = mergeRows([local], [{ id: 'c1', title: 'Theirs', grade: 'Grade 3', tags: ['b'], updated_at: T1 }]);
  assert.equal(merged, local);
  assert.deepEqual([merged.title, merged.grade, merged.tags], ['Mine', 'Grade 4', ['a']]);
});

test('merge: blank remote values never fill anything, and a row that needs no change is the same object', () => {
  const local = { id: 'c1', title: 'Minuet', grade: 'Grade 3', updated_at: T1 };
  const [merged] = mergeRows([local], [{ id: 'c1', title: '', grade: null, tags: [], difficulty: 0, updated_at: T1 }]);
  assert.equal(merged, local);
});

test('merge: rows with no timestamp on either side fill gaps too, and a timestamped remote beats an untimestamped local', () => {
  const [a] = mergeRows([{ id: 'x', title: 'T', grade: '' }], [{ id: 'x', title: 'T', grade: 'Grade 2' }]);
  assert.equal(a.grade, 'Grade 2');
  const [b] = mergeRows([{ id: 'x', title: 'Old' }], [{ id: 'x', title: 'New', updated_at: T1 }]);
  assert.equal(b.title, 'New');
});

test('merge: only the rows that changed are new objects, so only those get saved', () => {
  const unchanged = { id: 'u', title: 'Same', updated_at: T1 };
  const stale = { id: 's', title: 'Stale', updated_at: T1 };
  const merged = mergeRows([unchanged, stale], [{ id: 'u', title: 'Same', updated_at: T1 }, { id: 's', title: 'Fresh', updated_at: T2 }, { id: 'n', title: 'New', updated_at: T1 }]);
  const byId = Object.fromEntries(merged.map(r => [r.id, r]));
  assert.equal(byId.u, unchanged);
  assert.notEqual(byId.s, stale);
  assert.equal(byId.s.title, 'Fresh');
  assert.ok(byId.n);
});
