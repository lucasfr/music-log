// Tests for the calculations behind the Stats screen (src/utils/statsCalc.js).  Run with: npm test
//
// The clock-change tests below only mean something in a timezone that has daylight saving, and a
// developer's machine might be on UTC. So this file sets its own timezone first (each test file runs
// in its own process, so it doesn't affect any other). UK clocks went forward on 2026-03-29 and go
// back on 2026-10-25.
process.env.TZ = 'Europe/London';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '../src/utils/statsCalc.js'), 'utf8');
const {
  addDays, daysBetween, periodCutoff, inPeriod, isoWeek,
  volumeBuckets, trendBuckets, dayOfWeekBuckets,
  streakRuns, topStreaks, longestStreak,
  periodAverages, daysSinceLatest,
  neglectedPieces, pieceStats, lessonInsights,
} = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

const S = (date, extra = {}) => ({ id: date, date, duration: 20, energy: 1, segments: [], ...extra });
const TODAY = '2026-10-19';

test('this file really is running with daylight saving (otherwise the clock-change tests prove nothing)', () => {
  const march28 = new Date('2026-03-28T12:00:00');
  const march29 = new Date('2026-03-29T12:00:00');
  assert.equal((march29 - march28) / 3600000, 23, 'the day the clocks go forward has 23 hours');
});

// ── dates ───────────────────────────────────────────────────────────────────────────────────

test('addDays crosses months, years and a leap day, and goes backwards', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2027-02-28', 1), '2027-03-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2026-10-19', 0), '2026-10-19');
});

test('addDays steps one calendar day across both clock changes', () => {
  assert.equal(addDays('2026-03-28', 1), '2026-03-29');
  assert.equal(addDays('2026-03-29', 1), '2026-03-30');
  assert.equal(addDays('2026-10-24', 1), '2026-10-25');
  assert.equal(addDays('2026-10-25', 1), '2026-10-26');
  let d = '2026-03-25';
  for (let i = 0; i < 10; i++) d = addDays(d, 1);
  assert.equal(d, '2026-04-04');
});

test('daysBetween counts calendar days, including across clock changes, and can be negative', () => {
  assert.equal(daysBetween('2026-10-12', '2026-10-19'), 7);
  assert.equal(daysBetween('2026-03-28', '2026-04-04'), 7, 'the spring change made this 6.96 days of milliseconds');
  assert.equal(daysBetween('2026-10-20', '2026-11-03'), 14);
  assert.equal(daysBetween('2026-10-19', '2026-10-19'), 0);
  assert.equal(daysBetween('2026-10-19', '2026-10-12'), -7);
  assert.equal(daysBetween('2025-12-31', '2026-01-01'), 1);
});

test('ISO weeks: weeks run Monday to Sunday and week 1 holds the first Thursday', () => {
  assert.equal(isoWeek('2026-01-01'), '2026-W01');   // a Thursday
  assert.equal(isoWeek('2025-12-29'), '2026-W01');   // the Monday of that week, still in 2025
  assert.equal(isoWeek('2025-12-28'), '2025-W52');   // the Sunday before
  assert.equal(isoWeek('2020-12-31'), '2020-W53');
  assert.equal(isoWeek('2021-01-03'), '2020-W53');   // a Sunday in January that belongs to last year's last week
  assert.equal(isoWeek('2021-01-04'), '2021-W01');
  assert.equal(isoWeek('2027-01-01'), '2026-W53');   // 2026 has 53 weeks
  assert.equal(isoWeek('2027-01-04'), '2027-W01');
});

