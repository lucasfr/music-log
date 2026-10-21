// The text and colour helpers behind the Start practice card on Home: tint and accentKey
// (src/utils/tint.js), planSummary and lastPracticedLine (src/utils/planning.js).
// Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const load = async file => import('data:text/javascript;base64,' + Buffer.from(readFileSync(join(here, '../src/utils', file), 'utf8')).toString('base64'));
const { tint, accentKey, TILE_ACCENTS } = await load('tint.js');
const { planSummary, lastPracticedLine } = await load('planning.js');

const TODAY = '2026-10-21';

// ── colour ──────────────────────────────────────────────────────────────────────────────────

test('a hex colour becomes the same colour at the alpha asked for', () => {
  assert.equal(tint('#088395', 0.22), 'rgba(8, 131, 149, 0.22)');
  assert.equal(tint('#FF9A33', 0.4), 'rgba(255, 154, 51, 0.4)');
  assert.equal(tint('#fff', 0.5), 'rgba(255, 255, 255, 0.5)', 'the short form');
  assert.equal(tint('#E0668F', 1), 'rgba(224, 102, 143, 1)');
});

test('the alpha is kept between 0 and 1', () => {
  assert.equal(tint('#000000', 3), 'rgba(0, 0, 0, 1)');
  assert.equal(tint('#000000', -1), 'rgba(0, 0, 0, 0)');
  assert.equal(tint('#000000', 0.12345), 'rgba(0, 0, 0, 0.123)');
});

test('a colour that is not a hex value is returned as it is', () => {
  assert.equal(tint('rgba(8,131,149,0.10)', 0.5), 'rgba(8,131,149,0.10)');
  assert.equal(tint('teal', 0.5), 'teal');
  assert.equal(tint('#12', 0.5), '#12');
  assert.equal(tint(undefined, 0.5), undefined);
});

test('the shortcut colours run teal, amber, rose, green, gold, and then start again', () => {
  assert.deepEqual(TILE_ACCENTS, ['steel', 'amber', 'red', 'success', 'gold']);
  assert.deepEqual([0, 1, 2, 3, 4].map(accentKey), ['steel', 'amber', 'red', 'success', 'gold']);
  assert.equal(accentKey(5), 'steel');
  assert.equal(accentKey(7), 'red');
  assert.equal(accentKey(-1), 'gold', 'never undefined, even for a bad index');
});

// ── what a plan will run ────────────────────────────────────────────────────────────────────

const plan = (...titles) => titles.map(title => ({ type: 'technique', title, plannedMinutes: 5 }));

test('a plan is summed up by its exercises and pieces, in order', () => {
  assert.equal(planSummary(plan('Hanon', 'Minuet in F', 'Ocean View')), 'Hanon · Minuet in F · Ocean View');
  assert.equal(planSummary(plan('Scales')), 'Scales');
});

test('only the first three are named, and the rest are counted', () => {
  assert.equal(planSummary(plan('A', 'B', 'C', 'D')), 'A · B · C +1');
  assert.equal(planSummary(plan('A', 'B', 'C', 'D', 'E', 'F')), 'A · B · C +3');
  assert.equal(planSummary(plan('A', 'B', 'C', 'D'), 2), 'A · B +2', 'or however many are asked for');
});

test('a title that appears twice is named once, and blank titles are left out', () => {
  assert.equal(planSummary(plan('Hanon', 'Hanon', 'Scales')), 'Hanon · Scales');
  assert.equal(planSummary(plan('Hanon', '', '  ', 'Scales')), 'Hanon · Scales');
  assert.equal(planSummary(plan('Hanon', 'Scales', 'Hanon', 'Minuet', 'Dream')), 'Hanon · Scales · Minuet +1');
});

test('nothing to name gives an empty line, and odd input does not throw', () => {
  assert.equal(planSummary([]), '');
  assert.equal(planSummary(undefined), '');
  assert.equal(planSummary(plan('', ' ')), '');
  assert.equal(planSummary([null, { title: 'Hanon' }, undefined]), 'Hanon');
  assert.equal(planSummary([{ title: 5 }]), '5');
});

// ── when you last practised ─────────────────────────────────────────────────────────────────

test('the line says how long ago, and for how long', () => {
  assert.equal(lastPracticedLine({ date: '2026-10-20', duration: 35 }, TODAY), 'Last practised yesterday · 35 min');
  assert.equal(lastPracticedLine({ date: '2026-10-18', duration: 20 }, TODAY), 'Last practised 3 days ago · 20 min');
  assert.equal(lastPracticedLine({ date: '2026-10-07', duration: 45 }, TODAY), 'Last practised 2 weeks ago · 45 min');
  assert.equal(lastPracticedLine({ date: '2026-10-14', duration: 10 }, TODAY), 'Last practised 1 week ago · 10 min');
});

test('practice today reads as it happened, not as last time', () => {
  assert.equal(lastPracticedLine({ date: TODAY, duration: 25 }, TODAY), 'Practised today · 25 min');
});

test('a session with no length leaves it out, and the minutes are rounded', () => {
  assert.equal(lastPracticedLine({ date: '2026-10-20' }, TODAY), 'Last practised yesterday');
  assert.equal(lastPracticedLine({ date: '2026-10-20', duration: 0 }, TODAY), 'Last practised yesterday');
  assert.equal(lastPracticedLine({ date: '2026-10-20', duration: '35' }, TODAY), 'Last practised yesterday · 35 min', 'typed as text');
  assert.equal(lastPracticedLine({ date: '2026-10-20', duration: 34.6 }, TODAY), 'Last practised yesterday · 35 min');
});

test('long ago, or dated in the future, still reads sensibly', () => {
  assert.equal(lastPracticedLine({ date: '2026-05-01', duration: 30 }, TODAY), 'Last practised a while ago · 30 min');
  assert.equal(lastPracticedLine({ date: '2026-11-30', duration: 30 }, TODAY), 'Last practised a while ago · 30 min');
});

test('with no session there is no line, so the card can say what it is for instead', () => {
  assert.equal(lastPracticedLine(null, TODAY), null);
  assert.equal(lastPracticedLine(undefined, TODAY), null);
  assert.equal(lastPracticedLine({ duration: 30 }, TODAY), null);
});
