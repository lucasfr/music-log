import test from 'node:test';
import assert from 'node:assert/strict';
import {
  spokenMinutes, volumeSummary, trendSummary, scatterSummary, librarySummary, monthName,
  dayOfWeekSummary, spokenKey, coverageSummary,
} from '../src/utils/chartSummaries.js';
import { COF_KEYS, COF_MINORS } from '../src/utils/scaleStats.js';

test('spokenMinutes: minutes, hours, singular and plural, junk', () => {
  assert.equal(spokenMinutes(45), '45 minutes');
  assert.equal(spokenMinutes(1), '1 minute');
  assert.equal(spokenMinutes(60), '1 hour');
  assert.equal(spokenMinutes(80), '1 hour 20 minutes');
  assert.equal(spokenMinutes(121), '2 hours 1 minute');
  assert.equal(spokenMinutes(0), '0 minutes');
  assert.equal(spokenMinutes(undefined), '0 minutes');
  assert.equal(spokenMinutes(-5), '0 minutes');
});

test('volumeSummary gives total, average per active bucket, peak and latest', () => {
  const s = volumeSummary({ mins: [0, 30, 60, 0, 90], period: '30d' });
  assert.match(s, /Practice time per week over 5 weeks/);
  assert.match(s, /Total 3 hours/);
  assert.match(s, /average 1 hour per active week/);
  assert.match(s, /Most in one week: 1 hour 30 minutes/);
  assert.match(s, /Latest week: 1 hour 30 minutes/);
});

test('volumeSummary: daily wording, an empty latest bucket, and nothing logged', () => {
  assert.match(volumeSummary({ mins: [20, 0], period: '7d' }), /per day over 2 days.*Latest day: none/);
  assert.match(volumeSummary({ mins: [1], period: '7d' }), /over 1 day\./);
  assert.equal(volumeSummary({ mins: [0, 0], period: '7d' }), 'Practice time per day: nothing logged yet.');
  assert.equal(volumeSummary({ mins: [], period: '30d' }), 'Practice time per week: nothing logged yet.');
});

test('trendSummary: averages, latest, and direction for both series; gaps ignored', () => {
  const s = trendSummary({ energyPts: [-1, null, 0, 1.5], likingPts: [4, 4, null, 4], period: 'all' });
  assert.match(s, /by week/);
  assert.match(s, /Energy averages \+0\.2, latest \+1\.5, rising\./);
  assert.match(s, /Liking averages 4, latest 4, steady\./);
});

test('trendSummary: falling, a single point has no direction, one series missing, none at all', () => {
  assert.match(trendSummary({ energyPts: [2, 0], likingPts: [], period: '7d' }), /Energy averages \+1, latest 0, falling\./);
  assert.doesNotMatch(trendSummary({ energyPts: [], likingPts: [3], period: '7d' }), /Energy averages/);
  assert.match(trendSummary({ energyPts: [], likingPts: [3], period: '7d' }), /Liking averages 3, latest 3\./);
  assert.equal(trendSummary({ energyPts: [null], likingPts: [], period: '7d' }), 'Energy and liking by day: nothing rated yet.');
});

test('scatterSummary: the three correlations and the count', () => {
  assert.match(scatterSummary([1, 2, 3], 0.02), /3 sessions plotted. Longer sessions tend to have higher energy\./);
  assert.match(scatterSummary([1], -0.02), /1 session plotted. Longer sessions tend to have lower energy\./);
  assert.match(scatterSummary([], 0), /No clear link/);
});

test('monthName and librarySummary', () => {
  assert.equal(monthName('2026-10'), 'October 2026');
  assert.equal(monthName('nonsense'), 'nonsense');
  const s = librarySummary([{ m: '2026-01', total: 2, added: 2 }, { m: '2026-10', total: 9, added: 3 }], [2, 6]);
  assert.match(s, /from January 2026 to October 2026/);
  assert.match(s, /9 pieces in total, 6 active/);
  assert.match(s, /3 added in October 2026/);
  assert.equal(librarySummary([], []), 'Library growth: no pieces yet.');
});

test('dayOfWeekSummary lists every day and names the busiest', () => {
  const byDay = [{ count: 3 }, { count: 0 }, { count: 5 }, { count: 1 }, { count: 0 }, { count: 2 }, { count: 4 }];
  const s = dayOfWeekSummary(byDay, 2);
  assert.match(s, /Monday 3, Tuesday 0, Wednesday 5/);
  assert.match(s, /Sunday 4\./);
  assert.match(s, /Most active: Wednesday\./);
  assert.doesNotMatch(dayOfWeekSummary(byDay.map(() => ({ count: 0 })), 0), /Most active/);
  assert.match(dayOfWeekSummary([], 0), /nothing logged yet/);
});

test('spokenKey reads sharps, flats and minors aloud', () => {
  assert.equal(spokenKey('C'), 'C major');
  assert.equal(spokenKey('F#'), 'F sharp major');
  assert.equal(spokenKey('Bb'), 'B flat major');
  assert.equal(spokenKey('B'), 'B major');
  assert.equal(spokenKey('Am'), 'A minor');
  assert.equal(spokenKey('F#m'), 'F sharp minor');
  assert.equal(spokenKey('Bbm'), 'B flat minor');
  assert.equal(spokenKey('Bm'), 'B minor');
  assert.equal(spokenKey('Db'), 'D flat major');
});

test('every key on the circle has a spoken name', () => {
  for (const k of [...COF_KEYS, ...COF_MINORS]) assert.match(spokenKey(k), /^[A-G]( sharp| flat)? (major|minor)$/);
});

test('coverageSummary: keys practised, most first, with totals', () => {
  const major = COF_KEYS.map(() => 0); major[0] = 5; major[7] = 1;      // C, Db
  const minor = COF_MINORS.map(() => 0); minor[0] = 2;                   // Am
  const s = coverageSummary({ majorCounts: major, minorCounts: minor, totalSessions: 8, totalMinutes: 95 });
  assert.match(s, /3 of 24 keys practised/);
  assert.match(s, /8 sessions and 1 hour 35 minutes/);
  assert.match(s, /C major 5, A minor 2, D flat major 1\./);
});

test('coverageSummary with nothing practised', () => {
  assert.equal(coverageSummary({ majorCounts: COF_KEYS.map(() => 0), minorCounts: COF_MINORS.map(() => 0) }), 'Circle of fifths: no scales practised in this period.');
  assert.equal(coverageSummary({}), 'Circle of fifths: no scales practised in this period.');
});
