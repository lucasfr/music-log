// Tests for turning a finished timer into log segments, and the run-through counter's pieces
// (src/utils/timerLog.js, bumpRunThroughs in src/utils/insights.js, the snapshot in timerSnapshot.js).
// Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const load = async file => import('data:text/javascript;base64,' + Buffer.from(readFileSync(join(here, '../src/utils', file), 'utf8')).toString('base64'));
const { timerToLogSegments } = await load('timerLog.js');
const { bumpRunThroughs, runThroughsOf } = await load('insights.js');
const { buildSnapshot, parseSnapshot } = await load('timerSnapshot.js');

// What HomeScreen's handleTimerFinish did before this was extracted, copied unchanged: the reference
// the new function has to agree with for everything except the run-through count.
const originalMapping = (segments, minutesFor) => segments.map((s, i) => {
  const isTech = s.type === 'technique';
  return {
    id: s.id,
    type: s.type,
    group: isTech ? (s.title || '') : undefined,
    title: isTech ? '' : (s.title || ''),
    compositionId: s.compositionId || '',
    duration: minutesFor(i),
    articulation: isTech ? (s.articulation || null) : undefined,
    notes: '', challenges: [], progress: [],
  };
});

const plan = [
  { id: 'a', type: 'technique', title: 'Scales', plannedMinutes: 10, articulation: { rh: 'legato', lh: 'legato' } },
  { id: 'b', type: 'technique', title: 'Hanon', plannedMinutes: 5, compositionId: 'hanon' },
  { id: 'c', type: 'repertoire', title: 'Minuet in F', compositionId: 'c1', plannedMinutes: 20 },
  { id: 'd', type: 'repertoire', title: '', plannedMinutes: 10 },
  { id: 'e', type: 'technique', title: '', plannedMinutes: 5 },
];
const minutes = i => [11, 4, 22, 9, 0][i];

test('everything the log form was given before is still given, unchanged', () => {
  assert.deepEqual(timerToLogSegments(plan, minutes), originalMapping(plan, minutes));
});

test('a technique segment\'s title becomes its group, and a piece keeps its title', () => {
  const out = timerToLogSegments(plan, minutes);
  assert.deepEqual([out[0].group, out[0].title], ['Scales', '']);
  assert.deepEqual([out[2].group, out[2].title], [undefined, 'Minuet in F']);
  assert.equal(out[1].compositionId, 'hanon');
  assert.equal(out[3].compositionId, '');
  assert.deepEqual(out.map(s => s.duration), [11, 4, 22, 9, 0]);
});

test('a piece\'s run-throughs go to the log form with it', () => {
  const counted = plan.map(s => (s.id === 'c' ? { ...s, runThroughs: 3 } : s));
  const out = timerToLogSegments(counted, minutes);
  assert.equal(out[2].runThroughs, 3);
  assert.deepEqual(out.filter(s => s.id !== 'c'), originalMapping(counted, minutes).filter(s => s.id !== 'c'), 'nothing else changes');
});

test('run-throughs are left out when there are none, blank or junk, and capped at 99', () => {
  const key = value => 'runThroughs' in timerToLogSegments([{ id: 'x', type: 'repertoire', title: 'P', runThroughs: value }], () => 5)[0];
  for (const none of [0, -2, '', 'abc', null, undefined, NaN]) assert.equal(key(none), false, String(none));
  assert.equal(timerToLogSegments([{ id: 'x', type: 'repertoire', runThroughs: '4' }], () => 5)[0].runThroughs, 4);
  assert.equal(timerToLogSegments([{ id: 'x', type: 'repertoire', runThroughs: 500 }], () => 5)[0].runThroughs, 99);
});

test('technique segments never carry run-throughs, even if one somehow has a count', () => {
  assert.equal('runThroughs' in timerToLogSegments([{ id: 'x', type: 'technique', title: 'Scales', runThroughs: 5 }], () => 5)[0], false);
});

test('an empty timer gives no segments', () => {
  assert.deepEqual(timerToLogSegments([], () => 0), []);
});

// ── the counter's buttons ───────────────────────────────────────────────────────────────────

test('plus and minus change the count by one and never go below 0', () => {
  assert.equal(bumpRunThroughs(0, 1), 1);
  assert.equal(bumpRunThroughs(4, 1), 5);
  assert.equal(bumpRunThroughs(4, -1), 3);
  assert.equal(bumpRunThroughs(0, -1), 0, 'minus on zero stays at zero');
  assert.equal(bumpRunThroughs(1, -1), 0);
});

test('the count stops at 99', () => {
  assert.equal(bumpRunThroughs(98, 1), 99);
  assert.equal(bumpRunThroughs(99, 1), 99);
});

test('a segment with no count yet starts from zero, whatever is there', () => {
  for (const blank of [undefined, null, '', 'abc', NaN, -3]) assert.equal(bumpRunThroughs(blank, 1), 1, String(blank));
  assert.equal(bumpRunThroughs('3', 1), 4, 'a count typed as text still adds up');
});

test('tapping plus several times counts every tap', () => {
  let n;
  for (let i = 0; i < 7; i++) n = bumpRunThroughs(n, 1);
  assert.equal(n, 7);
  assert.equal(runThroughsOf({ runThroughs: n }), 7);
});

// ── surviving an interrupted session ────────────────────────────────────────────────────────

test('the count is saved with the timer and comes back when it is resumed', () => {
  const segments = [{ id: 'c', type: 'repertoire', title: 'Minuet', plannedMinutes: 20, runThroughs: 3 }, { id: 'd', type: 'repertoire', title: 'Ocean', plannedMinutes: 10 }];
  const now = 1_000_000;
  const saved = JSON.stringify(buildSnapshot({ segments, currentIndex: 0, elapsedMs: [120000, 0], runStart: null, isRunning: false, now }));
  const back = parseSnapshot(saved, now + 60000);
  assert.ok(back, 'a snapshot with a count in it is still valid');
  assert.equal(back.segments[0].runThroughs, 3);
  assert.equal(back.segments[1].runThroughs, undefined);
  assert.equal(timerToLogSegments(back.segments, () => 2)[0].runThroughs, 3, 'and it still reaches the log form');
});