test('ISO weeks are right in every year from 2015 to 2040 (the original was wrong in 2016, 2021, 2027 and 2038)', () => {
  // Three facts that hold by definition, so they don't depend on trusting any implementation:
  //  - 4 January is always in week 1 (week 1 is the one with the first Thursday, and that is within 1-7 Jan);
  //  - all seven days Monday to Sunday share a week;
  //  - the next Monday is the next week, or week 1 of the next year.
  const bad = [];
  for (let year = 2015; year <= 2040; year++) {
    if (isoWeek(`${year}-01-04`) !== `${year}-W01`) bad.push(`${year}-01-04 is ${isoWeek(`${year}-01-04`)}`);
    let monday = addDays(`${year}-01-04`, -(((new Date(`${year}-01-04T12:00:00`).getDay() + 6) % 7)));   // the Monday of week 1
    assert.equal(isoWeek(monday), `${year}-W01`, `${monday} should start week 1 of ${year}`);
    let week = 1;
    for (;;) {
      const key = isoWeek(monday);
      for (let i = 1; i < 7; i++) if (isoWeek(addDays(monday, i)) !== key) bad.push(`${monday}+${i} breaks week ${key}`);
      const next = isoWeek(addDays(monday, 7));
      if (next === `${year + 1}-W01`) { assert.ok(week === 52 || week === 53, `${year} has ${week} weeks`); break; }
      week++;
      if (next !== `${year}-W${String(week).padStart(2, '0')}`) { bad.push(`after ${key} came ${next}`); break; }
      monday = addDays(monday, 7);
    }
  }
  assert.deepEqual(bad, []);
});

test('every day of one week has the same ISO week, including over a clock change', () => {
  // Monday 2026-03-23 to Sunday 2026-03-29 (the day the clocks went forward)
  const week = ['2026-03-23', '2026-03-24', '2026-03-25', '2026-03-26', '2026-03-27', '2026-03-28', '2026-03-29'].map(isoWeek);
  assert.equal(new Set(week).size, 1);
  assert.equal(isoWeek('2026-03-30'), `2026-W${String(Number(week[0].slice(-2)) + 1).padStart(2, '0')}`);
  const oct = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'].map(isoWeek);
  assert.equal(new Set(oct).size, 1);
});

// ── periods ─────────────────────────────────────────────────────────────────────────────────

test('the period cutoff is that many calendar days back; all time has none', () => {
  assert.equal(periodCutoff('7d', TODAY), '2026-10-12');
  assert.equal(periodCutoff('30d', TODAY), '2026-09-19');
  assert.equal(periodCutoff('all', TODAY), null);
});

test('a record on the cutoff date is inside the period, one the day before is not, whatever the time', () => {
  // The tiles used to compare against "now", so a session from exactly 7 days ago dropped out after noon.
  const items = [S('2026-10-11'), S('2026-10-12'), S('2026-10-19')];
  assert.deepEqual(inPeriod(items, '7d', TODAY).map(s => s.date), ['2026-10-12', '2026-10-19']);
  assert.equal(inPeriod(items, 'all', TODAY).length, 3);
  assert.deepEqual(inPeriod(undefined, '7d', TODAY), []);
});

// ── charts ──────────────────────────────────────────────────────────────────────────────────

test('the 7-day volume view shows today and the six days before, with zeros for days off', () => {
  const sessions = [S('2026-10-19', { duration: 30 }), S('2026-10-19', { duration: 15 }), S('2026-10-17', { duration: 20 })];
  const { visible, mins } = volumeBuckets(sessions, '7d', TODAY);
  assert.deepEqual(visible, ['2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19']);
  assert.deepEqual(mins, [0, 0, 0, 0, 20, 0, 45]);
});

test('the 7-day view lists seven days across a clock change, not six or eight', () => {
  const { visible } = volumeBuckets([], '7d', '2026-03-31');
  assert.deepEqual(visible, ['2026-03-25', '2026-03-26', '2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30', '2026-03-31']);
});

test('the 30-day volume view sums by ISO week and ignores sessions before the cutoff', () => {
  const sessions = [S('2026-10-19', { duration: 10 }), S('2026-10-20', { duration: 5 }), S('2026-10-14', { duration: 40 }), S('2026-08-01', { duration: 99 })];
  const { visible, mins } = volumeBuckets(sessions, '30d', '2026-10-20');
  assert.deepEqual(visible, [isoWeek('2026-10-14'), isoWeek('2026-10-19')]);
  assert.deepEqual(mins, [40, 15]);
});

