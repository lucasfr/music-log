import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ladderKey, parseScaleTempos, serializeScaleTempos, cleanTempoFor, recordClean, startTempoFor, stepTempo, pickLadder, describeLadder,
  START_BPM, STEP_BPM, MIN_BPM, MAX_BPM, ROUTINE_SIZE,
} from '../src/utils/scaleLadder.js';

const q = (name, extra = {}) => ({ name, motion: 'parallel', octaves: 2, interval: 'unison', ...extra });
const D = '2026-10-20';

test('the key tells scales apart by name, octaves, motion and interval', () => {
  const keys = new Set([ladderKey(q('C major')), ladderKey(q('C major', { octaves: 1 })), ladderKey(q('C major', { motion: 'contrary' })), ladderKey(q('C major', { interval: 'third' })), ladderKey(q('G major'))]);
  assert.equal(keys.size, 5);
  assert.equal(ladderKey({ scale: 'C major', octaves: 2 }), ladderKey(q('C major')));          // the entry shape from the log works too
  assert.equal(ladderKey({}), '|1|parallel|unison');
});

test('recording a clean tempo keeps the latest and the best', () => {
  let m = recordClean({}, q('C major'), 80, D);
  assert.deepEqual(m[ladderKey(q('C major'))], { bpm: 80, best: 80, date: D });
  m = recordClean(m, q('C major'), 92, '2026-10-22');
  m = recordClean(m, q('C major'), 76, '2026-10-25');            // a gentler day: latest drops, best stays
  assert.deepEqual(m[ladderKey(q('C major'))], { bpm: 76, best: 92, date: '2026-10-25' });
  assert.equal(cleanTempoFor(m, q('C major')), 76);
  assert.equal(cleanTempoFor(m, q('D major')), null);
});

test('a tempo outside the metronome range or a bad date records nothing', () => {
  for (const bpm of [29, 241, 0, NaN, 'fast', undefined]) assert.deepEqual(recordClean({}, q('C major'), bpm, D), {}, String(bpm));
  assert.deepEqual(recordClean({}, q('C major'), 80, 'yesterday'), {});
  assert.deepEqual(recordClean(undefined, q('C major'), 80, ''), {});
  const was = Object.freeze({});
  assert.doesNotThrow(() => recordClean(was, q('C major'), 80, D));
});

test('where to start: a step above the last clean tempo, or the gentle start', () => {
  assert.equal(startTempoFor({}, q('C major')), START_BPM);
  const m = recordClean({}, q('C major'), 80, D);
  assert.equal(startTempoFor(m, q('C major')), 80 + STEP_BPM);
  assert.equal(startTempoFor(recordClean({}, q('C major'), MAX_BPM, D), q('C major')), MAX_BPM);
});

test('Clean steps up, Not yet steps down, both inside the range', () => {
  assert.equal(stepTempo(80, true), 84);
  assert.equal(stepTempo(80, false), 76);
  assert.equal(stepTempo(MIN_BPM, false), MIN_BPM);
  assert.equal(stepTempo(MAX_BPM, true), MAX_BPM);
  assert.equal(stepTempo(undefined, true), START_BPM + STEP_BPM);
});

test('a routine does the scales with no clean tempo first, then the one longest since', () => {
  const reqs = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(n => q(`${n} major`));
  let m = recordClean({}, reqs[0], 80, '2026-10-10');       // A: oldest
  m = recordClean(m, reqs[1], 80, '2026-10-18');            // B: recent
  m = recordClean(m, reqs[2], 80, '2026-10-12');            // C: middle
  const picked = pickLadder(reqs, m, 5).map(x => x.name);
  assert.deepEqual(picked, ['D major', 'E major', 'F major', 'G major', 'A major']);      // four new ones, then the oldest
});

test('a routine is at most ROUTINE_SIZE by default, keeps the list\'s order among equals, and copes with nothing', () => {
  const reqs = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(n => q(`${n} major`));
  assert.equal(pickLadder(reqs, {}).length, ROUTINE_SIZE);
  assert.deepEqual(pickLadder(reqs, {}, 3).map(x => x.name), ['A major', 'B major', 'C major']);
  assert.deepEqual(pickLadder([], {}), []);
  assert.deepEqual(pickLadder(undefined, undefined), []);
  assert.deepEqual(pickLadder(reqs, {}, 0), []);
});

test('the list given to pickLadder is not reordered', () => {
  const reqs = [q('B major'), q('A major')];
  const copy = [...reqs];
  pickLadder(reqs, recordClean({}, reqs[0], 80, D), 2);
  assert.deepEqual(reqs, copy);
});

test('describeLadder', () => {
  assert.equal(describeLadder({}, q('C major')), 'No clean tempo yet');
  let m = recordClean({}, q('C major'), 80, D);
  assert.equal(describeLadder(m, q('C major')), 'Last clean 80 bpm');
  m = recordClean(recordClean(m, q('C major'), 92, D), q('C major'), 84, D);
  assert.equal(describeLadder(m, q('C major')), 'Last clean 84 bpm, best 92');
});

test('parse and serialize round-trip and clean stored junk', () => {
  const m = recordClean(recordClean({}, q('C major'), 80, D), q('G major'), 70, D);
  assert.deepEqual(parseScaleTempos(serializeScaleTempos(m)), m);
  assert.deepEqual(parseScaleTempos('nope'), {});
  assert.deepEqual(parseScaleTempos('[1,2]'), {});
  assert.deepEqual(parseScaleTempos(JSON.stringify({ a: { bpm: 5, date: D }, b: { bpm: 80, date: 'x' }, c: null, d: { bpm: 80, best: 10, date: D } })), { d: { bpm: 80, best: 80, date: D } });
});
