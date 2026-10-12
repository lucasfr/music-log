// Tests for the progress helpers (src/utils/progress.js).  Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '../src/utils/progress.js'), 'utf8');
const { currentStreak, weekSummary, latestFocus, detectMilestones } =
  await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

const s = (date, extra = {}) => ({ id: date + (extra.id || ''), date, duration: 10, ...extra });
// n consecutive days ending on `end` (local dates)
function run(end, n, extra = {}) {
  const out = [];
  const d = new Date(`${end}T12:00:00`);
  for (let i = 0; i < n; i++) {
    out.push(s(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, extra));
    d.setDate(d.getDate() - 1);
  }
  return out;
}

// ── currentStreak ────────────────────────────────────────────────────────────────────

test('streak counts consecutive days back from today', () => {
  assert.equal(currentStreak(run('2026-10-12', 4), '2026-10-12'), 4);
});

test('a streak is still alive if today is not logged yet (counted from yesterday)', () => {
  assert.equal(currentStreak(run('2026-10-11', 3), '2026-10-12'), 3);
});

test('a missed day breaks the streak', () => {
  assert.equal(currentStreak(run('2026-10-09', 3), '2026-10-12'), 0);
  assert.equal(currentStreak([s('2026-10-12'), s('2026-10-11'), s('2026-10-09')], '2026-10-12'), 2);
});

test('streak handles no sessions, duplicates in a day, and month / year boundaries', () => {
  assert.equal(currentStreak([], '2026-10-12'), 0);
  assert.equal(currentStreak(undefined, '2026-10-12'), 0);
  assert.equal(currentStreak([s('2026-10-12'), s('2026-10-12', { id: 'b' })], '2026-10-12'), 1);
  assert.equal(currentStreak(run('2027-01-02', 5), '2027-01-02'), 5, 'crosses a year boundary');
  assert.equal(currentStreak(run('2026-03-02', 4), '2026-03-02'), 4, 'crosses a month boundary');
});

test('streak is not thrown off by the clocks changing (British Summer Time ends 25 Oct 2026)', () => {
  assert.equal(currentStreak(run('2026-10-27', 5), '2026-10-27'), 5);
  assert.equal(currentStreak(run('2026-03-31', 7), '2026-03-31'), 7, 'and starts 29 Mar');
});

// ── weekSummary (Monday to Sunday) ───────────────────────────────────────────────────

test('weekSummary covers the Monday–Sunday week containing today', () => {
  // 12 Oct 2026 is a Monday
  const w = weekSummary([s('2026-10-11'), s('2026-10-12'), s('2026-10-14', { duration: 25 })], [{ id: 'l', date: '2026-10-13' }], '2026-10-12');
  assert.equal(w.start, '2026-10-12');
  assert.equal(w.end, '2026-10-18');
  assert.equal(w.sessions, 2, 'Sunday 11th belongs to the previous week');
  assert.equal(w.minutes, 35);
  assert.equal(w.lessons, 1);
  assert.equal(w.days, 2);
});

test('on a Sunday the week still starts the previous Monday', () => {
  const w = weekSummary([s('2026-10-12'), s('2026-10-18')], [], '2026-10-18');
  assert.equal(w.start, '2026-10-12');
  assert.equal(w.sessions, 2);
});

test('the previous week is found by stepping back seven days, and excludes this week', () => {
  // today = Monday 12 Oct; last week = Mon 5 – Sun 11 Oct. Your reported case: one 5-minute session on Fri 9 Oct.
  const sessions = [s('2026-10-09', { duration: 5 }), s('2026-10-12', { duration: 30 })];
  const lastWeek = weekSummary(sessions, [], '2026-10-05');       // any date inside last week
  assert.equal(lastWeek.start, '2026-10-05');
  assert.equal(lastWeek.end, '2026-10-11');
  assert.equal(lastWeek.sessions, 1);
  assert.equal(lastWeek.minutes, 5, 'the Monday session belongs to the new week');
  const thisWeek = weekSummary([sessions[0]], [], '2026-10-12');
  assert.equal(thisWeek.sessions, 0, 'so on that Monday this week is empty (and the strip shows last week)');
});

test('weekSummary is safe on empty input and counts a day once however many sessions it has', () => {
  assert.deepEqual({ ...weekSummary([], undefined, '2026-10-14') }.sessions, 0);
  const w = weekSummary([s('2026-10-14'), s('2026-10-14', { id: 'x' })], [], '2026-10-14');
  assert.equal(w.sessions, 2);
  assert.equal(w.days, 1);
});

