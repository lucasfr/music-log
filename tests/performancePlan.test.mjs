import test from 'node:test';
import assert from 'node:assert/strict';
import { performanceProgress, performancePlanNudge, withPerformance, stagesDone, STAGES } from '../src/utils/performancePlan.js';

const piece = (extra = {}) => ({ id: 'p', title: 'Sonatina', status: 'learning', performDate: '2026-12-01', performFrom: '2026-11-01', ...extra });

test('no date, or a bad one, means no countdown', () => {
  assert.equal(performanceProgress({ id: 'p' }, '2026-11-01'), null);
  assert.equal(performanceProgress(piece({ performDate: 'soon' }), '2026-11-01'), null);
  assert.equal(performanceProgress(null, '2026-11-01'), null);
  assert.equal(performanceProgress(piece(), 'garbage'), null);
});

test('four stages, due at fixed shares of the time, in order', () => {
  const p = performanceProgress(piece(), '2026-11-01');           // 30 days: due at +9, +17 (16.5), +24, +29 (28.5)
  assert.deepEqual(p.stages.map(s => s.key), STAGES.map(s => s.key));
  assert.deepEqual(p.stages.map(s => s.due), ['2026-11-10', '2026-11-18', '2026-11-25', '2026-11-30']);
  assert.equal(p.daysLeft, 30);
});

test('stages are read from the piece: status, tempo and memorised', () => {
  assert.deepEqual(stagesDone({ status: 'new' }), { notes: false, hands: false, tempo: false, memory: false });
  assert.deepEqual(stagesDone({ status: 'learning' }), { notes: true, hands: false, tempo: false, memory: false });
  assert.deepEqual(stagesDone({ status: 'consolidating' }), { notes: true, hands: true, tempo: false, memory: false });
  assert.deepEqual(stagesDone({ status: 'consolidating' }, { latest: 96, target: 96 }), { notes: true, hands: true, tempo: true, memory: false });
  assert.equal(stagesDone({ status: 'consolidating' }, { latest: 80, target: 96 }).tempo, false);
  assert.deepEqual(stagesDone({ status: 'performance-ready', memorised: true }), { notes: true, hands: true, tempo: true, memory: true });
  assert.equal(stagesDone({ status: 'ambition' }).notes, false);
});

test('on schedule: says what is next and by when', () => {
  const p = performanceProgress(piece({ status: 'new' }), '2026-11-05');
  assert.equal(p.behind, false);
  assert.equal(p.next.key, 'notes');
  assert.equal(p.line, '26 days to go. Next: notes learned, by 10 Nov.');
});

test('behind: a stage past its due date and not done', () => {
  const p = performanceProgress(piece({ status: 'new' }), '2026-11-12');
  assert.equal(p.behind, true);
  assert.equal(p.stages[0].overdue, true);
  assert.equal(p.line, '19 days to go. Behind: notes learned was due 10 Nov.');
});

test('a later stage done does not hide an earlier one that is not', () => {
  const p = performanceProgress(piece({ status: 'learning', memorised: true }), '2026-11-20');
  assert.equal(p.next.key, 'hands');
  assert.equal(p.behind, true);
});

test('everything done: with days to spare, and after the date', () => {
  const done = piece({ status: 'performance-ready', memorised: true });
  assert.equal(performanceProgress(done, '2026-11-20').line, 'Every stage is done, 11 days to spare.');
  assert.equal(performanceProgress(done, '2026-12-05').line, 'Every stage was done for the performance.');
  assert.equal(performanceProgress(done, '2026-11-20').behind, false);
});

test('after the date with things undone: passed, and not "behind"', () => {
  const p = performanceProgress(piece(), '2026-12-05');
  assert.equal(p.passed, true);
  assert.equal(p.behind, false);
  assert.match(p.line, /The date has passed \(1 Dec\)\. Notes learned was not done\.|The date has passed \(1 Dec\)\. Hands together was not done\./);
});

test('the day itself is not passed, and one day left reads in the singular', () => {
  assert.equal(performanceProgress(piece(), '2026-12-01').daysLeft, 0);
  assert.equal(performanceProgress(piece(), '2026-12-01').passed, false);
  assert.match(performanceProgress(piece({ status: 'performance-ready', memorised: false }), '2026-11-30').line, /^1 day to go\./);
});

test('a missing or later-than-date performFrom starts the schedule today', () => {
  const p = performanceProgress({ status: 'learning', performDate: '2026-12-01' }, '2026-11-01');
  assert.equal(p.from, '2026-11-01');
  assert.equal(performanceProgress(piece({ performFrom: '2027-01-01' }), '2026-11-01').from, '2026-11-01');
});

test('dates count by calendar across the clocks changing', () => {
  const p = performanceProgress(piece({ performFrom: '2026-10-20', performDate: '2026-11-10' }), '2026-10-26');
  assert.equal(p.daysLeft, 15);
});

test('withPerformance sets the date and the start, and a blank date clears both', () => {
  const set = withPerformance({ id: 'p', title: 'x' }, '2026-12-01', '2026-11-01');
  assert.deepEqual(set, { id: 'p', title: 'x', performDate: '2026-12-01', performFrom: '2026-11-01' });
  assert.deepEqual(withPerformance(set, '', '2026-11-02'), { id: 'p', title: 'x' });
  assert.equal(withPerformance({ id: 'p' }, 'nonsense', '2026-11-01').performDate, undefined);
  assert.doesNotThrow(() => withPerformance(Object.freeze({ id: 'p' }), '2026-12-01', '2026-11-01'));
});

test('plan nudge: behind scores 2, within two weeks scores 1, otherwise nothing', () => {
  assert.deepEqual(performancePlanNudge(piece({ status: 'new' }), '2026-11-12'), { score: 2, reason: 'behind for your performance on 1 Dec' });
  const close = piece({ status: 'consolidating', memorised: false, performFrom: '2026-11-25' });
  assert.deepEqual(performancePlanNudge(close, '2026-11-26'), { score: 1, reason: 'performance in 5 days' });
  assert.equal(performancePlanNudge(piece(), '2026-11-02'), null);                                       // far off, on schedule
  assert.equal(performancePlanNudge(piece({ status: 'performance-ready', memorised: true }), '2026-11-20'), null);   // all done
  assert.equal(performancePlanNudge(piece(), '2026-12-05'), null);                                       // passed
  assert.equal(performancePlanNudge({ id: 'p' }, '2026-11-01'), null);
});