test('weekly views keep the last 12 weeks, all time keeps them all', () => {
  const sessions = Array.from({ length: 20 }, (_, i) => S(addDays('2026-01-05', i * 7), { duration: 10 }));
  assert.equal(volumeBuckets(sessions, 'all', '2026-12-31').visible.length, 20);
  assert.equal(volumeBuckets(sessions, '30d', addDays('2026-01-05', 19 * 7)).visible.length <= 12, true);
  const wide = volumeBuckets(sessions, 'all', '2026-12-31');
  assert.equal(wide.mins.every(m => m === 10), true);
});

test('a missing or non-numeric duration counts as zero rather than breaking the total', () => {
  const sessions = [S('2026-10-19', { duration: 'abc' }), S('2026-10-19', { duration: null }), S('2026-10-19', { duration: '25' })];
  assert.deepEqual(volumeBuckets(sessions, '7d', TODAY).mins.at(-1), 25);
});

test('the trend averages energy and liking per bucket; empty buckets are gaps, not zeros', () => {
  const sessions = [
    S('2026-10-19', { energy: 2, segments: [{ type: 'repertoire', liking: 4 }, { type: 'repertoire', liking: 2 }, { type: 'technique', liking: 5 }] }),
    S('2026-10-19', { energy: 0 }),
    S('2026-10-17', { energy: null, segments: [] }),
  ];
  const t = trendBuckets(sessions, '7d', TODAY);
  const today = t.visible.indexOf('2026-10-19');
  assert.equal(t.energyPts[today], 1, 'the average of 2 and 0; an energy of 0 is a real value');
  assert.equal(t.likingPts[today], 3, 'technique segments are not pieces');
  assert.equal(t.energyPts[t.visible.indexOf('2026-10-17')], null);
  assert.equal(t.energyPts[t.visible.indexOf('2026-10-15')], null);
  assert.equal(t.hasData, true);
});

test('with nothing to plot the trend says so', () => {
  assert.equal(trendBuckets([], '7d', TODAY).hasData, false);
  assert.equal(trendBuckets([S('2026-10-19', { energy: null })], '7d', TODAY).hasData, false);
});

test('weekday buckets start on Monday and report the busiest day (the first, on a tie)', () => {
  // 2026-10-19 is a Monday, 2026-10-25 a Sunday
  const sessions = [S('2026-10-19'), S('2026-10-25'), S('2026-10-25', { energy: -1 }), S('2026-10-21')];
  const { byDay, maxCount, bestDay } = dayOfWeekBuckets(sessions);
  assert.deepEqual(byDay.map(d => d.count), [1, 0, 1, 0, 0, 0, 2]);
  assert.equal(maxCount, 2);
  assert.equal(bestDay, 6);
  assert.deepEqual(byDay[6].energy, [1, -1]);
  assert.equal(byDay[6].minutes, 40);
  assert.equal(dayOfWeekBuckets([S('2026-10-19'), S('2026-10-20')]).bestDay, 0, 'first of equals');
  assert.deepEqual([dayOfWeekBuckets([]).maxCount, dayOfWeekBuckets([]).bestDay], [1, 0]);
});

// ── streaks ─────────────────────────────────────────────────────────────────────────────────

test('runs of consecutive days are found, single days are not runs, and order and repeats do not matter', () => {
  const sessions = ['2026-10-05', '2026-10-03', '2026-10-04', '2026-10-04', '2026-10-10', '2026-10-17', '2026-10-18'].map(d => S(d));
  assert.deepEqual(streakRuns(sessions), [
    { start: '2026-10-03', end: '2026-10-05', len: 3 },
    { start: '2026-10-17', end: '2026-10-18', len: 2 },
  ]);
  assert.deepEqual(streakRuns([]), []);
  assert.deepEqual(streakRuns([S('2026-10-01')]), []);
});

test('a streak runs across the day the clocks go forward (it used to be split in two)', () => {
  const sessions = ['2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30', '2026-03-31'].map(d => S(d));
  assert.deepEqual(streakRuns(sessions), [{ start: '2026-03-27', end: '2026-03-31', len: 5 }]);
});

