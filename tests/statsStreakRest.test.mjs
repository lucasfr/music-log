import test from 'node:test';
import assert from 'node:assert/strict';
import { streakRuns, longestStreak, topStreaks, weekdayOf, addDays } from '../src/utils/statsCalc.js';
import { currentStreak } from '../src/utils/progress.js';

const S = (...dates) => dates.map(date => ({ date, duration: 20 }));
const SUN = 0, SAT = 6;

test('weekdayOf matches the calendar: 2026-11-01 is a Sunday, 2026-10-26 a Monday', () => {
  assert.equal(weekdayOf('2026-11-01'), 0);
  assert.equal(weekdayOf('2026-10-26'), 1);
  assert.equal(weekdayOf('2026-10-31'), 6);
  assert.equal(weekdayOf('2024-02-29'), 4);
});

test('without rest days both functions behave exactly as before', () => {
  assert.deepEqual(streakRuns(S('2026-10-29', '2026-10-30', '2026-11-01', '2026-11-02')), [
    { start: '2026-10-29', end: '2026-10-30', len: 2 }, { start: '2026-11-01', end: '2026-11-02', len: 2 },
  ]);
  assert.equal(longestStreak(S('2026-10-30', '2026-10-31', '2026-11-02'), '30d', '2026-11-02'), 2);
});

test('a rest day between two practice days joins them, and is not counted', () => {
  // Sat 31, (Sun 1 rest), Mon 2
  const runs = streakRuns(S('2026-10-30', '2026-10-31', '2026-11-02'), [SUN]);
  assert.deepEqual(runs, [{ start: '2026-10-30', end: '2026-11-02', len: 3 }]);
});

test('a rest day that was practised on counts as a day', () => {
  const runs = streakRuns(S('2026-10-31', '2026-11-01', '2026-11-02'), [SUN]);
  assert.deepEqual(runs, [{ start: '2026-10-31', end: '2026-11-02', len: 3 }]);
});

test('a gap that includes a day that is not a rest day still splits the run', () => {
  // Sat 24, Sun 25 (rest), Mon 26 missed, Tue 27
  assert.deepEqual(streakRuns(S('2026-10-24', '2026-10-27'), [SUN]), []);
});

test('two rest days in a row bridge a gap', () => {
  assert.deepEqual(streakRuns(S('2026-10-30', '2026-11-02'), [SAT, SUN]), [{ start: '2026-10-30', end: '2026-11-02', len: 2 }]);
});

test('longestStreak: the same rules over a period', () => {
  const sessions = S('2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-02', '2026-11-03');
  assert.equal(longestStreak(sessions, '30d', '2026-11-03'), 4);            // Sunday splits it
  assert.equal(longestStreak(sessions, '30d', '2026-11-03', [SUN]), 6);     // Sunday off: one run of 6
});

test('longestStreak for all time starts at the first session, and a leading rest day cannot count', () => {
  assert.equal(longestStreak(S('2026-11-02'), 'all', '2026-11-02', [SUN]), 1);
  assert.equal(longestStreak([], 'all', '2026-11-02', [SUN]), 0);
});

test('across the clocks changing (UK, 25 Oct 2026), by calendar date', () => {
  const runs = streakRuns(S('2026-10-23', '2026-10-24', '2026-10-26'), [SUN]);   // Sun 25 is the 25-hour day, and a rest day
  assert.deepEqual(runs, [{ start: '2026-10-23', end: '2026-10-26', len: 3 }]);
});

test('topStreaks still ranks what streakRuns gives it', () => {
  const runs = streakRuns(S('2026-10-30', '2026-10-31', '2026-11-02', '2026-11-10', '2026-11-11'), [SUN]);
  const { top, maxLen } = topStreaks(runs);
  assert.equal(maxLen, 3);
  assert.equal(top[0].len, 3);
});

// Home's streak (currentStreak) and the Stats runs must agree, whatever the data and the rest days.
function rngOf(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

test('Home\'s streak equals the Stats run that ends at the latest practice, whenever that run is still alive', () => {
  const rng = rngOf(2026);
  for (let n = 0; n < 400; n++) {
    const today = addDays('2026-11-01', Math.floor(rng() * 30));
    const rest = [];
    for (let d = 0; d < 7; d++) if (rng() < 0.25 && rest.length < 4) rest.push(d);
    const dates = [];
    for (let k = 0; k < 60; k++) { const d = addDays(today, -k); if (rng() < 0.6) dates.push(d); }
    const sessions = S(...dates);
    const restSet = new Set(rest);
    const latest = [...dates].sort().pop();
    let expected = 0;
    if (latest) {
      let alive = true;
      for (let d = addDays(latest, 1); d < today; d = addDays(d, 1)) if (!restSet.has(weekdayOf(d))) { alive = false; break; }
      if (latest > today) alive = false;
      if (alive) {
        // the length of the chain ending at latest, counting practice days (a single day is a chain of 1)
        const runs = streakRuns(sessions, rest);
        const last = runs[runs.length - 1];
        expected = last && last.end === latest ? last.len : 1;
      }
    }
    assert.equal(currentStreak(sessions, today, rest), expected, `case ${n}: today ${today}, rest ${rest}, dates ${dates.sort().slice(-8)}`);
  }
});

test('longestStreak for "all" is never shorter than the longest run, and equals it when runs are 2 or more', () => {
  const rng = rngOf(7);
  for (let n = 0; n < 200; n++) {
    const today = '2026-11-01';
    const rest = rng() < 0.5 ? [SUN] : [];
    const dates = [];
    for (let k = 0; k < 90; k++) if (rng() < 0.55) dates.push(addDays(today, -k));
    const sessions = S(...dates);
    const runs = streakRuns(sessions, rest);
    const maxRun = runs.length ? Math.max(...runs.map(r => r.len)) : 0;
    const longest = longestStreak(sessions, 'all', today, rest);
    assert.ok(longest >= maxRun, `case ${n}`);
    if (maxRun >= 2) assert.equal(longest, maxRun, `case ${n}`);
  }
});
