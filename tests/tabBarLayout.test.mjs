// Tests for fitting the floating tab bar to the screen (src/utils/tabBarLayout.js).  Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '../src/utils/tabBarLayout.js'), 'utf8');
const { tabBarLayout } =
  await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('six tabs on a normal phone keep the usual spacing', () => {
  assert.deepEqual(tabBarLayout(6, 393), { gap: 4, pad: 12, width: 322, fits: true });
});

test('seven tabs (Timeline showing) still fit a 393pt phone at the usual spacing', () => {
  assert.deepEqual(tabBarLayout(7, 393), { gap: 4, pad: 12, width: 370, fits: true });
});

test('seven tabs on a 360pt phone squeeze the gaps and padding to fit', () => {
  const l = tabBarLayout(7, 360);
  assert.equal(l.fits, true);
  assert.ok(l.width <= 360 - 16, `${l.width}pt is wider than the room`);
  assert.equal(l.gap, 0, 'the gaps go first');
});

test('the gaps are squeezed before the padding is', () => {
  // 365pt: room 349. Usual width 370. Gaps to 0 gives 346, which fits, so padding stays at 12.
  const l = tabBarLayout(7, 365);
  assert.equal(l.gap, 0);
  assert.equal(l.pad, 12, 'the padding was not touched when the gaps were enough');
  const tighter = tabBarLayout(7, 360);
  assert.ok(tighter.pad < 12, 'the padding is only reduced when the gaps were not enough');
});

test('a screen too narrow for seven tabs is reported, not hidden', () => {
  const l = tabBarLayout(7, 320);
  assert.equal(l.fits, false);
  assert.equal(l.gap, 0);
  assert.equal(l.pad, 4);
});

test('it never shrinks a tab below its size: the width is always the tabs plus what is left over', () => {
  for (const count of [5, 6, 7]) for (const screen of [320, 360, 375, 393, 430, 768]) {
    const l = tabBarLayout(count, screen);
    assert.equal(l.width, count * 44 + (count - 1) * l.gap + 2 * l.pad + 14);
    assert.ok(l.gap >= 0 && l.pad >= 4);
  }
});

test('a wide screen never stretches the bar past the usual spacing', () => {
  assert.deepEqual(tabBarLayout(6, 1000), { gap: 4, pad: 12, width: 322, fits: true });
});