test('a streak runs across the day the clocks go back (it used to be split in two)', () => {
  const sessions = ['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27'].map(d => S(d));
  assert.deepEqual(streakRuns(sessions), [{ start: '2026-10-23', end: '2026-10-27', len: 5 }]);
});

test('a streak runs across a month and a year end', () => {
  assert.deepEqual(streakRuns(['2026-12-30', '2026-12-31', '2027-01-01'].map(d => S(d))), [{ start: '2026-12-30', end: '2027-01-01', len: 3 }]);
  assert.deepEqual(streakRuns(['2028-02-28', '2028-02-29', '2028-03-01'].map(d => S(d))), [{ start: '2028-02-28', end: '2028-03-01', len: 3 }]);
});

test('the longest runs come first, equal ones oldest first, and the longest length is from all runs', () => {
  const runs = [
    { start: 'a', end: 'a', len: 2 }, { start: 'b', end: 'b', len: 5 }, { start: 'c', end: 'c', len: 2 }, { start: 'd', end: 'd', len: 3 },
  ];
  const { top, maxLen } = topStreaks(runs, 3);
  assert.deepEqual(top.map(r => r.start), ['b', 'd', 'a']);
  assert.equal(maxLen, 5);
  assert.deepEqual(topStreaks([]), { top: [], maxLen: 0 });
  assert.equal(runs[0].start, 'a', 'the list passed in is not reordered');
});

test('the longest streak in a period includes today (all time used to miss a morning session)', () => {
  const sessions = ['2026-10-17', '2026-10-18', '2026-10-19'].map(d => S(d));
  assert.equal(longestStreak(sessions, 'all', TODAY), 3);
  assert.equal(longestStreak(sessions, '30d', TODAY), 3);
  assert.equal(longestStreak(sessions, '7d', TODAY), 3);
});

test('the longest streak is the longest run, not the latest, and gaps reset it', () => {
  const sessions = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-10', '2026-10-11'].map(d => S(d));
  assert.equal(longestStreak(sessions, 'all', TODAY), 4);
  assert.equal(longestStreak([], 'all', TODAY), 0);
  assert.equal(longestStreak([S('2026-10-19')], 'all', TODAY), 1);
});

test('the longest streak ignores sessions dated after today and counts across a clock change', () => {
  assert.equal(longestStreak(['2026-10-20', '2026-10-21', '2026-10-22'].map(d => S(d)), 'all', TODAY), 0);
  assert.equal(longestStreak(['2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30'].map(d => S(d)), 'all', '2026-04-02'), 4);
});

test('the period start for a streak is inclusive', () => {
  // 7d starts on 2026-10-12: a run beginning that day is counted from the day itself
  const sessions = ['2026-10-12', '2026-10-13', '2026-10-14'].map(d => S(d));
  assert.equal(longestStreak(sessions, '7d', TODAY), 3);
});

// ── summary numbers ─────────────────────────────────────────────────────────────────────────

test('average energy leaves out sessions with none logged instead of counting them as neutral', () => {
  const sessions = [S('a', { energy: 2 }), S('b', { energy: 2 }), S('c', { energy: null }), S('d', { energy: undefined })];
  assert.equal(periodAverages(sessions).avgEnergy, 2);
});

test('an energy of zero is a real value, and with none at all the average is null', () => {
  assert.equal(periodAverages([S('a', { energy: 0 }), S('b', { energy: 2 })]).avgEnergy, 1);
  assert.equal(periodAverages([S('a', { energy: null })]).avgEnergy, null);
  assert.deepEqual(periodAverages([]), { totalMin: 0, avgEnergy: null, avgEnjoyment: null });
});

test('enjoyment and total minutes', () => {
  const r = periodAverages([S('a', { enjoyment: 4, duration: 30 }), S('b', { enjoyment: 2, duration: '15' }), S('c', { enjoyment: null, duration: 'x' })]);
  assert.equal(r.avgEnjoyment, 3);
  assert.equal(r.totalMin, 45);
});

