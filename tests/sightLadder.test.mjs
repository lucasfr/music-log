import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAttempts, serializeAttempts, addAttempt, currentLevel, suggestLevel, levelLabel, LEVELS, MAX_ATTEMPTS, MAX_LEVEL, MIN_LEVEL,
} from '../src/utils/sightLadder.js';

const add = (list, level, rating, day = 1) => addAttempt(list, `2026-10-${String(day).padStart(2, '0')}`, level, rating);
const build = (...pairs) => pairs.reduce((l, [lv, r], i) => add(l, lv, r, 1 + (i % 28)), []);

test('no attempts: stay on level 1, and say how to start', () => {
  const s = suggestLevel([]);
  assert.equal(s.level, 1);
  assert.equal(s.change, 'stay');
  assert.match(s.reason, /Log an attempt/);
  assert.equal(currentLevel([]), 1);
});

test('three good attempts at a level step up', () => {
  const s = suggestLevel(build([3, 4], [3, 5], [3, 4]));
  assert.equal(s.change, 'up');
  assert.equal(s.level, 4);
  assert.match(s.reason, /averaged 4\.3: time for level 4/);
});

test('three middling attempts stay, with the average in the reason', () => {
  const s = suggestLevel(build([3, 4], [3, 3], [3, 4]));
  assert.equal(s.change, 'stay');
  assert.match(s.reason, /not fluent yet/);
});

test('fewer than three at a level: say how many more', () => {
  const s = suggestLevel(build([2, 5], [2, 5]));
  assert.equal(s.change, 'stay');
  assert.match(s.reason, /^1 more attempt at level 2/);
  assert.match(suggestLevel(build([2, 5])).reason, /^2 more attempts at level 2/);
});

test('two struggles in a row at a level step down', () => {
  const s = suggestLevel(build([4, 3], [4, 2], [4, 1]));
  assert.equal(s.change, 'down');
  assert.equal(s.level, 3);
});

test('one bad attempt is not enough to step down', () => {
  assert.equal(suggestLevel(build([4, 4], [4, 1])).change, 'stay');
});

test('only the unbroken run at the current level counts: attempts at other levels are ignored', () => {
  // Fluent at 2, then moved to 3 and had one go: the old level 2 results do not count towards 3.
  const s = suggestLevel(build([2, 5], [2, 5], [2, 5], [3, 5]));
  assert.equal(s.current, 3);
  assert.equal(s.runLength, 1);
  assert.equal(s.change, 'stay');
});

test('the ladder stops at both ends', () => {
  assert.equal(suggestLevel(build([MAX_LEVEL, 5], [MAX_LEVEL, 5], [MAX_LEVEL, 5])).change, 'stay');
  assert.equal(suggestLevel(build([MIN_LEVEL, 1], [MIN_LEVEL, 1])).change, 'stay');
  assert.equal(suggestLevel(build([MIN_LEVEL, 1], [MIN_LEVEL, 1])).level, MIN_LEVEL);
});

test('addAttempt rejects out-of-range levels and ratings, and rounds', () => {
  assert.equal(add([], 0, 3).length, 0);
  assert.equal(add([], 9, 3).length, 0);
  assert.equal(add([], 3, 0).length, 0);
  assert.equal(add([], 3, 6).length, 0);
  assert.equal(add([], 'x', 3).length, 0);
  assert.equal(addAttempt([], 'yesterday', 3, 3).length, 0);
  assert.deepEqual(add([], 3.4, 4.6), [{ date: '2026-10-01', level: 3, rating: 5 }]);
});

test('only the latest MAX_ATTEMPTS are kept', () => {
  let l = [];
  for (let i = 0; i < MAX_ATTEMPTS + 7; i++) l = add(l, 3, 3, 1 + (i % 28));
  assert.equal(l.length, MAX_ATTEMPTS);
});

test('parse and serialize round-trip; junk is dropped', () => {
  const l = build([3, 4], [4, 5]);
  assert.deepEqual(parseAttempts(serializeAttempts(l)), l);
  assert.deepEqual(parseAttempts('nope'), []);
  assert.deepEqual(parseAttempts('{"a":1}'), []);
  assert.deepEqual(parseAttempts(JSON.stringify([null, 5, { date: 'x' }, { date: '2026-10-01', level: 3, rating: 9 }, { date: '2026-10-01', level: 3.5, rating: 3 }])), []);
  // numbers stored as text are read as numbers
  assert.deepEqual(parseAttempts(JSON.stringify([{ date: '2026-10-01', level: '3', rating: '4' }])), [{ date: '2026-10-01', level: 3, rating: 4 }]);
});

test('eight levels, each described', () => {
  assert.equal(LEVELS.length, 8);
  LEVELS.forEach((l, i) => { assert.equal(l.level, i + 1); assert.ok(l.label.length > 10); });
  assert.equal(levelLabel(3), LEVELS[2].label);
  assert.equal(levelLabel(99), LEVELS[0].label);
});
