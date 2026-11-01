import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// The colour schemes (src/theme/index.js). The theme file is loaded from its source text as a data: URL, as the status
// colour tests do, which also proves it still has no imports (a data: URL cannot resolve one).
const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '../src/theme/index.js'), 'utf8');
const { THEMES, SCHEMES, themeKey, COLOURS, STATUS_COLOURS, applyTheme } =
  await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

const luminance = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const parse = c => (c[0] === '#' ? [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)).concat(1) : c.match(/[\d.]+/g).map(Number));

const SCHEME_KEYS = Object.keys(SCHEMES).filter(k => k !== 'standard');
const themeKeys = Object.keys(THEMES);

test('the theme file has no imports (a test loads it as a data: URL)', () => {
  assert.deepEqual(source.split('\n').filter(l => /^\s*import\s/.test(l)), []);
});

test('there are schemes besides the standard one, each with a light and a dark palette', () => {
  assert.ok(SCHEME_KEYS.length >= 3, `only ${SCHEME_KEYS.length} extra schemes`);
  for (const k of ['standard', ...SCHEME_KEYS]) {
    assert.ok(THEMES[SCHEMES[k].light], `${k} has no light palette`);
    assert.ok(THEMES[SCHEMES[k].dark], `${k} has no dark palette`);
    assert.ok(SCHEMES[k].label);
  }
  assert.deepEqual(themeKeys.sort(), ['dark', 'light', ...SCHEME_KEYS.flatMap(k => [`${k}-dark`, `${k}-light`])].sort());
});

test('themeKey puts a scheme and a mode together, and an unknown scheme is the standard one', () => {
  assert.equal(themeKey('standard', 'light'), 'light');
  assert.equal(themeKey('standard', 'dark'), 'dark');
  assert.equal(themeKey('forest', 'light'), 'forest-light');
  assert.equal(themeKey('forest', 'dark'), 'forest-dark');
  assert.equal(themeKey('nonsense', 'dark'), 'dark');
  assert.equal(themeKey(undefined, 'light'), 'light');
});

for (const scheme of SCHEME_KEYS) {
  for (const mode of ['light', 'dark']) {
    const key = themeKey(scheme, mode);
    const c = THEMES[key].colours;
    const std = THEMES[mode].colours;

    test(`${key}: text, muted text and dim text are readable on the page and on the second page colour`, () => {
      assert.ok(contrast(c.text, c.bg) >= 5.5, `text ${contrast(c.text, c.bg).toFixed(2)}`);
      assert.ok(contrast(c.textMuted, c.bg) >= 4.5, `muted ${contrast(c.textMuted, c.bg).toFixed(2)}`);
      assert.ok(contrast(c.textDim, c.bg) >= 4.5, `dim ${contrast(c.textDim, c.bg).toFixed(2)}`);
      assert.ok(contrast(c.textDim, c.bg2) >= 4.5, `dim on bg2 ${contrast(c.textDim, c.bg2).toFixed(2)}`);
    });

    test(`${key}: it is a ${mode} palette, and not the standard one`, () => {
      assert.equal(c.isDark, mode === 'dark');
      assert.notEqual(c.bg, std.bg);
      assert.notEqual(c.navy, std.navy);
      assert.equal(c.blurTint, mode === 'dark' ? 'dark' : 'light');
      if (mode === 'dark') assert.ok(luminance(c.bg) < 0.05, `the dark page is too bright: ${c.bg}`);
      else assert.ok(luminance(c.bg) > 0.8, `the light page is too dark: ${c.bg}`);
    });

    test(`${key}: the colours that carry meaning are unchanged (practice, lessons, pieces, danger, success)`, () => {
      for (const name of ['accent', 'accent2', 'red', 'amber', 'gold', 'danger', 'success', 'practiceText', 'lessonText', 'practiceBg', 'lessonBg', 'heatTop', 'glowPractice', 'glowLesson']) {
        assert.equal(c[name], std[name], name);
      }
    });

    test(`${key}: the helpers give a colour for any alpha, in this scheme's own colour`, () => {
      for (const fn of ['w', 'navyA', 'steelA', 'shadow', 'heat', 'heatLesson']) {
        assert.match(c[fn](0.3), /^rgba\(\d+,\d+,\d+,[\d.]+\)$/, fn);
      }
      assert.notEqual(c.navyA(0.2), std.navyA(0.2));
    });

    test(`${key}: a status's text is readable on its tile (at least 4.5:1)`, () => {
      applyTheme(key);
      const page = parse(COLOURS.bg);
      for (const s of Object.keys(STATUS_COLOURS)) {
        const sc = STATUS_COLOURS[s];
        const [r, g, b, a] = parse(sc.bg);
        const tile = [r, g, b].map((v, i) => v * a + page[i] * (1 - a));
        const hex = rgb => `#${rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
        const ratio = contrast(hex(parse(sc.text).slice(0, 3)), hex(tile));
        assert.ok(ratio >= 4.5, `${key} "${s}": ${ratio.toFixed(2)}:1`);
      }
      applyTheme('light');
    });
  }
}

test('the schemes look different from one another', () => {
  for (const mode of ['light', 'dark']) {
    const navies = ['standard', ...SCHEME_KEYS].map(k => THEMES[themeKey(k, mode)].colours.navy);
    assert.equal(new Set(navies).size, navies.length, `${mode} base colours: ${navies.join(', ')}`);
    const pages = ['standard', ...SCHEME_KEYS].map(k => THEMES[themeKey(k, mode)].colours.bg);
    assert.equal(new Set(pages).size, pages.length, `${mode} pages: ${pages.join(', ')}`);
  }
});

test('applying a scheme changes the colours, and going back to the standard one leaves nothing behind', () => {
  applyTheme('light');
  const before = { ...COLOURS };
  applyTheme('forest-dark');
  assert.equal(COLOURS.__theme, 'forest-dark');
  assert.equal(COLOURS.isDark, true);
  assert.equal(COLOURS.bg, THEMES['forest-dark'].colours.bg);
  assert.equal(COLOURS.accent, THEMES.dark.colours.accent, 'practice is still the dark burgundy-rose');
  applyTheme('light');
  for (const k of ['bg', 'navy', 'steel', 'text', 'textDim', 'isDark', 'float', 'sheet', 'onNavy', '__theme']) assert.equal(COLOURS[k], before[k], k);
  assert.equal(COLOURS.navyA(0.5), before.navyA(0.5));
});

test('an unknown theme falls back to the standard light one', () => {
  assert.equal(applyTheme('not-a-theme'), 'light');
  assert.equal(COLOURS.bg, THEMES.light.colours.bg);
});

test('the status colours follow the mode of a scheme, not just the two standard themes', () => {
  applyTheme('indigo-dark');
  const dark = STATUS_COLOURS.learning.bg;
  applyTheme('indigo-light');
  const light = STATUS_COLOURS.learning.bg;
  assert.notEqual(dark, light);
  applyTheme('light');
});
