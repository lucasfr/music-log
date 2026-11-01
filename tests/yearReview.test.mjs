import test from 'node:test';
import assert from 'node:assert/strict';
import { yearReview } from '../src/utils/yearReview.js';

const S = (date, duration, segments = [], extra = {}) => ({ id: date, date, duration, segments, ...extra });
const rep = (compositionId, duration, tempo) => ({ type: 'repertoire', compositionId, duration, ...(tempo ? { tempo } : {}) });
const tech = (group, title, tempo, scales = []) => ({ type: 'technique', group, title, tempo, scales, duration: 10 });
const comps = [{ id: 'p1', title: 'Sonatina' }, { id: 'p2', title: 'Prelude', memorised: true, memorisedAt: '2026-09-10' }, { id: 'p3', title: 'Old', memorised: true, memorisedAt: '2025-03-01' }];

test('an empty year is empty, and says nothing', () => {
  const r = yearReview([], [], comps, 2026);
  assert.equal(r.empty, true);
  assert.deepEqual(r.highlights, []);
  assert.equal(r.hours, 0);
  assert.equal(r.busiestMonth, null);
  assert.equal(r.topPiece, null);
});

test('only the year asked for counts', () => {
  const r = yearReview([S('2025-12-31', 600), S('2026-01-01', 60), S('2026-06-01', 30), S('2027-01-01', 600)], [{ date: '2025-05-01' }, { date: '2026-02-01' }], comps, 2026);
  assert.equal(r.hours, 1.5);
  assert.equal(r.sessions, 2);
  assert.equal(r.lessons, 1);
  assert.equal(r.activeDays, 2);
});

test('hours, busiest month and the line for each', () => {
  const r = yearReview([S('2026-03-01', 60), S('2026-03-02', 90), S('2026-05-01', 120)], [], comps, 2026);
  assert.deepEqual(r.busiestMonth, { month: 'March', hours: 2.5 });
  assert.equal(r.highlights[0], '4.5 hours over 3 sessions on 3 days.');
  assert.ok(r.highlights.includes('Busiest month: March, 2.5 hours.'));
});

test('the piece played most, and pieces practised', () => {
  const r = yearReview([S('2026-03-01', 60, [rep('p1', 20), rep('p2', 40)]), S('2026-03-02', 30, [rep('p1', 30)])], [], comps, 2026);
  assert.deepEqual(r.topPiece, { id: 'p1', title: 'Sonatina', minutes: 50 });
  assert.equal(r.piecesPlayed, 2);
  assert.ok(r.highlights.some(h => h.startsWith('Played most: Sonatina, 0.8 hours')));
});

test('scales and arpeggios are counted once each, whether stored as text or as objects', () => {
  const r = yearReview([
    S('2026-03-01', 30, [tech('Scales', '', 0, ['C major', { scale: 'G major' }])]),
    S('2026-03-02', 30, [tech('Scales', '', 0, ['C major', { scale: 'A minor' }])]),
  ], [], comps, 2026);
  assert.equal(r.scalesPlayed, 3);
});

test('the biggest tempo gain: first to last reading in the year, for a piece or an exercise', () => {
  const r = yearReview([
    S('2026-02-01', 30, [rep('p1', 10, 60), tech('Hanon', 'No. 1', 80)]),
    S('2026-06-01', 30, [rep('p1', 10, 84), tech('Hanon', 'No. 1', 90)]),
    S('2026-09-01', 30, [rep('p1', 10, 90)]),
  ], [], comps, 2026);
  assert.deepEqual(r.biggestGain, { name: 'Sonatina', from: 60, to: 90, gain: 30 });
  assert.equal(yearReview([S('2026-02-01', 30, [rep('p1', 10, 60)])], [], comps, 2026).biggestGain, null);        // one reading is not a gain
  assert.equal(yearReview([S('2026-02-01', 30, [rep('p1', 10, 90)]), S('2026-03-01', 30, [rep('p1', 10, 70)])], [], comps, 2026).biggestGain, null);   // slower is not a gain
});

test('pieces memorised this year, not other years', () => {
  assert.equal(yearReview([S('2026-03-01', 30)], [], comps, 2026).memorised, 1);
  assert.equal(yearReview([S('2025-03-01', 30)], [], comps, 2025).memorised, 1);
});

test('the longest run, with and without a rest day in it', () => {
  const dates = ['2026-03-05', '2026-03-06', '2026-03-08', '2026-03-09'];      // Thu, Fri, (Sat), Sun, Mon: Saturday missing
  const sessions = dates.map(d => S(d, 20));
  assert.equal(yearReview(sessions, [], comps, 2026).longestRun, 2);
  assert.equal(yearReview(sessions, [], comps, 2026, [6]).longestRun, 4);       // Saturday off bridges the gap
  assert.equal(yearReview([S('2026-03-05', 20)], [], comps, 2026).longestRun, 1);
});

test('a longer run elsewhere in the year wins', () => {
  const sessions = ['2026-01-01', '2026-01-02', '2026-06-10', '2026-06-11', '2026-06-12'].map(d => S(d, 20));
  assert.equal(yearReview(sessions, [], comps, 2026).longestRun, 3);
});

test('wins: the five most recent, trimmed, blanks skipped', () => {
  const sessions = ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01'].map((d, i) => S(d, 20, [], { wins: i === 3 ? '   ' : `  Win ${i}  ` }));
  const r = yearReview(sessions, [], comps, 2026);
  assert.deepEqual(r.wins.map(w => w.text), ['Win 6', 'Win 5', 'Win 4', 'Win 2', 'Win 1']);
});

test('lessons alone make a year that is not empty, and a lesson-only year still gets its line', () => {
  const r = yearReview([], [{ date: '2026-02-01' }, { date: '2026-03-01' }], comps, 2026);
  assert.equal(r.empty, false);
  assert.deepEqual(r.highlights, ['2 lessons.']);
});

test('junk dates and missing fields do not break it, and the inputs are not changed', () => {
  const sessions = Object.freeze([Object.freeze({ date: 'soon', duration: 5 }), Object.freeze({ date: '2026-03-01' }), null]);
  const r = yearReview(sessions, undefined, undefined, 2026);
  assert.equal(r.sessions, 1);
  assert.equal(r.hours, 0);
  assert.doesNotThrow(() => yearReview(sessions, [], comps, '2026'));
});
