import test from 'node:test';
import assert from 'node:assert/strict';
import { energyColours, contrast, coverageRamp, LIKING_LINE, COVERAGE_TEAL_SELECTED } from '../src/utils/chartColours.js';
import { THEMES } from '../src/theme/index.js';

const LEVELS = ['-2', '-1', '0', '1', '2'];

test('both themes colour all five energy levels', () => {
  for (const dark of [false, true]) {
    const set = energyColours(dark);
    assert.deepEqual(Object.keys(set).sort(), [...LEVELS].sort());
    for (const k of LEVELS) assert.match(set[k], /^#[0-9A-Fa-f]{6}$/);
  }
});

test('dark: every energy colour is clear on the dark page (at least 3:1)', () => {
  const page = THEMES.dark.colours.bg;
  for (const k of LEVELS) {
    const c = energyColours(true)[k];
    assert.ok(contrast(c, page) >= 3, `level ${k}: ${c} on ${page} is ${contrast(c, page).toFixed(2)}:1`);
  }
});

test('light: the original colours are kept', () => {
  assert.deepEqual(energyColours(false), {
    '-2': '#8C2045', '-1': '#B85C7A', '0': '#7AB2B2', '1': '#F77F00', '2': '#FCBF49',
  });
});

test('the liking line and the selected minor key keep their colours', () => {
  assert.equal(LIKING_LINE, '#E87EA1');
  assert.equal(COVERAGE_TEAL_SELECTED, '#1D9E75');
});

test('the legend swatches are the middle step of each ramp, light and dark', () => {
  assert.equal(coverageRamp('amber', false)[2], '#EF9F27');
  assert.equal(coverageRamp('teal', false)[2], '#5DCAA5');
  assert.notEqual(coverageRamp('amber', true)[2], coverageRamp('amber', false)[2]);
});
