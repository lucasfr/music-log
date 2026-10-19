// Tests for the backup export / import (src/utils/backup.js).  Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '../src/utils/backup.js'), 'utf8');
const { buildAllPayload, buildSessionPayload, parseImportJSON, planImport, describeImport, BACKUP_VERSION } =
  await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

const NOW = '2026-10-19T10:00:00.000Z';

// A library that uses every field the app is known to write, plus a made-up one on each kind of
// record: if the export enumerates fields by hand, `zzFuture` is what gets lost.
function library() {
  const compositions = [
    {
      id: 'c1', title: 'Minuet in F', composer: 'Mozart', status: 'consolidating', keys: ['F'], timeSigs: ['3/4'],
      tempo: '92', grade: 'Grade 3', notes: 'LH Alberti', difficulty: 3, liking: 4, tags: ['classical'],
      startedAt: '2026-02-01', zzFuture: { nested: true }, created_at: '2026-02-01T09:00:00.000Z', updated_at: '2026-09-01T09:00:00.000Z',
    },
    {
      id: 'c2', title: 'A Town with an Ocean View', composer: 'Hisaishi', status: 'learning', keys: ['G'], timeSigs: ['4/4'],
      notes: null, grade: 'Grade 4', created_at: '2026-08-10T09:00:00.000Z', updated_at: '2026-08-10T09:00:00.000Z',
    },
  ];
  const sessions = [
    {
      id: 's1', date: '2026-10-01', duration: 40, energy: 1, enjoyment: 4, wins: 'Clean LH', tomorrowFocus: 'Bars 9-16 slowly',
      zzFuture: 'keep me', createdAt: '2026-10-01T18:00:00.000Z', created_at: '2026-10-01T18:00:00.000Z', updated_at: '2026-10-01T18:30:00.000Z',
      segments: [
        {
          id: 'g1', type: 'technique', group: 'Scales', title: 'Hanon 1-3', compositionId: null, section: null, notes: 'even',
          duration: 15, feltDifficulty: 2, liking: 3, scales: [{ scale: 'Bb major', motion: 'parallel', octaves: 2, interval: 'unison' }],
          octaves: null, articulation: { rh: 'legato', lh: 'staccato' }, tempo: 88, feedback: null, assignment: null,
          challenges: ['tempo'], progress: [], zzFuture: 7,
        },
        {
          id: 'g2', type: 'repertoire', group: null, title: 'Minuet in F', compositionId: 'c1', section: 'B section', notes: null,
          duration: 25, feltDifficulty: 3, liking: 5, scales: null, octaves: null, articulation: null, tempo: 76, feedback: null,
          assignment: null, challenges: [], progress: ['breakthrough'],
        },
      ],
    },
  ];
  const lessons = [
    {
      id: 'l1', date: '2026-10-05', duration: 45, teacher: 'Kerrin', wins: 'Pedalling clicked', energy: 0, enjoyment: 5, notes: 'bring Ghibli book',
      zzFuture: [1, 2], created_at: '2026-10-05T17:00:00.000Z', updated_at: '2026-10-05T17:50:00.000Z',
      segments: [
        {
          id: 'g3', type: 'repertoire', group: null, title: 'A Town with an Ocean View', compositionId: 'c2', section: null, notes: null,
          duration: 20, feltDifficulty: 4, liking: 5, scales: null, octaves: null, articulation: null, tempo: null,
          feedback: 'Shape the melody', assignment: 'Hands together, bars 1-8', challenges: [], progress: [],
        },
      ],
    },
  ];
  return { sessions, lessons, compositions };
}

const viaJSON = payload => JSON.parse(JSON.stringify(payload));
const byId = list => [...list].sort((a, b) => a.id.localeCompare(b.id));

// ── round trip ──────────────────────────────────────────────────────────────────────

test('export then import returns every record exactly, including fields the exporter has never heard of', () => {
  const { sessions, lessons, compositions } = library();
  const parsed = parseImportJSON(viaJSON(buildAllPayload(sessions, lessons, compositions, new Date(NOW))), NOW);
  assert.deepEqual(byId(parsed.sessions), byId(sessions));
  assert.deepEqual(byId(parsed.lessons), byId(lessons));
  assert.deepEqual(byId(parsed.compositions), byId(compositions));
});