// ── latestFocus ──────────────────────────────────────────────────────────────────────

test('latestFocus is the most recent session\'s focus', () => {
  const f = latestFocus([
    s('2026-10-09', { tomorrowFocus: 'Left hand evenness' }),
    s('2026-10-10', { tomorrowFocus: '  Dynamics in bar 12  ' }),
  ]);
  assert.deepEqual(f, { date: '2026-10-10', focus: 'Dynamics in bar 12' });
});

test('a stale focus is not shown once a newer session set none', () => {
  assert.equal(latestFocus([s('2026-10-09', { tomorrowFocus: 'old' }), s('2026-10-11')]), null);
  assert.equal(latestFocus([s('2026-10-11', { tomorrowFocus: '   ' })]), null);
  assert.equal(latestFocus([]), null);
  assert.equal(latestFocus(undefined), null);
});

test('two sessions on one day: the later one wins', () => {
  const f = latestFocus([
    s('2026-10-11', { id: 'a', createdAt: '2026-10-11T08:00', tomorrowFocus: 'morning' }),
    s('2026-10-11', { id: 'b', createdAt: '2026-10-11T20:00', tomorrowFocus: 'evening' }),
  ]);
  assert.equal(f.focus, 'evening');
});

// ── detectMilestones ─────────────────────────────────────────────────────────────────

const ids = list => list.map(m => m.id);
const after = (sessions, extra) => ({ sessions: [...sessions, extra], lessons: [] });

test('the first session and the first lesson are celebrated once', () => {
  assert.deepEqual(ids(detectMilestones({ sessions: [], lessons: [] }, { sessions: [s('2026-10-12')], lessons: [] }, '2026-10-12')), ['first-session']);
  assert.deepEqual(ids(detectMilestones({ sessions: [s('2026-10-05')], lessons: [] }, { sessions: [s('2026-10-05')], lessons: [{ id: 'l', date: '2026-10-06' }] }, '2026-10-06')), ['first-lesson']);
  assert.deepEqual(ids(detectMilestones({ sessions: [s('2026-10-05')], lessons: [{ id: 'l' }] }, { sessions: [s('2026-10-05'), s('2026-10-06')], lessons: [{ id: 'l' }] }, '2026-10-06')), []);
});

test('a 7-day streak fires on the day it is reached, and not again on day 8', () => {
  const six = run('2026-10-11', 6);
  const seven = detectMilestones({ sessions: six, lessons: [] }, after(six, s('2026-10-12')), '2026-10-12');
  assert.ok(ids(seven).includes('streak-7'));
  const next = run('2026-10-12', 7);
  const eight = detectMilestones({ sessions: next, lessons: [] }, after(next, s('2026-10-13')), '2026-10-13');
  assert.equal(ids(eight).includes('streak-7'), false);
});

test('session-count milestones fire when crossed', () => {
  const nine = Array.from({ length: 9 }, (_, i) => s(`2026-01-${String(i + 1).padStart(2, '0')}`));
  assert.ok(ids(detectMilestones({ sessions: nine, lessons: [] }, after(nine, s('2026-02-01')), '2026-02-01')).includes('sessions-10'));
  const ten = [...nine, s('2026-02-01')];
  assert.equal(ids(detectMilestones({ sessions: ten, lessons: [] }, after(ten, s('2026-02-03')), '2026-02-03')).includes('sessions-10'), false);
});

test('hours milestones are based on total minutes logged', () => {
  const before = [s('2026-01-01', { duration: 590 })];            // 9h 50m
  const got = detectMilestones({ sessions: before, lessons: [] }, after(before, s('2026-01-02', { duration: 20 })), '2026-01-02'); // -> 10h 10m
  assert.ok(ids(got).includes('hours-10'));
  const none = detectMilestones({ sessions: before, lessons: [] }, after(before, s('2026-01-02', { duration: 5 })), '2026-01-02'); // 9h 55m
  assert.equal(ids(none).includes('hours-10'), false);
});

test('editing an existing session (same count and minutes) celebrates nothing', () => {
  const sessions = run('2026-10-12', 7);
  assert.deepEqual(detectMilestones({ sessions, lessons: [] }, { sessions, lessons: [] }, '2026-10-12'), []);
});

test('only the highest threshold is reported for one save, and the first-ever session leads', () => {
  const got = detectMilestones({ sessions: [], lessons: [] }, { sessions: [s('2026-10-12', { duration: 700 })], lessons: [] }, '2026-10-12');
  assert.equal(got[0].id, 'first-session');
  assert.ok(got.every(m => m.title && m.message), 'every milestone has a title and a message');
});
