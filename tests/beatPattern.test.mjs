import test from 'node:test';
import assert from 'node:assert/strict';
import { allStrong, firstOnly, halfBar, fitPattern, cycleBeat, beatSound, isDefault, describePattern, STRONG, WEAK, MUTE } from '../src/utils/beatPattern.js';

test('the default is every beat strong, which is how the metronome has always clicked', () => {
  assert.deepEqual(allStrong(4), [STRONG, STRONG, STRONG, STRONG]);
  assert.equal(isDefault(allStrong(4)), true);
  assert.equal(isDefault(undefined), true);
  assert.deepEqual(allStrong(0), [STRONG]);
  assert.deepEqual(allStrong('x'), [STRONG]);
});

test('presets: one only, and half bar', () => {
  assert.deepEqual(firstOnly(4), [STRONG, WEAK, WEAK, WEAK]);
  assert.deepEqual(halfBar(4), [STRONG, WEAK, STRONG, WEAK]);
  assert.deepEqual(halfBar(6), [STRONG, WEAK, WEAK, STRONG, WEAK, WEAK]);
  assert.deepEqual(halfBar(3), [STRONG, WEAK, WEAK]);          // odd bar: no middle
  assert.deepEqual(halfBar(1), [STRONG]);
});

test('tapping a beat cycles strong, weak, mute, strong', () => {
  let p = allStrong(4);
  p = cycleBeat(p, 1); assert.equal(p[1], WEAK);
  p = cycleBeat(p, 1); assert.equal(p[1], MUTE);
  p = cycleBeat(p, 1); assert.equal(p[1], STRONG);
  assert.equal(p[0], STRONG);
});

test('cycleBeat leaves other beats alone, ignores a beat that is not there, and does not change its input', () => {
  const p = Object.freeze([STRONG, WEAK, MUTE]);
  assert.deepEqual(cycleBeat(p, 0), [WEAK, WEAK, MUTE]);
  assert.deepEqual(cycleBeat(p, 7), [STRONG, WEAK, MUTE]);
  assert.deepEqual(cycleBeat(p, -1), [STRONG, WEAK, MUTE]);
});

test('a stored pattern is fitted to the bar: cut, padded with strong, junk made strong', () => {
  assert.deepEqual(fitPattern([WEAK, MUTE, WEAK, WEAK, WEAK], 3), [WEAK, MUTE, WEAK]);
  assert.deepEqual(fitPattern([WEAK], 3), [WEAK, STRONG, STRONG]);
  assert.deepEqual(fitPattern(['loud', null, MUTE], 3), [STRONG, STRONG, MUTE]);
  assert.deepEqual(fitPattern(undefined, 2), [STRONG, STRONG]);
  assert.deepEqual(fitPattern([], 0), [STRONG]);
});

test('beatSound reads the pattern, and anything outside it is strong', () => {
  const p = [STRONG, WEAK, MUTE];
  assert.equal(beatSound(p, 0), STRONG);
  assert.equal(beatSound(p, 1), WEAK);
  assert.equal(beatSound(p, 2), MUTE);
  assert.equal(beatSound(p, 3), STRONG);
  assert.equal(beatSound(undefined, 0), STRONG);
  assert.equal(beatSound(['x'], 0), STRONG);
});

test('describePattern', () => {
  assert.equal(describePattern(allStrong(4)), 'Accents');
  assert.equal(describePattern(firstOnly(4)), 'Accents: 1');
  assert.equal(describePattern(halfBar(4)), 'Accents: 1 · 3');
  assert.equal(describePattern([STRONG, WEAK, MUTE, WEAK]), 'Accents: 1, silent: 3');
  assert.equal(describePattern([WEAK, MUTE]), 'Accents: none, silent: 2');
});