test('the file says which version wrote it', () => {
  const p = buildAllPayload([], [], [], new Date(NOW));
  assert.equal(p.version, BACKUP_VERSION);
  assert.equal(p.exported_at, NOW);
});

test('segments keep their link to a library piece, and every record keeps its id', () => {
  const { sessions, lessons, compositions } = library();
  const file = viaJSON(buildAllPayload(sessions, lessons, compositions, new Date(NOW)));
  assert.equal(file.sessions[0].id, 's1');
  assert.equal(file.sessions[0].segments[1].composition_id, 'c1');
  const minuet = file.compositions.find(c => c.id === 'c1');
  assert.equal(minuet.grade, 'Grade 3');
  assert.equal(minuet.tempo, '92');
});

test('the all-data export now includes tomorrowFocus (only the single-session export had it)', () => {
  const { sessions, lessons, compositions } = library();
  const file = viaJSON(buildAllPayload(sessions, lessons, compositions, new Date(NOW)));
  assert.equal(file.sessions[0].tomorrow_focus, 'Bars 9-16 slowly');
});

test('a single-session export can be imported again', () => {
  const { sessions, compositions } = library();
  const parsed = parseImportJSON(viaJSON(buildSessionPayload(sessions[0], compositions, new Date(NOW))), NOW);
  assert.equal(parsed.sessions.length, 1);
  assert.deepEqual(parsed.sessions[0], sessions[0]);
});

test('a segment label is kept apart from the piece it is linked to', () => {
  // A technique segment labelled "Hanon 1-3" and linked to a piece used to come back titled with the piece.
  const { sessions, compositions } = library();
  const seg = { ...sessions[0].segments[0], compositionId: 'c1' };
  const back = parseImportJSON(viaJSON(buildAllPayload([{ ...sessions[0], segments: [seg] }], [], compositions, new Date(NOW))), NOW);
  assert.equal(back.sessions[0].segments[0].title, 'Hanon 1-3');
});

test('invalid input is rejected with a message', () => {
  assert.throws(() => parseImportJSON('{not json'), /Invalid JSON/);
  assert.throws(() => parseImportJSON('42'), /Unrecognised format/);
});

// ── importing without making duplicates ───────────────────────────────────────────────────

test('importing a backup into a device that already has the data saves nothing', () => {
  const { sessions, lessons, compositions } = library();
  const parsed = parseImportJSON(viaJSON(buildAllPayload(sessions, lessons, compositions, new Date(NOW))), NOW);
  const plan = planImport(parsed, { sessions, lessons, compositions });
  assert.equal(plan.sessions.length, 0);
  assert.equal(plan.lessons.length, 0);
  assert.equal(plan.compositions.length, 0);
  assert.deepEqual(plan.stats.sessions, { added: 0, updated: 0, skipped: 1 });
});

test('importing into an empty device saves everything, once', () => {
  const { sessions, lessons, compositions } = library();
  const parsed = parseImportJSON(viaJSON(buildAllPayload(sessions, lessons, compositions, new Date(NOW))), NOW);
  const plan = planImport(parsed, {});
  assert.deepEqual(byId(plan.sessions), byId(sessions));
  assert.deepEqual(byId(plan.lessons), byId(lessons));
  assert.deepEqual(byId(plan.compositions), byId(compositions));
});

test('a copy of a record in the file that is newer than the one here replaces it; an older one does not', () => {
  const { sessions, lessons, compositions } = library();
  const file = buildAllPayload(sessions, lessons, compositions, new Date(NOW));
  const parsed = parseImportJSON(viaJSON(file), NOW);

  const localOlder = [{ ...sessions[0], wins: 'old text', updated_at: '2026-10-01T10:00:00.000Z' }];
  const up = planImport(parsed, { sessions: localOlder });
  assert.equal(up.sessions.length, 1);
  assert.equal(up.sessions[0].wins, 'Clean LH');
  assert.equal(up.stats.sessions.updated, 1);

  const localNewer = [{ ...sessions[0], wins: 'edited here later', updated_at: '2026-10-10T10:00:00.000Z' }];
  const keep = planImport(parsed, { sessions: localNewer });
  assert.equal(keep.sessions.length, 0);
});

