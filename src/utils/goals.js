// Yearly and monthly practice goals: hours for the calendar year (or month), how far through you are, and
// whether that is ahead of, on, or behind an even pace. Like the weekly goal, but for the longer view.
// Pure (no React Native imports), so it's unit-tested in plain Node, see tests/goals.test.mjs.
//
// Only practice sessions count (lessons are not practice). Dates are local 'YYYY-MM-DD' strings, counted by
// calendar date so the clocks changing can't move a day.

export const YEAR_GOAL_OPTIONS = [0, 50, 100, 150, 200, 300];   // hours; 0 is off
export const MONTH_GOAL_OPTIONS = [0, 5, 10, 15, 20, 30];

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const dayNumber = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();   // m is 1-12
const daysInYear = y => ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365);

const round1 = v => Math.round(v * 10) / 10;
const hoursText = h => {
  const r = round1(h);
  return `${r} ${r === 1 ? 'hour' : 'hours'}`;
};

// The shared sum: hours practised in [from, today] and the status against an even pace.
function progress(sessions, today, from, totalDays, goalHours, label) {
  const goal = num(goalHours);
  if (!(goal > 0) || !ISO.test(String(today || ''))) return null;
  const minutes = (sessions || [])
    .filter(s => s && ISO.test(String(s.date || '')) && s.date >= from && s.date <= today)
    .reduce((a, s) => a + num(s.duration), 0);
  const hours = minutes / 60;
  const elapsed = Math.min(totalDays, Math.max(1, dayNumber(today) - dayNumber(from) + 1));
  const expected = goal * (elapsed / totalDays);
  const left = totalDays - elapsed;
  let status;
  if (hours >= goal) status = 'done';
  else if (hours >= expected * 1.05) status = 'ahead';
  else if (hours >= expected * 0.9) status = 'on';
  else status = 'behind';

  let line = `${hoursText(hours)} of ${goal} ${label}`;
  if (status === 'done') line += ': goal reached.';
  else if (status === 'ahead') line += `, ${hoursText(hours - expected)} ahead of pace.`;
  else if (status === 'on') line += ', on pace.';
  else {
    const perDay = left > 0 ? Math.ceil(((goal - hours) * 60) / left) : 0;
    line += `, ${hoursText(expected - hours)} behind pace${left > 0 ? `: about ${perDay} min a day to catch up` : ''}.`;
  }
  const catchUpMinutes = status === 'behind' && left > 0 ? Math.ceil(((goal - hours) * 60) / left) : 0;
  return { hours: round1(hours), goal, expected: round1(expected), fraction: Math.min(1, hours / goal), status, daysLeft: left, catchUpMinutes, line };
}

// -> null when there is no goal; otherwise { hours, goal, expected, fraction, status, daysLeft, line }
//    with status 'done' | 'ahead' | 'on' | 'behind'.
export function yearProgress(sessions, today, goalHours) {
  if (!ISO.test(String(today || ''))) return null;
  const y = +today.slice(0, 4);
  return progress(sessions, today, `${y}-01-01`, daysInYear(y), goalHours, `hours this year`);
}

export function monthProgress(sessions, today, goalHours) {
  if (!ISO.test(String(today || ''))) return null;
  const y = +today.slice(0, 4);
  const m = +today.slice(5, 7);
  return progress(sessions, today, `${today.slice(0, 7)}-01`, daysInMonth(y, m), goalHours, `hours this month`);
}
