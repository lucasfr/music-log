import test from 'node:test';
import assert from 'node:assert/strict';
import { isSilentStep, nextBars, describeSilentBars, MIN_BARS, MAX_BARS } from '../src/utils/silentBars.js';

// 4 beats, no subdivision: 4 steps a bar.
const silentBarsOf = (play, silent, bars, stepsPerBar = 4) => {
  const out = [];
  for (let b = 0; b < bars; b++) out.push(isSilentStep(b * stepsPerBar, stepsPerBar, play, silent));
  return out;
};

test('click for 2 bars, silent for 2, and repeat', () => {
  assert.deepEqual(silentBarsOf(2, 2, 8), [false, false, true, true, false, false, true, true]);
});

test('click for 1 bar, silent for 1 alternates', () => {
  assert.deepEqual(silentBarsOf(1, 1, 5), [false, true, false, true, false]);
});

test('uneven lengths: click for 3, silent for 1', () => {
  assert.deepEqual(silentBarsOf(3, 1, 8), [false, false, false, true, false, false, false, true]);
});

test('every step of a bar is in the same state, first step to last', () => {
  // 8 steps a bar (4 beats in eighths); bar 2 (steps 16..23) is the first silent bar of 2-on-2-off.
  for (let s = 0; s < 16; s++) assert.equal(isSilentStep(s, 8, 2, 2), false, `step ${s}`);
  for (let s = 16; s < 32; s++) assert.equal(isSilentStep(s, 8, 2, 2), true, `step ${s}`);
  for (let s = 32; s < 48; s++) assert.equal(isSilentStep(s, 8, 2, 2), false, `step ${s}`);
});

test('the bar length follows subdivision and main beats (compound time, sixteenths)', () => {
  // 6/8 felt in 2, sixteenth subdivisions of the main pulse: 4 x 2 = 8 steps a bar.
  const spb = 4 * 2;
  assert.equal(isSilentStep(spb * 2 - 1, spb, 2, 1), false); // last step of bar 1
  assert.equal(isSilentStep(spb * 2, spb, 2, 1), true);      // first step of bar 2
  assert.equal(isSilentStep(spb * 3, spb, 2, 1), false);     // bar 3 clicks again
});

test('it stays correct a long way in', () => {
  assert.equal(isSilentStep(4 * 1000, 4, 2, 2), 1000 % 4 >= 2);
  assert.equal(isSilentStep(4 * 1002, 4, 2, 2), true);
});

test('unusable settings never silence the click', () => {
  assert.equal(isSilentStep(8, 4, 0, 2), false);
  assert.equal(isSilentStep(8, 4, 2, 0), false);
  assert.equal(isSilentStep(8, 0, 2, 2), false);
  assert.equal(isSilentStep(-1, 4, 2, 2), false);
  assert.equal(isSilentStep(NaN, 4, 2, 2), false);
  assert.equal(isSilentStep(8, 4, undefined, 2), false);
});

test('nextBars stays within 1 to 8', () => {
  assert.equal(nextBars(2, 1), 3);
  assert.equal(nextBars(1, -1), MIN_BARS);
  assert.equal(nextBars(8, 1), MAX_BARS);
  assert.equal(nextBars(undefined, 1), 2);
});

test('describeSilentBars reads naturally', () => {
  assert.equal(describeSilentBars(2, 2), 'Click 2 bars, silent 2');
  assert.equal(describeSilentBars(1, 3), 'Click 1 bar, silent 3');
});