test('days since the latest record counts calendar days, across the spring clock change', () => {
  assert.equal(daysSinceLatest([S('2026-03-28')], '2026-04-04'), 7, 'it used to say 6');
  assert.equal(daysSinceLatest([S('2026-10-19')], TODAY), 0);
  assert.equal(daysSinceLatest([S('2026-10-01'), S('2026-10-17'), S('2026-10-05')], TODAY), 2, 'the latest, whatever the order');
  assert.equal(daysSinceLatest([], TODAY), null);
  assert.equal(daysSinceLatest([{ id: 'x' }], TODAY), null);
});

// ── pieces ──────────────────────────────────────────────────────────────────────────────────

const comp = (id, status, title = `Piece ${id}`) => ({ id, title, status });
const seg = (compositionId, extra = {}) => ({ type: 'repertoire', compositionId, ...extra });

test('only learning and consolidating pieces can be neglected, and 7 days is the line', () => {
  const comps = [comp('a', 'learning'), comp('b', 'consolidating'), comp('c', 'performance-ready'), comp('d', 'shelved'), comp('e', 'new')];
  const sessions = [
    S('2026-10-13', { segments: [seg('a')] }),   // 6 days
    S('2026-10-12', { segments: [seg('b')] }),   // 7 days
    S('2026-08-01', { segments: [seg('c'), seg('d'), seg('e')] }),
  ];
  assert.deepEqual(neglectedPieces(sessions, comps, TODAY).map(p => [p.id, p.daysSince]), [['b', 7]]);
  assert.deepEqual(neglectedPieces(sessions, comps, TODAY, 6).map(p => p.id), ['b', 'a'], 'the line is a parameter, longest first');
});

test('a piece last practised exactly a week ago is listed at any time of day (it used to depend on opening the app after noon)', () => {
  const out = neglectedPieces([S('2026-10-12', { segments: [seg('a')] })], [comp('a', 'learning')], TODAY);
  assert.equal(out.length, 1);
  assert.equal(out[0].daysSince, 7);
});

test('never-practised pieces come first, then the longest neglected', () => {
  const comps = [comp('a', 'learning'), comp('b', 'learning'), comp('c', 'consolidating')];
  const sessions = [S('2026-10-01', { segments: [seg('a')] }), S('2026-09-01', { segments: [seg('b')] })];
  assert.deepEqual(neglectedPieces(sessions, comps, TODAY).map(p => p.id), ['c', 'b', 'a']);
  assert.equal(neglectedPieces(sessions, comps, TODAY)[0].daysSince, null);
});

test('a technique segment linked to a piece counts as working on it, and the latest date wins', () => {
  const sessions = [
    S('2026-08-01', { segments: [seg('a')] }),
    S('2026-10-18', { segments: [{ type: 'technique', compositionId: 'a' }] }),
  ];
  assert.deepEqual(neglectedPieces(sessions, [comp('a', 'learning')], TODAY), []);
});

test('days neglected are right across the spring clock change', () => {
  const out = neglectedPieces([S('2026-03-28', { segments: [seg('a')] })], [comp('a', 'learning')], '2026-04-04');
  assert.equal(out[0].daysSince, 7, 'it used to say 6');
});

test('the top pieces by count and by time, skipping ambitions, with averages that are null when empty', () => {
  const comps = [comp('a', 'learning', 'Alpha'), comp('b', 'learning', 'Beta'), comp('z', 'ambition', 'Dream')];
  const sessions = [
    S('d1', { energy: 2, enjoyment: 4, segments: [seg('a', { duration: 10, liking: 4, feltDifficulty: 3 }), seg('b', { duration: 40 }), seg('z', { duration: 99 })] }),
    S('d2', { energy: 0, enjoyment: null, segments: [seg('a', { duration: 10, liking: 2 }), { type: 'repertoire', title: 'Free piece', duration: 5 }, { type: 'technique', duration: 50 }] }),
  ];
  const { byCount, byTime } = pieceStats(sessions, comps);
  assert.deepEqual(byCount.map(p => [p.name, p.count]), [['Alpha', 2], ['Beta', 1], ['Free piece', 1]]);
  assert.deepEqual(byTime.map(p => [p.name, p.mins]), [['Beta', 40], ['Alpha', 20], ['Free piece', 5]]);
  const alpha = byCount[0];
  assert.equal(alpha.avgLiking, 3);
  assert.equal(alpha.avgEnergy, 1);
  assert.equal(alpha.avgSessionEnjoyment, 4, 'only the session that has one');
  assert.equal(alpha.avgDifficulty, 3);
  assert.equal(byCount[1].avgLiking, null);
  assert.equal(byCount[1].avgDifficulty, null);
});

