import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyReps, recordRep, readyToStep, describeReps, cleanPercent, spotRepsLine, REPS_TO_STEP } from '../src/utils/cleanReps.js';
import { addSpot, addSpotReps, parseSpots, setSpotTempo, setSpotFixed, removeSpot } from '../src/utils/insights.js';

const run = (...marks) => marks.reduce((s, m) => recordRep(s, m), emptyReps());

test('clean goes build a run; a miss ends it but keeps the totals', () => {
  assert.deepEqual(run(true, true, true), { streak: 3, clean: 3, total: 3 });
  assert.deepEqual(run(true, true, false), { streak: 0, clean: 2, total: 3 });
  assert.deepEqual(run(true, false, true, true), { streak: 2, clean: 3, total: 4 });
});

test('recordRep never changes the state it is given, and copes with none', () => {
  const s = Object.freeze({ streak: 1, clean: 1, total: 1 });
  assert.doesNotThrow(() => recordRep(s, true));
  assert.deepEqual(recordRep(undefined, true), { streak: 1, clean: 1, total: 1 });
});

test('five clean in a row means ready for the next tempo, and one miss undoes that', () => {
  assert.equal(REPS_TO_STEP, 5);
  assert.equal(readyToStep(run(true, true, true, true)), false);
  assert.equal(readyToStep(run(true, true, true, true, true)), true);
  assert.equal(readyToStep(run(true, true, true, true, true, false)), false);
  assert.equal(readyToStep(run(false, true, true, true, true, true)), true);
  assert.equal(readyToStep(null), false);
  assert.equal(readyToStep(run(true, true, true), 3), true);
});

test('describeReps', () => {
  assert.equal(describeReps(emptyReps()), '');
  assert.equal(describeReps(undefined), '');
  assert.equal(describeReps(run(true, true, false)), '2 of 3 clean');
  assert.equal(describeReps(run(true, false, true, true)), '2 clean in a row · 3 of 4 clean');
});

test('cleanPercent rounds and never goes outside 0 to 100', () => {
  assert.equal(cleanPercent(1, 3), 33);
  assert.equal(cleanPercent(2, 3), 67);
  assert.equal(cleanPercent(5, 5), 100);
  assert.equal(cleanPercent(9, 5), 100);
  assert.equal(cleanPercent(-2, 5), 0);
  assert.equal(cleanPercent(1, 0), null);
  assert.equal(cleanPercent('x', 4), null);
});

test('a spot\'s lifetime line', () => {
  assert.equal(spotRepsLine({ reps: { clean: 12, total: 20 } }), '12 of 20 clean (60%)');
  assert.equal(spotRepsLine({}), '');
  assert.equal(spotRepsLine(null), '');
  assert.equal(spotRepsLine({ reps: { clean: 0, total: 0 } }), '');
});

const TODAY = '2026-11-01';
let n = 0;
const id = () => `s${n++}`;
const spots = () => addSpot(addSpot([], 'Bars 9-12', TODAY, id), 'bar 30', TODAY, id);

test('addSpotReps adds to one spot, cumulatively, and leaves the rest alone', () => {
  let list = spots();
  const sid = list[0].id;
  list = addSpotReps(list, sid, 3, 5);
  assert.deepEqual(list[0].reps, { clean: 3, total: 5 });
  list = addSpotReps(list, sid, 4, 4);
  assert.deepEqual(list[0].reps, { clean: 7, total: 9 });
  assert.equal('reps' in list[1], false);
});

test('addSpotReps ignores nonsense and unknown spots', () => {
  const list = spots();
  const sid = list[0].id;
  for (const [c, t] of [[-1, 3], [5, 3], [1, 0], ['a', 3], [1, NaN], [undefined, undefined]]) assert.deepEqual(addSpotReps(list, sid, c, t), list, `${c}/${t}`);
  assert.deepEqual(addSpotReps(list, 'nope', 1, 2), list);
});

test('rep totals survive every other change to the list, and the cleaning pass', () => {
  let list = spots();
  const sid = list[0].id;
  list = addSpotReps(list, sid, 2, 3);
  list = setSpotTempo(list, sid, 70);
  list = setSpotFixed(list, sid, true, TODAY);
  list = setSpotFixed(list, sid, false, TODAY);
  list = addSpot(list, 'bar 40', TODAY, id);
  assert.deepEqual(list[0].reps, { clean: 2, total: 3 });
  assert.deepEqual(parseSpots(JSON.parse(JSON.stringify(list)))[0].reps, { clean: 2, total: 3 });
  assert.deepEqual(removeSpot(list, list[1].id)[0].reps, { clean: 2, total: 3 });
});

test('stored reps that make no sense are dropped, and spots without reps gain no key', () => {
  const cleaned = parseSpots([
    { id: 'a', bars: '1-4', reps: { clean: 5, total: 3 } }, { id: 'b', bars: '5-8', reps: { clean: -1, total: 3 } },
    { id: 'c', bars: '9-12', reps: { clean: '4', total: '6' } }, { id: 'd', bars: '13-16' },
  ]);
  assert.equal('reps' in cleaned[0], false);
  assert.equal('reps' in cleaned[1], false);
  assert.deepEqual(cleaned[2].reps, { clean: 4, total: 6 });
  assert.equal('reps' in cleaned[3], false);
});
