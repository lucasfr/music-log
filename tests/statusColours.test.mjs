// Tests for the status colours on both themes (STATUS_COLOURS in src/theme/index.js).  Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = p => readFileSync(join(here, '..', p), 'utf8');
const { COLOURS, STATUS_COLOURS, TINT_TEXT, applyTheme } =
  await import('data:text/javascript;base64,' + Buffer.from(read('src/theme/index.js')).toString('base64'));

// Every status the app can show, from constants.js
const STATUSES = /STATUS_OPTIONS\s*=\s*\[([^\]]*)\]/.exec(read('src/constants.js'))[1].match(/'([^']+)'/g).map(s => s.slice(1, -1));

// '#rrggbb' or 'rgba(r,g,b,a)' -> [r, g, b, a]
function parse(c) {
  if (c[0] === '#') return [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)).concat(1);
  const [r, g, b, a = 1] = c.match(/[\d.]+/g).map(Number);
  return [r, g, b, a];
}
const luminance = rgb => {
  const [r, g, b] = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
// A status tile: its (possibly translucent) background over the page, and its text colour.
function tileAndText(sc) {
  const page = parse(COLOURS.bg);
  const [r, g, b, a] = parse(sc.bg);
  return { tile: [r, g, b].map((v, i) => v * a + page[i] * (1 - a)), text: parse(sc.text).slice(0, 3) };
}

for (const theme of ['light', 'dark']) {
  test(`${theme}: every status has a background, text and border colour`, () => {
    applyTheme(theme);
    for (const s of STATUSES) {
      const sc = STATUS_COLOURS[s];
      assert.ok(sc && sc.bg && sc.text && sc.border, `${theme} theme has no colours for "${s}"`);
    }
  });

  test(`${theme}: a status's text and icon are readable on its tile (at least 4.5:1)`, () => {
    applyTheme(theme);
    for (const s of STATUSES) {
      const { tile, text } = tileAndText(STATUS_COLOURS[s]);
      const ratio = contrast(text, tile);
      assert.ok(ratio >= 4.5, `${theme} "${s}": ${ratio.toFixed(2)}:1`);
    }
  });
}

test('on the dark theme the tiles stay dark instead of glaring like the light pastels', () => {
  applyTheme('dark');
  for (const s of STATUSES) {
    const { tile } = tileAndText(STATUS_COLOURS[s]);
    assert.ok(luminance(tile) < 0.15, `dark "${s}" tile is too bright (${luminance(tile).toFixed(2)})`);
  }
});

test('the colours follow the theme, so dark mode is not the light pastels', () => {
  applyTheme('light');
  const light = { ...STATUS_COLOURS.learning };
  applyTheme('dark');
  const dark = { ...STATUS_COLOURS.learning };
  assert.notEqual(light.bg, dark.bg);
  assert.notEqual(light.text, dark.text);
  applyTheme('light');
  assert.equal(STATUS_COLOURS.learning.bg, light.bg, 'switching back restores the light colours');
});

test('listing the statuses works (the objects behave like plain ones)', () => {
  applyTheme('dark');
  assert.deepEqual(Object.keys(STATUS_COLOURS).sort(), [...STATUSES].sort());
  assert.equal(STATUS_COLOURS.nonsense, undefined);
});

// Text on a faint amber (selected filter pill) or green ("connected") tint, as the app draws them.
const TINTS = { amber: 'rgba(247,127,0,0.14)', success: 'rgba(0,180,120,0.08)' };
for (const theme of ['light', 'dark']) {
  test(`${theme}: text on an amber or green tint is readable (at least 4.5:1)`, () => {
    applyTheme(theme);
    for (const kind of Object.keys(TINTS)) {
      const { tile, text } = tileAndText({ bg: TINTS[kind], text: TINT_TEXT[kind] });
      const ratio = contrast(text, tile);
      assert.ok(ratio >= 4.5, `${theme} ${kind}: ${ratio.toFixed(2)}:1`);
    }
  });
}
