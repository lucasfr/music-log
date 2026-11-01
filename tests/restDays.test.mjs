import test from 'node:test';
import assert from 'node:assert/strict';
import { currentStreak, parseRestDays, serializeRestDays, toggleRestDay, detectMilestones } from '../src/utils/progress.js';

// 2026-11-01 is a Sunday. Dates below are local 'YYYY-MM-DD'.
const S = (...dates) => dates.map(date => ({ date, duration: 20 }));
const SUN = 0, MON = 1, SAT = 6;

test('without rest days it is the plain consecutive count, as before', () => {
  assert.equal(currentStreak(S('2026-10-30', '2026-10-31', '2026-11-01'), '2026-11-01'), 3);
  assert.equal(currentStreak(S('2026-10-29', '2026-10-31'), '2026-11-01'), 1);   // 30th missed
  assert.equal(currentStreak([], '2026-11-01'), 0);
});

test('a rest day with nothing logged does not break the streak and does not add to it', () => {
  // Fri 30, Sat 31 practised; Sun 1 (rest) not; today is Mon 2 and not yet practised.
  const sessions = S('2026-10-30', '2026-10-31');
  assert.equal(currentStreak(sessions, '2026-11-02'), 0);                // a plain streak is broken by Sunday
  assert.equal(currentStreak(sessions, '2026-11-02', [SUN]), 2);         // with Sunday off it survives, at 2
});

test('a rest day that was practised on counts like any other day', () => {
  assert.equal(currentStreak(S('2026-10-31', '2026-11-01'), '2026-11-01', [SUN]), 2);
});

test('it still breaks on a day that is not a rest day', () => {
  // Thu 29 missed (not a rest day), Fri 30 and Sat 31 practised, Sun 1 rest.
  assert.equal(currentStreak(S('2026-10-28', '2026-10-30', '2026-10-31'), '2026-11-02', [SUN]), 2);
});

test('two rest days in a row are both skipped', () => {
  // Sat and Sun off; practised Thu 29 and Fri 30; today Mon 2 not yet.
  assert.equal(currentStreak(S('2026-10-29', '2026-10-30'), '2026-11-02', [SAT, SUN]), 2);
});

test('today being a rest day with nothing logged keeps yesterday\'s streak alive', () => {
  assert.equal(currentStreak(S('2026-10-30', '2026-10-31'), '2026-11-01', [SUN]), 2);
});

test('rest days with no sessions at all give 0, and cannot loop for ever', () => {
  assert.equal(currentStreak([], '2026-11-02', [SUN, MON]), 0);
  assert.equal(currentStreak([], '2026-11-02', [0, 1, 2, 3, 4, 5, 6]), 0);  // even unsanitised
});

test('a long run across several rest days keeps counting', () => {
  // Practised Mon-Sat for two weeks, Sundays off: 2026-10-19 (Mon) .. 2026-10-31 (Sat) without 25th.
  const days = [];
  for (let d = 19; d <= 31; d++) { if (d === 25) continue; days.push(`2026-10-${d}`); }
  assert.equal(days.length, 12);
  assert.equal(currentStreak(S(...days), '2026-11-01', [SUN]), 12);
});

test('it behaves across the clocks changing (UK, last Sunday of October)', () => {
  // 2026-10-25 is the day the UK clocks go back; Sundays off, so that day is a rest day.
  const sessions = S('2026-10-23', '2026-10-24', '2026-10-26', '2026-10-27');
  assert.equal(currentStreak(sessions, '2026-10-28', [SUN]), 4);
});

test('parseRestDays: lists, junk, duplicates, and all seven days', () => {
  assert.deepEqual(parseRestDays('[0,6]'), [0, 6]);
  assert.deepEqual(parseRestDays('[6,0,0,"3"]'), [0, 3, 6]);
  assert.deepEqual(parseRestDays('[9,-1,2.5,"x",null]'), []);
  assert.deepEqual(parseRestDays('not json'), []);
  assert.deepEqual(parseRestDays(''), []);
  assert.deepEqual(parseRestDays('{"a":1}'), []);
  assert.deepEqual(parseRestDays('[0,1,2,3,4,5,6]'), []);
  assert.deepEqual(parseRestDays('[0,1,2,3,4,5]'), [0, 1, 2, 3, 4, 5]);
});

test('serializeRestDays round-trips and cleans', () => {
  assert.equal(serializeRestDays([6, 0]), '[0,6]');
  assert.equal(serializeRestDays([]), '[]');
  assert.equal(serializeRestDays([0, 1, 2, 3, 4, 5, 6]), '[]');
});

test('toggleRestDay switches a day on and off, and refuses the seventh', () => {
  assert.deepEqual(toggleRestDay([], 0), [0]);
  assert.deepEqual(toggleRestDay([0], 6), [0, 6]);
  assert.deepEqual(toggleRestDay([0, 6], 0), [6]);
  assert.deepEqual(toggleRestDay([0, 1, 2, 3, 4, 5], 6), [0, 1, 2, 3, 4, 5]);
});

test('milestones use the rest days: crossing 7 with Sundays off still fires once', () => {
  // Practised Mon 26 .. Sat 31 (6 days), Sunday off; today Mon 2 Nov, practising now makes 7.
  const before = S('2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31');
  const after = [...before, { date: '2026-11-02', duration: 20 }];
  const withRest = detectMilestones({ sessions: before, lessons: [] }, { sessions: after, lessons: [] }, '2026-11-02', [SUN]);
  assert.ok(withRest.some(m => m.id === 'streak-7'));
  const without = detectMilestones({ sessions: before, lessons: [] }, { sessions: after, lessons: [] }, '2026-11-02');
  assert.ok(!without.some(m => m.id === 'streak-7'));
});
