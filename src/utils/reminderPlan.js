// What the practice reminders should do, worked out apart from the notification code so it can be tested. Two
// things: the daily practice reminder should skip your rest days, and a lesson reminder goes out the evening before
// the lesson. Pure (no React Native imports), so it's unit-tested in plain Node, see tests/reminderPlan.test.mjs.
//
// Weekdays are JavaScript's (0 = Sunday ... 6 = Saturday), as the rest days preference stores them;
// expo-notifications counts Sunday as 1, so `expoWeekday` converts.

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const validDate = s => typeof s === 'string' && ISO.test(s) && !Number.isNaN(new Date(`${s}T12:00:00Z`).getTime());
const dayNumber = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;

export const LESSON_EVE_HOUR = 18;

// The weekdays the daily reminder should fire on: every day that is not a rest day. If every day were a rest day
// (which the rest days preference does not allow) the reminder would never fire, so it falls back to every day.
export function reminderWeekdays(restDays) {
  const rest = new Set((restDays || []).filter(d => Number.isInteger(d) && d >= 0 && d <= 6));
  const days = [0, 1, 2, 3, 4, 5, 6].filter(d => !rest.has(d));
  return days.length ? days : [0, 1, 2, 3, 4, 5, 6];
}

// One reminder every day (the simple, original way) when no day is a rest day.
export const remindsEveryDay = restDays => reminderWeekdays(restDays).length === 7;

// expo-notifications' weekday for a JavaScript one: Sunday is 1, Saturday is 7.
export const expoWeekday = jsDay => jsDay + 1;

// When the lesson reminder should fire: the evening before the lesson, at `hour`. -> { date: 'YYYY-MM-DD', hour } or null
// when there is nothing to schedule: no valid date, the lesson is today or past, or that evening has already gone.
// `today` is 'YYYY-MM-DD' and `nowHour` the current hour (0 to 23).
export function lessonReminderAt(lessonDate, today, nowHour = 0, hour = LESSON_EVE_HOUR) {
  if (!validDate(lessonDate) || !validDate(today)) return null;
  const until = Math.round(dayNumber(lessonDate) - dayNumber(today));
  if (until < 1) return null;                               // the lesson is today or has passed
  if (until === 1 && Number(nowHour) >= hour) return null;  // tomorrow, and this evening's reminder time has gone
  const t = new Date(Date.UTC(+lessonDate.slice(0, 4), +lessonDate.slice(5, 7) - 1, +lessonDate.slice(8, 10)));
  t.setUTCDate(t.getUTCDate() - 1);
  const date = `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
  return { date, hour };
}
