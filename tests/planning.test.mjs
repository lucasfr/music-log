// Tests for the planning helpers (src/utils/planning.js).  Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '../src/utils/planning.js'), 'utf8');
const P = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const {
  daysBetween, addDays, parseGoal, goalProgress, GOAL_OPTIONS,
  backupNudge, snoozeUntil, BACKUP_AFTER_DAYS,
  parseRoutines, serializeRoutines, addRoutine, removeRoutine, routineToPlan, MAX_ROUTINES,
  gradePathway,
  parseReminderTime, REMINDER_TIMES,
} = P;

// ── dates ────────────────────────────────────────────────────────────────────────────

test('daysBetween counts calendar days, across months, years and the clocks changing', () => {
  assert.equal(daysBetween('2026-10-01', '2026-10-15'), 14);
  assert.equal(daysBetween('2026-12-30', '2027-01-02'), 3);
  assert.equal(daysBetween('2026-03-27', '2026-03-30'), 3, 'BST starts 29 Mar');
  assert.equal(daysBetween('2026-10-24', '2026-10-26'), 2, 'BST ends 25 Oct');
  assert.equal(daysBetween('2026-10-15', '2026-10-01'), -14);
  assert.equal(daysBetween('2026-10-15', '2026-10-15'), 0);
});

test('addDays steps across month and year boundaries', () => {
  assert.equal(addDays('2026-10-12', 7), '2026-10-19');
  assert.equal(addDays('2026-10-28', 7), '2026-11-04');
  assert.equal(addDays('2026-12-28', 7), '2027-01-04');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

// ── weekly goal ──────────────────────────────────────────────────────────────────────

test('parseGoal accepts sensible minutes and treats everything else as no goal', () => {
  assert.equal(parseGoal('120'), 120);
  assert.equal(parseGoal(90), 90);
  for (const bad of [null, undefined, '', 'abc', '0', '-5', 'NaN', 99999]) assert.equal(parseGoal(bad), 0, `${bad} -> no goal`);
});

test('every offered goal option round-trips through parseGoal (0 means off)', () => {
  for (const g of GOAL_OPTIONS) assert.equal(parseGoal(String(g)), g);
});

test('goalProgress reports the fraction, what is left and when the goal is met', () => {
  assert.equal(goalProgress(60, 120).fraction, 0.5);
  assert.equal(goalProgress(60, 120).remaining, 60);
  assert.equal(goalProgress(60, 120).reached, false);
  const done = goalProgress(150, 120);
  assert.equal(done.fraction, 1, 'capped at 100%');
  assert.equal(done.remaining, 0);
  assert.equal(done.reached, true);
  assert.equal(goalProgress(120, 120).reached, true, 'exactly on target counts');
  assert.equal(goalProgress(0, 120).fraction, 0);
  assert.equal(goalProgress(60, 0), null, 'no goal set -> nothing to show');
  assert.equal(goalProgress(undefined, '60').minutes, 0);
});

// ── backup nudge ─────────────────────────────────────────────────────────────────────

const base = { today: '2026-10-30', sessionCount: 20, firstSessionDate: '2026-09-01' };

test('no nudge when there is nothing to lose', () => {
  assert.equal(backupNudge({ ...base, sessionCount: 0 }), null);
});

test('nudge once the last backup is BACKUP_AFTER_DAYS old, not before', () => {
  assert.equal(backupNudge({ ...base, lastBackup: '2026-10-17' }), null, '13 days');
  const due = backupNudge({ ...base, lastBackup: '2026-10-16' });          // 14 days
  assert.deepEqual({ ...due }, { days: 14, never: false });
  assert.equal(BACKUP_AFTER_DAYS, 14);
});

test('never backed up: wait for a little history, then nudge', () => {
  assert.equal(backupNudge({ ...base, firstSessionDate: '2026-10-20' }), null, 'only 10 days of history');
  const due = backupNudge({ ...base, firstSessionDate: '2026-10-01' });
  assert.equal(due.never, true);
  assert.equal(due.days, 29);
});

test('snoozing hides the nudge until the snooze date, then it returns', () => {
  const snoozed = snoozeUntil('2026-10-30');
  assert.equal(snoozed, '2026-11-06');
  assert.equal(backupNudge({ ...base, lastBackup: '2026-09-01', snoozedUntil: snoozed }), null);
  assert.equal(backupNudge({ ...base, today: '2026-11-05', lastBackup: '2026-09-01', snoozedUntil: snoozed }), null, 'still snoozed the day before');
  assert.ok(backupNudge({ ...base, today: '2026-11-06', lastBackup: '2026-09-01', snoozedUntil: snoozed }), 'back on the snooze date');
});

// ── routines ─────────────────────────────────────────────────────────────────────────

const seg = (o = {}) => ({ type: 'technique', title: 'Hanon', compositionId: '', plannedMinutes: 15, ...o });
let n = 0;
const ids = () => `id${++n}`;

test('addRoutine stores newest first, trims the name and cleans the segments', () => {
  let list = addRoutine([], '  Warm-up  ', [seg({ confirmed: true, id: 'draft-1', stray: 'x' })], ids);
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'Warm-up');
  assert.deepEqual(Object.keys(list[0].segments[0]).sort(), ['compositionId', 'plannedMinutes', 'title', 'type'], 'draft ids, `confirmed` and strays are not stored');
  list = addRoutine(list, 'Repertoire day', [seg({ type: 'repertoire', title: 'Minuet', compositionId: 'c2' })], ids);
  assert.deepEqual(list.map(r => r.name), ['Repertoire day', 'Warm-up']);
});

test('saving under an existing name (any case) replaces it instead of duplicating', () => {
  let list = addRoutine([], 'Warm-up', [seg({ plannedMinutes: 10 })], ids);
  list = addRoutine(list, 'WARM-UP', [seg({ plannedMinutes: 20 })], ids);
  assert.equal(list.length, 1);
  assert.equal(list[0].segments[0].plannedMinutes, 20);
});

test('empty names and empty plans are not saved; the list is capped', () => {
  assert.deepEqual(addRoutine([], '   ', [seg()], ids), []);
  assert.deepEqual(addRoutine([], 'x', [], ids), []);
  let list = [];
  for (let i = 0; i < MAX_ROUTINES + 5; i++) list = addRoutine(list, `Routine ${i}`, [seg()], ids);
  assert.equal(list.length, MAX_ROUTINES);
  assert.equal(list[0].name, `Routine ${MAX_ROUTINES + 4}`, 'newest kept, oldest dropped');
});

test('minutes are kept within the dial\'s range and articulation is preserved', () => {
  const list = addRoutine([], 'R', [seg({ plannedMinutes: 500 }), seg({ plannedMinutes: 0 }), seg({ articulation: { rh: 'staccato', lh: 'legato' } })], ids);
  assert.deepEqual(list[0].segments.map(s => s.plannedMinutes), [60, 10, 15]);
  assert.deepEqual(list[0].segments[2].articulation, { rh: 'staccato', lh: 'legato' });
});

test('routines survive being saved and loaded, and removeRoutine deletes by id', () => {
  let list = addRoutine([], 'A', [seg()], ids);
  list = addRoutine(list, 'B', [seg({ title: 'Scales' })], ids);
  const loaded = parseRoutines(serializeRoutines(list));
  assert.deepEqual(loaded, list);
  assert.deepEqual(removeRoutine(loaded, loaded[0].id).map(r => r.name), ['A']);
});

test('parseRoutines shrugs off corrupt or malformed stored data', () => {
  assert.deepEqual(parseRoutines(null), []);
  assert.deepEqual(parseRoutines('not json'), []);
  assert.deepEqual(parseRoutines('{"a":1}'), []);
  const mixed = JSON.stringify([
    { id: '1', name: 'Good', segments: [{ type: 'technique', title: 'Hanon', plannedMinutes: 10 }] },
    { id: '2', name: '', segments: [{ type: 'technique', title: 'x' }] },       // no name
    { id: '3', name: 'No segments', segments: [] },
    null, 42,
  ]);
  assert.deepEqual(parseRoutines(mixed).map(r => r.name), ['Good']);
});

test('routineToPlan makes runnable drafts with fresh ids, and leaves broken pieces open', () => {
  const routine = { id: 'r', name: 'Mix', segments: [
    { type: 'technique', title: 'Hanon', compositionId: '', plannedMinutes: 15, articulation: { rh: 'legato', lh: 'legato' } },
    { type: 'repertoire', title: 'Minuet', compositionId: 'c2', plannedMinutes: 20 },
    { type: 'repertoire', title: 'Old piece', compositionId: 'gone', plannedMinutes: 10 },
  ] };
  const plan = routineToPlan(routine, [{ id: 'c2', title: 'Minuet in F' }], ids);
  assert.deepEqual(plan.map(p => p.confirmed), [true, true, false]);
  assert.equal(plan[1].title, 'Minuet in F', 'the piece\'s current title is used');
  assert.equal(plan[2].compositionId, '', 'a removed piece is not carried as a dangling id');
  assert.deepEqual(plan[0].articulation, { rh: 'legato', lh: 'legato' });
  assert.equal(new Set(plan.map(p => p.id)).size, 3);
});

// ── grade pathway ────────────────────────────────────────────────────────────────────

const lib = [
  { id: 'a', title: 'Gymnop\u00e9die No. 1', grade: 'Grade 4', status: 'learning' },
  { id: 'b', title: 'Minuet in F', grade: 'Grade 3', status: 'performance-ready' },
  { id: 'c', title: 'A Town with an Ocean View', grade: 'Grade 4', status: 'new' },
  { id: 'd', title: 'Clair de Lune', grade: 'Grade 6', status: 'ambition' },
  { id: 'e', title: 'Ungraded piece', status: 'learning' },
  { id: 'f', title: 'Italian Concerto', grade: 'Grade 8', status: 'ambition' },
];
const sessions = [
  { date: '2026-10-05', segments: [{ compositionId: 'a', duration: 20 }, { compositionId: 'b', duration: 10 }, { type: 'technique', duration: 15 }] },
  { date: '2026-10-09', segments: [{ compositionId: 'a', duration: 15 }] },
];

test('the pathway groups the library by grade, easiest first, skipping ungraded pieces', () => {
  const path = gradePathway(lib, sessions);
  assert.deepEqual(path.map(g => g.grade), ['Grade 3', 'Grade 4', 'Grade 6', 'Grade 8']);
  assert.equal(path.some(g => g.pieces.some(p => p.id === 'e')), false);
});

test('minutes per piece come from linked session segments, with the last-played date', () => {
  const g4 = gradePathway(lib, sessions).find(g => g.grade === 'Grade 4');
  const a = g4.pieces.find(p => p.id === 'a');
  assert.equal(a.minutes, 35);
  assert.equal(a.lastPlayed, '2026-10-09');
  assert.equal(g4.pieces.find(p => p.id === 'c').minutes, 0);
  assert.equal(g4.pieces.find(p => p.id === 'c').lastPlayed, null);
  assert.equal(g4.minutes, 35, 'grade total; technique segments with no piece are not counted');
});

test('within a grade, the furthest-along piece comes first; counts are per status', () => {
  const g4 = gradePathway(lib, sessions).find(g => g.grade === 'Grade 4');
  assert.deepEqual(g4.pieces.map(p => p.id), ['a', 'c'], 'learning before new');
  assert.equal(g4.total, 2);
  assert.equal(g4.ready, 0);
  assert.deepEqual({ ...g4.counts }, { learning: 1, new: 1 });
  const g3 = gradePathway(lib, sessions).find(g => g.grade === 'Grade 3');
  assert.equal(g3.ready, 1);
});

test('unknown grade names sort after the standard ones, and empty input is fine', () => {
  const path = gradePathway([...lib, { id: 'z', title: 'Odd', grade: 'Grade 4 (advanced)', status: 'new' }], []);
  assert.equal(path.at(-1).grade, 'Grade 4 (advanced)');
  assert.deepEqual(gradePathway([], []), []);
  assert.deepEqual(gradePathway(undefined, undefined), []);
});

test('parseReminderTime reads HH:MM and rejects anything else (empty means off)', () => {
  assert.deepEqual({ ...parseReminderTime('08:00') }, { hour: 8, minute: 0 });
  assert.deepEqual({ ...parseReminderTime('7:05') }, { hour: 7, minute: 5 });
  assert.deepEqual({ ...parseReminderTime('23:59') }, { hour: 23, minute: 59 });
  for (const bad of ['', null, undefined, '24:00', '12:60', 'noon', '8', '08:0', '-1:00']) assert.equal(parseReminderTime(bad), null, `${bad} -> off`);
  for (const t of REMINDER_TIMES) assert.ok(parseReminderTime(t), `${t} is offered, so it must parse`);
});