// ── files from before ids were exported (version 1) ────────────────────────────────────────

// What the old exporter wrote: no ids, no compositionId, the piece by name, no extra fields.
function legacyFile() {
  return {
    exported_at: '2026-09-01T00:00:00.000Z', app: 'music.log',
    sessions: [{
      date: '2026-08-20', duration_minutes: 30, energy: 1, enjoyment: 4, wins: 'Nice',
      segments: [
        { type: 'repertoire', group: null, piece: 'Minuet in F', section: null, notes: null, duration_minutes: 20, difficulty: 3, liking: 4, challenge_tags: [], progress_tags: [] },
        { type: 'technique', group: 'Scales', piece: 'C major', duration_minutes: 10, tempo_bpm: 80, challenge_tags: [], progress_tags: [] },
      ],
    }],
    lessons: [{ date: '2026-08-22', duration_minutes: 40, teacher: 'Kerrin', wins: null, segments: [] }],
    compositions: [{ title: 'Minuet in F', composer: 'Mozart', status: 'learning', keys: ['F'], time_sigs: ['3/4'], notes: null }],
  };
}

test('a version 1 file imports, and its repertoire segments are re-linked to the piece by name', () => {
  const plan = planImport(parseImportJSON(legacyFile(), NOW), {});
  assert.equal(plan.compositions.length, 1);
  assert.equal(plan.sessions[0].segments[0].compositionId, plan.compositions[0].id);
  assert.equal(plan.sessions[0].segments[1].compositionId, null, 'technique segments are never guessed at');
  assert.equal(plan.stats.relinked, 1);
  assert.equal(plan.sessions[0].segments[1].tempo, 80);
});

test('importing the same version 1 file twice does not double anything', () => {
  const first = planImport(parseImportJSON(legacyFile(), NOW), {});
  const onDevice = { sessions: first.sessions, lessons: first.lessons, compositions: first.compositions };
  const second = planImport(parseImportJSON(legacyFile(), NOW), onDevice);
  assert.equal(second.sessions.length, 0);
  assert.equal(second.lessons.length, 0);
  assert.equal(second.compositions.length, 0);
});

test('a version 1 piece that is already in the library is not added again; segments point at the one that is', () => {
  const existing = { compositions: [{ id: 'mine', title: 'minuet in f', composer: 'MOZART', status: 'new' }] };
  const plan = planImport(parseImportJSON(legacyFile(), NOW), existing);
  assert.equal(plan.compositions.length, 0);
  assert.equal(plan.sessions[0].segments[0].compositionId, 'mine');
});

test('two pieces with the same title are not guessed between', () => {
  const file = legacyFile();
  file.compositions = [];
  const existing = { compositions: [{ id: 'a', title: 'Minuet in F' }, { id: 'b', title: 'Minuet in F' }] };
  const plan = planImport(parseImportJSON(file, NOW), existing);
  assert.equal(plan.sessions[0].segments[0].compositionId, null);
  assert.equal(plan.stats.relinked, 0);
});

// ── the result line ──────────────────────────────────────────────────────────────────────────

test('describeImport says what happened in one line', () => {
  const { sessions, lessons, compositions } = library();
  const parsed = parseImportJSON(viaJSON(buildAllPayload(sessions, lessons, compositions, new Date(NOW))), NOW);
  assert.equal(describeImport(planImport(parsed, {}).stats), '1 session, 1 lesson, 2 pieces imported');
  assert.equal(describeImport(planImport(parsed, { sessions, lessons, compositions }).stats), 'Nothing new to import (4 already here)');
  assert.equal(describeImport(planImport({ sessions: [], lessons: [], compositions: [] }, {}).stats), 'Nothing found to import');
});
