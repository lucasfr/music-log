import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMockHistory, serializeMockHistory, addMockRun, freshFlags, describeMockProgress,
  summariseMockExam, MAX_RUNS, FLAG_FRESH_DAYS,
} from '../src/utils/mockExam.js';

const items = [{ kind: 'scale', label: 'C major, 2 oct' }, { kind: 'piece', label: 'Sonatina' }, { kind: 'sight', label: 'Sight-reading' }];
const summary = (marks, secs) => summariseMockExam(items, marks, secs);

test('summariseMockExam now carries the flagged items with their kind', () => {
  const s = summary({ 0: true, 1: true }, [10, 20, 30]);
  assert.deepEqual(s.needsWorkItems, [{ kind: 'scale', label: 'C major, 2 oct' }, { kind: 'piece', label: 'Sonatina' }]);
  assert.deepEqual(s.needsWork, ['C major, 2 oct', 'Sonatina']);
});

test('addMockRun appends a run with the date, time, count and flags', () => {
  const h = addMockRun([], '2026-10-20', summary({ 1: true }, [10, 20, 30]));
  assert.deepEqual(h, [{ date: '2026-10-20', total: 60, count: 3, flagged: [{ kind: 'piece', label: 'Sonatina' }] }]);
});

test('the history keeps only the latest MAX_RUNS', () => {
  let h = [];
  for (let i = 0; i < MAX_RUNS + 5; i++) h = addMockRun(h, `2026-09-${String(1 + (i % 28)).padStart(2, '0')}`, summary({}, [1, 1, 1]));
  assert.equal(h.length, MAX_RUNS);
});

test('parse and serialize round-trip, and malformed input is dropped', () => {
  const h = addMockRun([], '2026-10-20', summary({ 0: true }, [5, 5, 5]));
  assert.deepEqual(parseMockHistory(serializeMockHistory(h)), h);
  assert.deepEqual(parseMockHistory('not json'), []);
  assert.deepEqual(parseMockHistory('{"a":1}'), []);
  assert.deepEqual(parseMockHistory(''), []);
  const messy = JSON.stringify([
    { date: 'yesterday', total: 5 }, null, 4,
    { date: '2026-10-21', total: -5, count: 'x', flagged: [{ kind: 'bogus', label: 'x' }, { kind: 'piece', label: '' }, { kind: 'scale', label: 'A major' }, null] },
  ]);
  assert.deepEqual(parseMockHistory(messy), [{ date: '2026-10-21', total: 0, count: 0, flagged: [{ kind: 'scale', label: 'A major' }] }]);
});

test('freshFlags: the latest run\'s flags, for two weeks, then nothing', () => {
  const h = addMockRun(addMockRun([], '2026-10-01', summary({ 0: true }, [1, 1, 1])), '2026-10-20', summary({ 1: true }, [1, 1, 1]));
  assert.deepEqual(freshFlags(h, '2026-10-20'), [{ kind: 'piece', label: 'Sonatina' }]);     // the same day
  assert.deepEqual(freshFlags(h, '2026-11-03'), [{ kind: 'piece', label: 'Sonatina' }]);     // 14 days
  assert.equal(FLAG_FRESH_DAYS, 14);
  assert.deepEqual(freshFlags(h, '2026-11-04'), []);                                          // 15 days
  assert.deepEqual(freshFlags(h, '2026-10-19'), []);                                          // a run "from the future"
  assert.deepEqual(freshFlags([], '2026-10-20'), []);
  assert.deepEqual(freshFlags(undefined, '2026-10-20'), []);
  assert.deepEqual(freshFlags(h, 'garbage'), []);
});

test('freshFlags uses only the latest run: an older run\'s flags do not linger', () => {
  const h = addMockRun(addMockRun([], '2026-10-18', summary({ 0: true }, [1, 1, 1])), '2026-10-20', summary({}, [1, 1, 1]));
  assert.deepEqual(freshFlags(h, '2026-10-21'), []);
});

test('freshFlags counts calendar days across the clocks going back (UK, 25 Oct 2026)', () => {
  const h = addMockRun([], '2026-10-24', summary({ 0: true }, [1, 1, 1]));
  assert.equal(freshFlags(h, '2026-11-07').length, 1);   // 14 days
  assert.equal(freshFlags(h, '2026-11-08').length, 0);   // 15 days
});

test('describeMockProgress: needs two runs, then compares flags and time', () => {
  assert.equal(describeMockProgress([]), null);
  const one = addMockRun([], '2026-10-01', summary({ 0: true, 1: true }, [100, 100, 100]));
  assert.equal(describeMockProgress(one), null);
  const better = addMockRun(one, '2026-10-15', summary({ 0: true }, [60, 60, 60]));
  assert.equal(describeMockProgress(better), 'Last mock exam: 1 flagged, down from 2, 2:00 quicker than the one before.');
  const worse = addMockRun(better, '2026-10-29', summary({ 0: true, 1: true, 2: true }, [100, 100, 100]));
  assert.equal(describeMockProgress(worse), 'Last mock exam: 3 flagged, up from 1, 2:00 slower than the one before.');
  const same = addMockRun(worse, '2026-11-01', summary({ 0: true, 1: true, 2: true }, [100, 100, 105]));
  assert.equal(describeMockProgress(same), 'Last mock exam: still 3 flagged, about the same time as the one before.');
});
