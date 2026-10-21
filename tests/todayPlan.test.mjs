// Today's plan: a practice routine put together from what the app knows (src/utils/insights.js).
// Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '../src/utils/insights.js'), 'utf8');
const { planBudget, openAssignmentPieces, buildTodayPlan, emptyTarget } =
  await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

const NOW = '2026-10-19';
const sess = (date, duration, segments = []) => ({ id: date, date, duration, segments });
const rep = (compositionId, extra = {}) => ({ type: 'repertoire', compositionId, ...extra });
const lessonOn = (date, segments) => ({ id: `l${date}`, date, segments });
let n = 0;
const makeId = () => `p${++n}`;

// ── how long to plan for ─────────────────────────────────────────────────────────────────────

test('the budget is the middle of your recent sessions, rounded to 5', () => {
  assert.equal(planBudget([sess('2026-10-18', 30), sess('2026-10-17', 40), sess('2026-10-16', 20)], NOW), 30);
  assert.equal(planBudget([sess('2026-10-18', 43)], NOW), 45);
  assert.equal(planBudget([sess('2026-10-18', 35), sess('2026-10-17', 40)], NOW), 40, 'the middle of two is their average (37.5, rounded to 5)');
});

test('with nothing to go on it is 30, and it stays between 20 and 60', () => {
  assert.equal(planBudget([], NOW), 30);
  assert.equal(planBudget(undefined, NOW), 30);
  assert.equal(planBudget([sess('2026-10-18', 10)], NOW), 20);
  assert.equal(planBudget([sess('2026-10-18', 120)], NOW), 60);
});

test('old, future, empty and surplus sessions are not counted', () => {
  assert.equal(planBudget([sess('2026-07-01', 60), sess('2026-10-18', 20)], NOW), 20, 'over two months ago');
  assert.equal(planBudget([sess('2026-10-25', 60), sess('2026-10-18', 20)], NOW), 20, 'in the future');
  assert.equal(planBudget([sess('2026-10-17', 0), sess('2026-10-18', 40)], NOW), 40, 'no length: a 0 would have pulled it down to 20');
  const many = [...Array.from({ length: 10 }, (_, i) => sess(`2026-10-${String(i + 8).padStart(2, '0')}`, 30)), ...Array.from({ length: 12 }, (_, i) => sess(`2026-09-${String(i + 1).padStart(2, '0')}`, 60))];
  assert.equal(planBudget(many, NOW), 30, 'only the last ten count (counting all of them would give 60)');
});

// ── tasks from your teacher ──────────────────────────────────────────────────────────────────

test('a task you have neither ticked off nor played since is open', () => {
  const lessons = [lessonOn('2026-10-10', [rep('c1', { assignment: 'Clean the trill' }), rep('c2', { assignment: 'Hands together' })])];
  assert.deepEqual([...openAssignmentPieces(lessons, [], NOW)].sort(), ['c1', 'c2']);
});

test('not open: ticked off, played since, old, in the future, or not about a piece', () => {
  const lessons = [
    lessonOn('2026-10-10', [rep('done', { assignment: 'x', assignmentDone: '2026-10-12' }), rep('played', { assignment: 'x' }), { type: 'technique', assignment: 'Scales' }, rep('blank', { assignment: '  ' })]),
    lessonOn('2026-09-10', [rep('old', { assignment: 'x' })]),
    lessonOn('2026-10-25', [rep('future', { assignment: 'x' })]),
  ];
  const sessions = [sess('2026-10-12', 20, [rep('played')])];
  assert.deepEqual([...openAssignmentPieces(lessons, sessions, NOW)], [], 'the old task is not open just because it is old, and has not been played either');
});

test('playing the piece before the lesson, or only as technique, does not count as doing the task', () => {
  const lessons = [lessonOn('2026-10-10', [rep('c1', { assignment: 'x' }), rep('c2', { assignment: 'x' })])];
  const sessions = [sess('2026-10-05', 20, [rep('c1')]), sess('2026-10-12', 20, [{ type: 'technique', compositionId: 'c2' }])];
  assert.deepEqual([...openAssignmentPieces(lessons, sessions, NOW)].sort(), ['c1', 'c2']);
});

// ── the plan ─────────────────────────────────────────────────────────────────────────────────

const comps = [
  { id: 'c1', title: 'Minuet', status: 'learning', tempo: '92' },
  { id: 'c2', title: 'Ocean View', status: 'consolidating', spots: [{ id: 's', bars: '9-12', status: 'open', added: '2026-10-01' }] },
  { id: 'c3', title: 'Shelved piece', status: 'shelved', spots: [{ id: 's3', bars: '1-2', status: 'open' }] },
  { id: 'c4', title: 'Dream', status: 'ambition' },
];
function story() {
  return {
    sessions: [
      sess('2026-09-20', 30, [{ type: 'technique', group: 'Scales', scales: ['D major'] }]),
      sess('2026-10-01', 30, [rep('c1', { duration: 15 })]),
      sess('2026-10-17', 30, [rep('c2', { duration: 15 })]),
    ],
    lessons: [lessonOn('2026-10-10', [rep('c1', { assignment: 'Clean the trill' })])],
  };
}

