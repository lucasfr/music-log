// Tests for the page colours behind the app (src/utils/pageChrome.js).  Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const read = p => readFileSync(join(root, p), 'utf8');
const { pageChrome, applyPageChrome, BAND_ID, BAND_CSS } =
  await import('data:text/javascript;base64,' + Buffer.from(read('src/utils/pageChrome.js')).toString('base64'));

const LIGHT = { bg: '#EBF4F6', navy: '#09637E', isDark: false };
const DARK = { bg: '#0A1418', navy: '#2A8CA5', isDark: true };

test('the page, the theme colour and the notch all follow a dark theme', () => {
  assert.deepEqual(pageChrome(DARK), { page: '#0A1418', themeColor: '#0A1418', band: '#0A1418', scheme: 'dark' });
});

test('on the light theme the strip behind the status bar is dark, because its text is always white', () => {
  assert.deepEqual(pageChrome(LIGHT), { page: '#EBF4F6', themeColor: '#EBF4F6', band: '#09637E', scheme: 'light' });
});

test('applying the colours is a safe no-op where there is no DOM (the native app)', () => {
  assert.equal(typeof document, 'undefined');
  assert.doesNotThrow(() => applyPageChrome(DARK));
});

test('the strip is as tall as the notch, ignores taps and sits above everything', () => {
  assert.match(BAND_CSS, /height:env\(safe-area-inset-top/);
  assert.match(BAND_CSS, /pointer-events:none/);
  assert.match(BAND_CSS, /position:fixed/);
  assert.equal(BAND_ID, 'status-bar-band');
});

// ── The page has to be right before the app loads, so patch-dist.js repeats these values ──────

const theme = read('src/theme/index.js');
const patch = read('patch-dist.js');
const colourIn = (src, startMarker, key) => new RegExp(`${startMarker}[\\s\\S]*?\\b${key}:\\s*'(#[0-9A-Fa-f]{6})'`).exec(src)[1];

test('patch-dist.js uses the same light and dark page colours as the theme', () => {
  const lightBg = colourIn(theme, 'export const COLOURS = \\{', 'bg');
  const darkBg = colourIn(theme, 'const DARK = \\{', 'bg');
  assert.ok(patch.includes(lightBg), `patch-dist.js is missing the light background ${lightBg}`);
  assert.ok(patch.includes(darkBg), `patch-dist.js is missing the dark background ${darkBg}`);
});

test('patch-dist.js uses the theme\'s light-theme navy for the strip, and the translucent status bar', () => {
  const navy = colourIn(theme, 'export const COLOURS = \\{', 'navy');
  assert.ok(patch.includes(navy), `patch-dist.js is missing the light navy ${navy}`);
  assert.match(patch, /apple-mobile-web-app-status-bar-style" content="black-translucent"/);
});

test('patch-dist.js builds the same strip the app does', () => {
  assert.ok(patch.includes(BAND_ID));
  assert.ok(patch.includes(BAND_CSS), 'the strip CSS in patch-dist.js has drifted from BAND_CSS');
});
