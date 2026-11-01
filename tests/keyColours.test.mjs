import test from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, SCHEMES, themeKey, COLOURS, applyTheme } from '../src/theme/index.js';
import { coverageColour, coverageRamp, readableOn, contrast, selectedMinorColour, COVERAGE_TEAL_SELECTED, COVERAGE_KINDS } from '../src/utils/chartColours.js';

// The circle of fifths follows the colour scheme: in a scheme the key ramps are made from the scheme's own colours; in the
// standard theme they are the fixed amber and green ramps, exactly as before.

const SCHEME_KEYS = Object.keys(SCHEMES).filter(k => k !== 'standard');
const HEX = /^#[0-9A-F]{6}$/i;
const lum = c => contrast(c, '#000000');   // brighter = higher contrast against black

test('the standard themes give the same ramps and colours as before, with or without their palette', () => {
  for (const mode of ['light', 'dark']) {
    const palette = THEMES[mode].colours;
    for (const kind of COVERAGE_KINDS) {
      assert.deepEqual(coverageRamp(kind, mode === 'dark', palette), coverageRamp(kind, mode === 'dark'), `${mode} ${kind}`);
      for (const n of [0, 1, 3, 6, 10]) assert.equal(coverageColour(kind, n, 10, mode === 'dark', palette), coverageColour(kind, n, 10, mode === 'dark'), `${mode} ${kind} ${n}`);
    }
    assert.equal(selectedMinorColour(palette), COVERAGE_TEAL_SELECTED);
  }
  assert.equal(selectedMinorColour(undefined), COVERAGE_TEAL_SELECTED);
  assert.equal(selectedMinorColour({}), COVERAGE_TEAL_SELECTED);
});

test('every palette says which scheme it belongs to', () => {
  assert.equal(THEMES.light.colours.__scheme, 'standard');
  assert.equal(THEMES.dark.colours.__scheme, 'standard');
  for (const k of SCHEME_KEYS) {
    assert.equal(THEMES[`${k}-light`].colours.__scheme, k);
    assert.equal(THEMES[`${k}-dark`].colours.__scheme, k);
  }
});

for (const scheme of SCHEME_KEYS) {
  for (const mode of ['light', 'dark']) {
    const dark = mode === 'dark';
    const palette = THEMES[themeKey(scheme, mode)].colours;
    const label = `${scheme}-${mode}`;

    test(`${label}: both rings have five distinct colours, different from the standard ones and from each other`, () => {
      const major = coverageRamp('amber', dark, palette);
      const minor = coverageRamp('teal', dark, palette);
      for (const ramp of [major, minor]) {
        assert.equal(ramp.length, 5);
        ramp.forEach(c => assert.match(c, HEX));
        assert.equal(new Set(ramp.map(c => c.toUpperCase())).size, 5, ramp.join(' '));
      }
      assert.notDeepEqual(major, coverageRamp('amber', dark));
      assert.notDeepEqual(minor, coverageRamp('teal', dark));
      assert.notDeepEqual(major, minor);
    });

    test(`${label}: more practice is darker on a light page and brighter on a dark one`, () => {
      for (const kind of COVERAGE_KINDS) {
        const l = coverageRamp(kind, dark, palette).map(lum);
        for (let i = 1; i < 5; i++) {
          assert.ok(dark ? l[i] > l[i - 1] : l[i] < l[i - 1], `${kind} step ${i} (${l.map(v => v.toFixed(2)).join(', ')})`);
        }
      }
    });

    test(`${label}: the palest dark step is dark, not a pastel slab, and the busiest step stands out from the page`, () => {
      for (const kind of COVERAGE_KINDS) {
        const ramp = coverageRamp(kind, dark, palette);
        if (dark) assert.ok(lum(ramp[0]) < 2, `${kind} palest step is ${ramp[0]}`);
        assert.ok(contrast(ramp[4], palette.bg) >= 3, `${kind} busiest step ${ramp[4]} on ${palette.bg} is ${contrast(ramp[4], palette.bg).toFixed(2)}:1`);
      }
    });

    test(`${label}: a key name is readable (at least 4.5:1) on every step, on the selected minor key, and on the selected major key`, () => {
      const fills = [
        ...COVERAGE_KINDS.flatMap(kind => coverageRamp(kind, dark, palette)),
        selectedMinorColour(palette),
        palette.gold,
      ];
      for (const fill of fills) {
        const text = readableOn(fill, palette.bg);
        assert.ok(contrast(text, fill, palette.bg) >= 4.5, `${fill}: ${contrast(text, fill, palette.bg).toFixed(2)}:1`);
      }
    });

    test(`${label}: the steps follow the cuts, none is the neutral grey, and the busiest key is the last step`, () => {
      for (const kind of COVERAGE_KINDS) {
        const ramp = coverageRamp(kind, dark, palette);
        assert.equal(coverageColour(kind, 0, 10, dark, palette), coverageColour(kind, 0, 10, dark));   // no practice: the same neutral
        assert.equal(coverageColour(kind, 10, 10, dark, palette), ramp[4]);
        assert.equal(coverageColour(kind, 1, 100, dark, palette), ramp[0]);
        assert.equal(coverageColour(kind, 5, 0, dark, palette), ramp[4], 'a max of 0 does not divide by zero');
      }
    });

    test(`${label}: the selected minor key is not one of the minor steps`, () => {
      assert.ok(!coverageRamp('teal', dark, palette).map(c => c.toUpperCase()).includes(selectedMinorColour(palette).toUpperCase()));
      assert.notEqual(selectedMinorColour(palette), COVERAGE_TEAL_SELECTED);
    });
  }
}

test('switching to a scheme and back changes which ramps the keys use, and leaves nothing behind', () => {
  applyTheme('light');
  assert.equal(COLOURS.__scheme, 'standard');
  const std = coverageRamp('amber', false, COLOURS);
  applyTheme('indigo-dark');
  assert.equal(COLOURS.__scheme, 'indigo');
  assert.notDeepEqual(coverageRamp('amber', true, COLOURS), coverageRamp('amber', true));
  applyTheme('light');
  assert.equal(COLOURS.__scheme, 'standard');
  assert.deepEqual(coverageRamp('amber', false, COLOURS), std);
});
