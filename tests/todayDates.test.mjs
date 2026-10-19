// Tests for relative dates and the today summary (relativeDay, todaySummary in src/utils/planning.js).  Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '../src/utils/planning.js'), 'utf8');
const { relativeDay, todaySummary } =
  await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

const TODAY = '2026-10-15';

test('today, yesterday, then days', () => {
  assert.equal(relativeDay('2026-10-15', TODAY), 'Today');
  assert.equal(relativeDay('2026-10-14', TODAY), 'Yesterday');
  assert.equal(relativeDay('2026-10-13', TODAY), '2 days ago');
  assert.equal(relativeDay('2026-10-09', TODAY), '6 days ago');
});

test('then whole weeks, up to eight', () => {
  assert.equal(relativeDay('2026-10-08', TODAY), '1 week ago');   // 7 days
  assert.equal(relativeDay('2026-10-02', TODAY), '1 week ago');   // 13 days
  assert.equal(relativeDay('2026-10-01', TODAY), '2 weeks ago');  // 14 days
  assert.equal(relativeDay('2026-08-21', TODAY), '7 weeks ago');  // 55 days
});

test('past eight weeks, and in the future, the date is the better label', () => {
  assert.equal(relativeDay('2026-08-20', TODAY), null);           // 56 days
  assert.equal(relativeDay('2025-01-01', TODAY), null);
  assert.equal(relativeDay('2026-10-16', TODAY), null);
});

test('it counts calendar days, across a clock change and a month end', () => {
  assert.equal(relativeDay('2026-10-24', '2026-10-26'), '2 days ago');   // UK clocks go back on 25 Oct 2026
  assert.equal(relativeDay('2026-09-30', '2026-10-02'), '2 days ago');
});

test('missing dates are safe', () => {
  assert.equal(relativeDay(undefined, TODAY), null);
  assert.equal(relativeDay('2026-10-14', undefined), null);
  assert.equal(relativeDay('', ''), null);
});

test('today summary: one practice, several, lessons, and nothing', () => {
  assert.equal(todaySummary([{ duration: 25 }], []), 'Practised 25 min');
  assert.equal(todaySummary([{ duration: 25 }, { duration: 45 }], []), '2 practices, 1h 10m');
  assert.equal(todaySummary([{ duration: 60 }], []), 'Practised 1h');
  assert.equal(todaySummary([], [{}]), '1 lesson');
  assert.equal(todaySummary([], [{}, {}]), '2 lessons');
  assert.equal(todaySummary([{ duration: 30 }], [{}]), 'Practised 30 min  \u00b7  1 lesson');
  assert.equal(todaySummary([], []), '');
  assert.equal(todaySummary(undefined, undefined), '');
});

test('a practice with no duration still reads sensibly', () => {
  assert.equal(todaySummary([{}], []), 'Practised');
  assert.equal(todaySummary([{}, { duration: 20 }], []), '2 practices, 20 min');
});