test('a scales warm-up, then the pieces that need it most, with the reason for each', () => {
  const { sessions, lessons } = story();
  const plan = buildTodayPlan(null, sessions, lessons, comps, NOW, { makeId });
  assert.deepEqual(plan.items.map(x => [x.kind, x.title, x.reason]), [
    ['scales', 'Scales', 'D major'],
    ['piece', 'Minuet', 'open task from your lesson'],
    ['piece', 'Ocean View', '1 tricky spot'],
  ]);
});

test('only pieces you are working on are suggested', () => {
  const { sessions, lessons } = story();
  const plan = buildTodayPlan(null, sessions, lessons, comps, NOW, { makeId });
  assert.deepEqual(plan.items.map(x => x.title).filter(t => ['Shelved piece', 'Dream'].includes(t)), []);
});

test('the time is shared out and adds up to the budget', () => {
  const { sessions, lessons } = story();
  const plan = buildTodayPlan(null, sessions, lessons, comps, NOW, { makeId });
  assert.equal(plan.budget, 30);
  assert.deepEqual(plan.items.map(x => x.minutes), [8, 10, 12], 'warm-up, then 22 minutes between two pieces');
  assert.equal(plan.minutes, 30);
});

test('a long session gets a longer warm-up, and three pieces share what is left', () => {
  const sessions = [sess('2026-10-18', 60, [{ type: 'technique', group: 'Scales', scales: ['D major'] }]), sess('2026-09-01', 60, [{ type: 'technique', group: 'Scales', scales: ['D major'] }])];
  const many = ['a', 'b', 'c', 'd'].map(id => ({ id, title: id.toUpperCase(), status: 'learning' }));
  const plan = buildTodayPlan(null, sessions, [], many, '2026-11-20', { makeId });
  assert.equal(plan.budget, 60);
  assert.deepEqual(plan.items.map(x => x.minutes), [10, 15, 15, 20]);
  assert.equal(plan.items.filter(x => x.kind === 'piece').length, 3, 'three pieces at most');
  assert.equal(plan.minutes, 60);
});

test('the segments are ready for the timer: the same shape a saved routine makes', () => {
  const { sessions, lessons } = story();
  const plan = buildTodayPlan(null, sessions, lessons, comps, NOW, { makeId });
  assert.deepEqual(plan.segments.map(s => [s.type, s.title, s.compositionId, s.plannedMinutes, s.confirmed]), [
    ['technique', 'Scales', '', 8, true],
    ['repertoire', 'Minuet', 'c1', 10, true],
    ['repertoire', 'Ocean View', 'c2', 12, true],
  ]);
  assert.equal(new Set(plan.segments.map(s => s.id)).size, 3, 'each segment has its own id');
});

test('a stalled tempo or a piece that is behind is a reason to practise it', () => {
  const stalled = { id: 'c1', title: 'Minuet', status: 'learning', tempo: '92' };
  const sessions = [
    sess('2026-10-01', 30, [rep('c1', { tempo: 80 })]), sess('2026-10-08', 30, [rep('c1', { tempo: 80 })]), sess('2026-10-17', 30, [rep('c1', { tempo: 81 })]),
  ];
  const plan = buildTodayPlan(null, sessions, [], [stalled], NOW, { makeId });
  assert.equal(plan.items[0].reason, 'tempo stalled at 81');
});

test('a piece not played for a while is suggested, the longer the sooner', () => {
  const list = [{ id: 'a', title: 'A', status: 'learning' }, { id: 'b', title: 'B', status: 'learning' }];
  const sessions = [sess('2026-10-10', 30, [rep('a')]), sess('2026-09-25', 30, [rep('b')])];
  const plan = buildTodayPlan(null, sessions, [], list, NOW, { makeId });
  assert.deepEqual(plan.items.map(x => [x.title, x.reason]), [['B', 'not played for 24 days'], ['A', 'not played for 9 days']]);
});

test('when nothing stands out, the piece left longest is still suggested', () => {
  const list = [{ id: 'a', title: 'A', status: 'learning' }];
  const plan = buildTodayPlan(null, [sess('2026-10-18', 30, [rep('a')])], [], list, NOW, { makeId });
  assert.deepEqual(plan.items.map(x => [x.title, x.reason]), [['A', 'next in rotation']]);
});

test('with nothing to suggest the plan is empty, and odd input does not throw', () => {
  const plan = buildTodayPlan(null, [], [], [], NOW, { makeId });
  assert.deepEqual([plan.segments, plan.items, plan.minutes], [[], [], 0]);
  assert.deepEqual(buildTodayPlan(null, undefined, undefined, undefined, NOW).items, []);
});

test('scales you have played lately for your grade target do not get a warm-up', () => {
  const t = { ...emptyTarget(), name: 'T', grade: 'Grade 4', date: '2026-12-31', scales: [{ scale: 'A major', motion: 'parallel', octaves: 2, interval: 'unison' }] };
  const sessions = [sess('2026-10-17', 30, [{ type: 'technique', group: 'Scales', scales: [{ scale: 'A major', motion: 'parallel', octaves: 2, interval: 'unison' }] }])];
  const plan = buildTodayPlan(t, sessions, [], [{ id: 'a', title: 'A', status: 'learning' }], NOW, { makeId });
  assert.deepEqual(plan.items.map(x => x.kind), ['piece'], 'no scales item');
  const never = buildTodayPlan(t, [], [], [{ id: 'a', title: 'A', status: 'learning' }], NOW, { makeId });
  assert.deepEqual(never.items.map(x => [x.kind, x.reason]).slice(0, 1), [['scales', 'A major']], 'but one never practised does');
});
