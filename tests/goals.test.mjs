import test from 'node:test';
import assert from 'node:assert/strict';
import { yearProgress, monthProgress, YEAR_GOAL_OPTIONS, MONTH_GOAL_OPTIONS } from '../src/utils/goals.js';

const S = (date, duration) => ({ date, duration });

test('no goal, or a nonsense one, means nothing to show', () => {
  for (const g of [0, undefined, null, -5, 'x', NaN]) { assert.equal(yearProgress([], '2026-11-01', g), null); assert.equal(monthProgress([], '2026-11-01', g), null); }
  assert.equal(yearProgress([], 'garbage', 100), null);
  assert.deepEqual([YEAR_GOAL_OPTIONS[0], MONTH_GOAL_OPTIONS[0]], [0, 0]);
});

test('only this year counts, only up to today, only practice sessions with a duration', () => {
  const sessions = [S('2025-12-31', 600), S('2026-01-01', 60), S('2026-06-15', 120), S('2026-11-01', 30), S('2026-11-02', 600), S('2026-03-01', undefined), S('2026-03-02', 'x')];
  const p = yearProgress(sessions, '2026-11-01', 100);
  assert.equal(p.hours, 3.5);        // 60 + 120 + 30 minutes
});

test('pace: ahead, on, behind, and done', () => {
  // 2026-07-02 is day 183 of 365: half the goal is about 50.1 hours of 100.
  const at = h => yearProgress([S('2026-02-01', h * 60)], '2026-07-02', 100).status;
  assert.equal(at(60), 'ahead');
  assert.equal(at(50), 'on');
  assert.equal(at(46), 'on');       // within 10%
  assert.equal(at(40), 'behind');
  assert.equal(at(100), 'done');
  assert.equal(at(130), 'done');
});

test('the lines say what to do when behind', () => {
  const p = yearProgress([S('2026-02-01', 40 * 60)], '2026-07-02', 100);
  assert.match(p.line, /^40 hours of 100 hours this year, 10\.1 hours behind pace: about \d+ min a day to catch up\.$/);
  const minutes = Number(/about (\d+) min/.exec(p.line)[1]);
  assert.equal(minutes, Math.ceil(((100 - 40) * 60) / p.daysLeft));
  assert.equal(p.catchUpMinutes, minutes);
  assert.equal(yearProgress([S('2026-02-01', 60 * 60)], '2026-07-02', 100).catchUpMinutes, 0);       // not behind: nothing to catch up
  assert.equal(yearProgress([S('2026-02-01', 40 * 60)], '2026-12-31', 100).catchUpMinutes, 0);        // behind on the last day: no days left
  assert.match(yearProgress([S('2026-02-01', 60 * 60)], '2026-07-02', 100).line, /ahead of pace\.$/);
  assert.match(yearProgress([S('2026-02-01', 50 * 60)], '2026-07-02', 100).line, /on pace\.$/);
  assert.match(yearProgress([S('2026-02-01', 100 * 60)], '2026-07-02', 100).line, /goal reached\.$/);
});

test('singular hour and fraction are bounded', () => {
  assert.match(yearProgress([S('2026-01-02', 60)], '2026-12-31', 150).line, /^1 hour of 150/);
  assert.equal(yearProgress([S('2026-01-02', 99999)], '2026-12-31', 100).fraction, 1);
  assert.equal(yearProgress([], '2026-12-31', 100).fraction, 0);
});

test('leap years: 29 February exists and the year has 366 days', () => {
  const p = yearProgress([], '2028-12-31', 366);
  assert.equal(p.expected, 366);
  assert.equal(yearProgress([], '2028-02-29', 366).expected, 60);       // day 60 of 366
  assert.equal(yearProgress([], '2026-12-31', 365).expected, 365);
});

test('the first and last day of the year', () => {
  assert.equal(yearProgress([], '2026-01-01', 365).expected, 1);
  assert.equal(yearProgress([], '2026-01-01', 365).daysLeft, 364);
  assert.equal(yearProgress([], '2026-12-31', 365).daysLeft, 0);
});

test('a month: its own days, not the year\'s', () => {
  const sessions = [S('2026-10-31', 600), S('2026-11-02', 120), S('2026-11-15', 60)];
  const p = monthProgress(sessions, '2026-11-15', 10);
  assert.equal(p.hours, 3);
  assert.equal(p.expected, 5);            // 15 of 30 days
  assert.equal(p.status, 'behind');
  assert.equal(monthProgress([], '2028-02-29', 29).expected, 29);      // the last day of a leap February
  assert.equal(monthProgress([], '2026-02-28', 28).expected, 28);
  assert.match(monthProgress(sessions, '2026-11-15', 10).line, /hours this month/);
});

test('nothing is counted from the future, and the status when the goal is tiny', () => {
  assert.equal(yearProgress([S('2026-12-01', 6000)], '2026-11-01', 10).hours, 0);
  assert.equal(yearProgress([S('2026-11-01', 60)], '2026-11-01', 1).status, 'done');
});