test('a segment with no piece and no title is skipped, an unknown library id is shown as its id, and only five are kept', () => {
  const six = Array.from({ length: 7 }, (_, i) => seg(`p${i}`, { duration: 10 + i }));
  const out = pieceStats([S('d', { segments: [{ type: 'repertoire' }, seg('ghost', { duration: 1 }), ...six] })], []);
  assert.equal(out.byCount.length, 5);
  assert.equal(out.byTime.length, 5);
  assert.equal(pieceStats([S('d', { segments: [{ type: 'repertoire' }] })], []).byCount.length, 0);
  assert.equal(pieceStats([S('d', { segments: [seg('ghost')] })], []).byCount[0].name, 'ghost');
});

test('equal counts keep the order they were first seen', () => {
  const sessions = [S('d', { segments: [seg('b'), seg('a'), seg('c')] })];
  assert.deepEqual(pieceStats(sessions, [comp('a', 'learning', 'A'), comp('b', 'learning', 'B'), comp('c', 'learning', 'C')]).byCount.map(p => p.name), ['B', 'A', 'C']);
});

// ── lessons ─────────────────────────────────────────────────────────────────────────────────

const lesson = (date, extra = {}) => ({ id: date, date, segments: [], ...extra });

test('lesson insights use the lessons in the period and average only the ratings that exist', () => {
  const lessons = [
    lesson('2026-10-15', { energy: 2, enjoyment: 5 }),
    lesson('2026-10-12', { energy: 0, enjoyment: null }),        // exactly 7 days back: inside
    lesson('2026-10-11', { energy: -2, enjoyment: 1 }),          // outside a 7-day period
    lesson('2026-10-10', { energy: null, enjoyment: 3 }),
  ];
  const r = lessonInsights(lessons, [], [], '7d', TODAY);
  assert.equal(r.count, 2);
  assert.equal(r.avgEnergy, 1);
  assert.equal(r.avgEnjoyment, 5);
  assert.equal(lessonInsights(lessons, [], [], 'all', TODAY).count, 4);
});

test('with no lessons there is nothing, and the averages are null', () => {
  const r = lessonInsights([], [], [], '30d', TODAY);
  assert.deepEqual([r.count, r.avgEnergy, r.avgEnjoyment, r.topPieces, r.lessonOnly, r.maxCount], [0, null, null, [], [], 1]);
});

test('the pieces that come up most in lessons, with titles, and their top count', () => {
  const lessons = [
    lesson('2026-10-15', { segments: [seg('a'), seg('b'), { type: 'technique', compositionId: 'c' }, { type: 'repertoire' }] }),
    lesson('2026-10-16', { segments: [seg('a')] }),
  ];
  const r = lessonInsights(lessons, [], [comp('a', 'learning', 'Alpha')], '30d', TODAY);
  assert.deepEqual(r.topPieces, [{ id: 'a', title: 'Alpha', count: 2 }, { id: 'b', title: 'b', count: 1 }]);
  assert.equal(r.maxCount, 2);
});

test('pieces that were in a lesson but never in a practice session are listed A to Z', () => {
  const lessons = [lesson('2026-10-15', { segments: [seg('z'), seg('m'), seg('done')] })];
  const sessions = [S('2026-10-16', { segments: [seg('done')] }), S('2026-10-17', { segments: [{ type: 'technique', compositionId: 'm' }] })];
  const comps = [comp('z', 'new', 'Zebra'), comp('m', 'new', 'Mango'), comp('done', 'new', 'Done')];
  assert.deepEqual(lessonInsights(lessons, sessions, comps, '30d', TODAY).lessonOnly.map(p => p.title), ['Mango', 'Zebra'],
    'a technique segment linked to the piece does not count as practising it as repertoire');
});
