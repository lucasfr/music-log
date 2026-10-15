// Tests for the chart x-axis label picking (src/utils/chartLabels.js).  Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '../src/utils/chartLabels.js'), 'utf8');
const { labelIndices, labelAnchor, MIN_LABEL_WIDTH } =
  await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

const sorted = set => [...set].sort((a, b) => a - b);

test('the newest point is always labelled', () => {
  for (const count of [2, 7, 41, 90]) {
    const got = sorted(labelIndices(count, 337));
    assert.equal(got[got.length - 1], count - 1, `count ${count}`);
  }
});

test('the oldest point is labelled when it falls on the stride, and not squeezed in otherwise', () => {
  // 31 points in 337pt: step 6, so 30, 24, 18, 12, 6, 0
  assert.equal(sorted(labelIndices(31, 337))[0], 0);
  // 41 points: step 7, so 40 ... 5; point 0 would be only 41pt from point 5
  assert.equal(sorted(labelIndices(41, 337))[0], 5);
});

test('no two labels are closer than the minimum, for any realistic chart', () => {
  for (let count = 2; count <= 120; count++) {
    for (const width of [200, 280, 337, 420, 700]) {
      const slot = width / count;
      const got = sorted(labelIndices(count, width));
      for (let k = 1; k < got.length; k++) {
        const gap = (got[k] - got[k - 1]) * slot;
        assert.ok(gap >= MIN_LABEL_WIDTH - 1e-9, `count ${count}, width ${width}: labels ${got[k - 1]} and ${got[k]} are ${gap.toFixed(1)}pt apart`);
      }
    }
  }
});

test('the case from the screenshot: 41 weekly bars on a phone no longer put 24 Aug and 5 Oct together', () => {
  const got = sorted(labelIndices(41, 337));
  // the last two labels are a full step apart, not one or two bars
  assert.ok((got[got.length - 1] - got[got.length - 2]) * (337 / 41) >= MIN_LABEL_WIDTH);
});

test('a short series shows every label when they all fit', () => {
  assert.deepEqual(sorted(labelIndices(5, 400)), [0, 1, 2, 3, 4]);
});

test('an oldest label that would crowd its neighbour is left out', () => {
  // 10 points in 100pt: step 6, so labels at 9 and 3; point 0 is only 3 slots (30pt) from point 3
  assert.deepEqual(sorted(labelIndices(10, 100)), [3, 9]);
});

test('one point, no points, and a chart that has not been measured yet', () => {
  assert.deepEqual(sorted(labelIndices(1, 300)), [0]);
  assert.deepEqual(sorted(labelIndices(0, 300)), []);
  assert.deepEqual(sorted(labelIndices(12, 0)), [11], 'unmeasured: only the newest, never a crowd');
});

test('a custom minimum is honoured', () => {
  const got = sorted(labelIndices(30, 300, 100));
  for (let k = 1; k < got.length; k++) assert.ok((got[k] - got[k - 1]) * 10 >= 100);
});

test('edge labels are anchored inward so they are not cut off', () => {
  assert.equal(labelAnchor(11, 340), 'start');     // first bar of the volume chart
  assert.equal(labelAnchor(170, 340), 'middle');
  assert.equal(labelAnchor(335, 340), 'end');
  assert.equal(labelAnchor(5, 0), 'start');
  assert.equal(labelAnchor(500, 0), 'middle', 'unmeasured width never forces end');
});
