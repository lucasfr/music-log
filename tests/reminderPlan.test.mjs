import test from 'node:test';
import assert from 'node:assert/strict';
import { reminderWeekdays, remindsEveryDay, expoWeekday, lessonReminderAt, LESSON_EVE_HOUR } from '../src/utils/reminderPlan.js';

test('no rest days: every day, and the simple daily reminder is enough', () => {
  assert.deepEqual(reminderWeekdays([]), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(reminderWeekdays(undefined), [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(remindsEveryDay([]), true);
  assert.equal(remindsEveryDay(undefined), true);
});

test('rest days are left out, in order', () => {
  assert.deepEqual(reminderWeekdays([0]), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(reminderWeekdays([6, 0]), [1, 2, 3, 4, 5]);
  assert.equal(remindsEveryDay([0]), false);
});

test('junk in the rest days is ignored, and every day off falls back to every day', () => {
  assert.deepEqual(reminderWeekdays([9, -1, 'x', 2.5, null]), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(reminderWeekdays([0, 1, 2, 3, 4, 5, 6]), [0, 1, 2, 3, 4, 5, 6]);
});

test('expo counts Sunday as 1', () => {
  assert.deepEqual([0, 1, 6].map(expoWeekday), [1, 2, 7]);
});

test('the lesson reminder is the evening before at 18:00', () => {
  assert.deepEqual(lessonReminderAt('2026-11-10', '2026-11-01', 9), { date: '2026-11-09', hour: LESSON_EVE_HOUR });
  assert.equal(LESSON_EVE_HOUR, 18);
  assert.deepEqual(lessonReminderAt('2026-11-10', '2026-11-01', 9, 20), { date: '2026-11-09', hour: 20 });
});

test('the eve crosses a month, a year and a leap day', () => {
  assert.equal(lessonReminderAt('2026-12-01', '2026-11-01').date, '2026-11-30');
  assert.equal(lessonReminderAt('2027-01-01', '2026-11-01').date, '2026-12-31');
  assert.equal(lessonReminderAt('2028-03-01', '2028-01-01').date, '2028-02-29');
  assert.equal(lessonReminderAt('2026-10-26', '2026-10-20').date, '2026-10-25');     // the day the UK clocks go back
});

test('a lesson tomorrow still gets this evening\'s reminder, unless 18:00 has gone', () => {
  assert.deepEqual(lessonReminderAt('2026-11-02', '2026-11-01', 10), { date: '2026-11-01', hour: 18 });
  assert.deepEqual(lessonReminderAt('2026-11-02', '2026-11-01', 17), { date: '2026-11-01', hour: 18 });
  assert.equal(lessonReminderAt('2026-11-02', '2026-11-01', 18), null);
  assert.equal(lessonReminderAt('2026-11-02', '2026-11-01', 23), null);
});

test('nothing to schedule for a lesson today, past, or with no usable date', () => {
  assert.equal(lessonReminderAt('2026-11-01', '2026-11-01'), null);
  assert.equal(lessonReminderAt('2026-10-30', '2026-11-01'), null);
  for (const bad of ['', null, undefined, 'soon', '2026-13-40']) assert.equal(lessonReminderAt(bad, '2026-11-01'), null, String(bad));
  assert.equal(lessonReminderAt('2026-11-10', 'garbage'), null);
});
