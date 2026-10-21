// Dynamics (how loudly a technique exercise was played) from a saved routine to the log form and a
// backup: every place that passes a segment along has to carry the list through.
// Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const load = async file => import('data:text/javascript;base64,' + Buffer.from(readFileSync(join(here, '../src/utils', file), 'utf8')).toString('base64'));
const { addRoutine, parseRoutines, serializeRoutines, routineToPlan } = await load('planning.js');
const { timerToLogSegments } = await load('timerLog.js');
const { buildAllPayload, buildSessionPayload, parseImportJSON } = await load('backup.js');

const NOW = '2026-10-19T10:00:00.000Z';
let n = 0;
const makeId = () => `id${++n}`;

const hanon = { type: 'technique', title: 'Hanon', plannedMinutes: 10, articulation: { rh: 'legato', lh: 'legato' }, dynamics: ['p', 'crescendo'] };
const piece = { type: 'repertoire', title: 'Minuet', compositionId: 'c1', plannedMinutes: 15, dynamics: ['f'] };

// ── a saved routine ─────────────────────────────────────────────────────────────────────────

test('a routine remembers the dynamics of a technique segment, through being saved and reloaded', () => {
  const list = addRoutine([], 'Warm-up', [hanon], makeId);
  const back = parseRoutines(serializeRoutines(list));
  assert.deepEqual(back[0].segments[0].dynamics, ['p', 'crescendo']);
  assert.deepEqual(back[0].segments[0].articulation, { rh: 'legato', lh: 'legato' }, 'and the articulation as before');
});

test('a piece in a routine has no dynamics, and a technique segment without any has none either', () => {
  const list = addRoutine([], 'Mixed', [piece, { type: 'technique', title: 'Scales', plannedMinutes: 5 }, { ...hanon, dynamics: [] }], makeId);
  for (const seg of list[0].segments) assert.equal('dynamics' in seg, false, seg.title);
});

test('junk in a stored routine\'s dynamics is dropped rather than carried along', () => {
  const list = addRoutine([], 'Odd', [{ ...hanon, dynamics: ['p', 7, null, 'f'] }], makeId);
  assert.deepEqual(list[0].segments[0].dynamics, ['p', 'f']);
});

test('starting a routine puts the dynamics on its technique segments in the timer plan', () => {
  const routine = addRoutine([], 'Warm-up', [hanon, piece], makeId)[0];
  const plan = routineToPlan(routine, [{ id: 'c1', title: 'Minuet' }], makeId);
  assert.deepEqual(plan[0].dynamics, ['p', 'crescendo']);
  assert.equal('dynamics' in plan[1], false, 'a piece never has them');
});

// ── the timer to the log form ───────────────────────────────────────────────────────────────

test('a finished timer hands a technique segment\'s dynamics to the log form', () => {
  const out = timerToLogSegments([{ id: 'a', type: 'technique', title: 'Hanon', dynamics: ['mf', 'diminuendo'] }], () => 9);
  assert.deepEqual(out[0].dynamics, ['mf', 'diminuendo']);
  assert.equal(out[0].group, 'Hanon');
});

test('the log form gets no dynamics key when there are none, and a piece never gets one', () => {
  const out = timerToLogSegments([
    { id: 'a', type: 'technique', title: 'Hanon' },
    { id: 'b', type: 'technique', title: 'Hanon', dynamics: [] },
    { id: 'c', type: 'repertoire', title: 'Minuet', dynamics: ['f'] },
  ], () => 5);
  assert.deepEqual(out.map(s => 'dynamics' in s), [false, false, false]);
});

test('the whole way: a routine, to the timer, to the log form', () => {
  const routine = addRoutine([], 'Warm-up', [hanon], makeId)[0];
  const [seg] = routineToPlan(routine, [], makeId);
  const [logged] = timerToLogSegments([seg], () => 10);
  assert.deepEqual(logged.dynamics, ['p', 'crescendo']);
});

// ── backups ─────────────────────────────────────────────────────────────────────────────────

const session = () => ({
  id: 's1', date: '2026-10-19', duration: 25, created_at: NOW, updated_at: NOW,
  segments: [
    { id: 'g1', type: 'technique', group: 'Hanon', title: '', duration: 10, articulation: { rh: 'legato', lh: 'legato' }, dynamics: ['p', 'f', 'crescendo'] },
    { id: 'g2', type: 'repertoire', title: 'Minuet', compositionId: 'c1', duration: 15, runThroughs: 3, tempo: 80 },
  ],
});
const viaJSON = x => JSON.parse(JSON.stringify(x));

test('a full backup keeps the dynamics (and run-throughs) of every segment', () => {
  const parsed = parseImportJSON(viaJSON(buildAllPayload([session()], [], [], new Date(NOW))), NOW);
  const [tech, rep] = parsed.sessions[0].segments;
  assert.deepEqual(tech.dynamics, ['p', 'f', 'crescendo']);
  assert.equal(rep.runThroughs, 3);
});

test('exporting a single session keeps them too', () => {
  const parsed = parseImportJSON(viaJSON(buildSessionPayload(session(), [], new Date(NOW))), NOW);
  assert.deepEqual(parsed.sessions[0].segments[0].dynamics, ['p', 'f', 'crescendo']);
  assert.equal(parsed.sessions[0].segments[1].runThroughs, 3);
});

test('a segment without dynamics is exactly as it was: no empty key appears', () => {
  const s = session();
  delete s.segments[0].dynamics;
  const parsed = parseImportJSON(viaJSON(buildAllPayload([s], [], [], new Date(NOW))), NOW);
  assert.equal('dynamics' in parsed.sessions[0].segments[0], false);
});
