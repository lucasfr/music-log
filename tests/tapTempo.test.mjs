import test from 'node:test';
import assert from 'node:assert/strict';
import { addTap, bpmFromTaps, TAP_RESET_MS, MAX_TAPS, MIN_BPM, MAX_BPM } from '../src/utils/tapTempo.js';

const tapAt = (times) => times.reduce((taps, t) => addTap(taps, t), []);

test('one tap gives no tempo yet', () => {
  assert.equal(bpmFromTaps(tapAt([1000])), null);
  assert.equal(bpmFromTaps([]), null);
  assert.equal(bpmFromTaps(undefined), null);
});

test('steady taps give the tempo: 500 ms apart is 120 bpm, 1000 ms is 60', () => {
  assert.equal(bpmFromTaps(tapAt([0, 500])), 120);
  assert.equal(bpmFromTaps(tapAt([0, 500, 1000, 1500])), 120);
  assert.equal(bpmFromTaps(tapAt([0, 1000, 2000])), 60);
});

test('uneven taps are averaged and rounded to a whole bpm', () => {
  // intervals 480, 520, 500 -> average 500 -> 120
  assert.equal(bpmFromTaps(tapAt([0, 480, 1000, 1500])), 120);
  // 667 ms -> 89.96 -> 90
  assert.equal(bpmFromTaps(tapAt([0, 667])), 90);
});

test('a pause longer than the reset time starts a new count', () => {
  const taps = tapAt([0, 500, 1000, 1000 + TAP_RESET_MS + 1]);
  assert.deepEqual(taps, [1000 + TAP_RESET_MS + 1]);
  assert.equal(bpmFromTaps(taps), null);
  // exactly at the limit still counts as the same run
  assert.equal(addTap([0], TAP_RESET_MS).length, 2);
});

test('only the latest taps count, so the tempo follows a change of pace', () => {
  const slow = [0, 1000, 2000, 3000];                      // 60 bpm
  const times = [...slow, 3500, 4000, 4500, 5000, 5500];   // then 120 bpm
  const taps = tapAt(times);
  assert.equal(taps.length, MAX_TAPS);
  assert.equal(bpmFromTaps(taps), 120);
});

test('the result stays inside the metronome range', () => {
  assert.equal(bpmFromTaps(tapAt([0, 100])), MAX_BPM);     // 600 bpm
  assert.equal(bpmFromTaps(tapAt([0, 1900])), 32);         // slow but inside the range
  assert.equal(bpmFromTaps([0, 5000]), MIN_BPM);           // 12 bpm, forced past the reset
});

test('a clock that goes backwards starts again; identical times give nothing', () => {
  assert.deepEqual(addTap([5000], 4000), [4000]);
  assert.equal(bpmFromTaps([1000, 1000]), null);
});
