// Tests for chart segment colours and readable label colours (src/utils/chartColours.js).  Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '../src/utils/chartColours.js'), 'utf8');
const { readableOn, contrast, coverageColour, coverageRamp, COVERAGE_KINDS } =
  await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

const PAGE = { light: '#EBF4F6', dark: '#0A1418' };   // the theme backgrounds

test('white text on a dark fill, near-black on a light one', () => {
  assert.equal(readableOn('#000000', PAGE.light), '#FFFFFF');
  assert.equal(readableOn('#FFFFFF', PAGE.dark), '#050A0D');
  assert.equal(readableOn('#FAEEDA', PAGE.dark), '#050A0D', 'a pale fill gets dark text even on the dark theme');
  assert.equal(readableOn('#854F0B', PAGE.light), '#FFFFFF', 'a dark brown fill gets white text even on the light theme');
});

test('a translucent fill is judged as it looks over the page', () => {
  const grey = 'rgba(180,178,170,0.22)';
  assert.equal(readableOn(grey, PAGE.dark), '#FFFFFF');   // looks dark grey on the dark page
  assert.equal(readableOn(grey, PAGE.light), '#050A0D');  // looks light grey on the light page
});

for (const theme of ['light', 'dark']) {
  test(`${theme}: the key name is readable (at least 4.5:1) on every coverage step`, () => {
    for (const kind of COVERAGE_KINDS) {
      for (const fill of [...coverageRamp(kind, theme === 'dark'), coverageColour(kind, 0, 10, theme === 'dark')]) {
        const text = readableOn(fill, PAGE[theme]);
        const ratio = contrast(text, fill, PAGE[theme]);
        assert.ok(ratio >= 4.5, `${theme} ${kind} ${fill}: ${ratio.toFixed(2)}:1`);
      }
    }
  });
}

test('the selected-key fills are readable too', () => {
  for (const fill of ['#FCBF49', '#1D9E75']) {
    for (const page of Object.values(PAGE)) assert.ok(contrast(readableOn(fill, page), fill, page) >= 4.5, fill);
  }
});

test('more practice is darker on the light theme and brighter on the dark theme', () => {
  const lum = c => contrast(c, '#000000');  // brighter = higher contrast against black
  for (const kind of COVERAGE_KINDS) {
    const light = coverageRamp(kind, false).map(lum);
    const dark = coverageRamp(kind, true).map(lum);
    for (let i = 1; i < 5; i++) {
      assert.ok(light[i] < light[i - 1], `${kind} light step ${i} should be darker`);
      assert.ok(dark[i] > dark[i - 1], `${kind} dark step ${i} should be brighter`);
    }
  }
});

test('the palest dark-theme step is dark, not a pastel slab', () => {
  for (const kind of COVERAGE_KINDS) assert.ok(contrast(coverageRamp(kind, true)[0], '#000000') < 2, kind);
});

test('steps follow the cuts: none, then five bands up to the busiest key', () => {
  assert.equal(coverageColour('amber', 0, 10, false), 'rgba(180,178,170,0.22)');
  assert.equal(coverageColour('teal', 0, 10, true), 'rgba(180,178,170,0.15)');
  assert.equal(coverageColour('amber', 1, 100, false), '#FAEEDA');    // t = .01
  assert.equal(coverageColour('amber', 15, 100, false), '#FAC775');   // t = .15 is the next band (cuts are exclusive)
  assert.equal(coverageColour('amber', 10, 10, false), '#854F0B');    // the busiest key
  assert.equal(coverageColour('teal', 10, 10, true), '#7BE3BF');
  assert.equal(coverageColour('amber', 5, 0, false), '#854F0B', 'a max of 0 does not divide by zero');
});

test('dark and light ramps differ, and each has five steps', () => {
  for (const kind of COVERAGE_KINDS) {
    assert.equal(coverageRamp(kind, false).length, 5);
    assert.equal(coverageRamp(kind, true).length, 5);
    assert.notDeepEqual(coverageRamp(kind, false), coverageRamp(kind, true));
  }
});
