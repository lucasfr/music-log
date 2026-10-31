import test from 'node:test';
import assert from 'node:assert/strict';
import { THEMES } from '../src/theme/index.js';

// WCAG relative luminance and contrast ratio for #rrggbb colours.
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

for (const key of Object.keys(THEMES)) {
  const c = THEMES[key].colours;

  test(`${key}: text on a navy fill is readable (at least 4.5:1)`, () => {
    assert.ok(contrast(c.onNavy, c.navy) >= 4.5, `${c.onNavy} on ${c.navy} is ${contrast(c.onNavy, c.navy).toFixed(2)}:1`);
  });

  test(`${key}: an icon on a steel fill is clear (at least 3:1)`, () => {
    assert.ok(contrast(c.onNavy, c.steel) >= 3, `${c.onNavy} on ${c.steel} is ${contrast(c.onNavy, c.steel).toFixed(2)}:1`);
  });

  test(`${key}: an icon on a success or danger fill is clear (at least 3:1)`, () => {
    for (const fill of ['success', 'danger']) {
      assert.ok(contrast(c.onNavy, c[fill]) >= 3, `${c.onNavy} on ${fill} ${c[fill]} is ${contrast(c.onNavy, c[fill]).toFixed(2)}:1`);
    }
  });

  test(`${key}: an icon on an amber fill is clear (at least 3:1)`, () => {
    assert.ok(contrast(c.onAmber, c.amber) >= 3, `${c.onAmber} on ${c.amber} is ${contrast(c.onAmber, c.amber).toFixed(2)}:1`);
  });

  test(`${key}: text on the toast ink fill is readable (at least 4.5:1)`, () => {
    assert.ok(contrast(c.onInk, c.ink) >= 4.5, `${c.onInk} on ${c.ink} is ${contrast(c.onInk, c.ink).toFixed(2)}:1`);
  });

  test(`${key}: an unfilled rating icon is visible but clearly lighter than a filled one`, () => {
    assert.ok(c.ratingEmpty >= 0.2 && c.ratingEmpty <= 0.5, `ratingEmpty is ${c.ratingEmpty}`);
  });

  test(`${key}: the challenge chip tint is defined`, () => {
    assert.match(c.challengeLight, /^rgba\(221,174,211,0\.\d+\)$/);
  });
}
