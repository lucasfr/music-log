// Progress helpers for Home and the milestone messages (pure: no React Native imports, so
// they're unit-tested in plain Node, see tests/progress.test.mjs).
//
// Dates are local 'YYYY-MM-DD' strings throughout, built from local calendar fields (never
// toISOString(), which is UTC). Day arithmetic is done at local noon so a daylight-saving
// change can't push a date across midnight.

const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const noon = s => new Date(`${s}T12:00:00`);
const minutesOf = s => Number(s.duration) || 0;

// Consecutive days with a practice session, counting back from today. If nothing is logged
// today yet the streak is still alive: it's counted back from yesterday.
//
// `restDays` are weekdays (0 = Sunday … 6 = Saturday, as Date.getDay) that are planned days off. A
// rest day with nothing logged neither breaks the streak nor adds to it; one that was practised on
// counts like any other day. Without any (the default) it is the plain consecutive-days count.
export function currentStreak(sessions, todayStr, restDays = []) {
  const dates = new Set((sessions || []).map(s => s.date));
  const rest = new Set(restDays || []);
  const d = noon(todayStr);
  if (!dates.has(todayStr)) d.setDate(d.getDate() - 1);
  let n = 0;
  // The bound only matters if every weekday were a rest day, which parseRestDays never allows.
  for (let guard = 0; guard < 5000; guard += 1) {
    if (dates.has(iso(d))) n += 1;
    else if (!rest.has(d.getDay())) break;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

// The rest days preference: a JSON list of weekdays (0 = Sunday … 6 = Saturday). Anything malformed is
// no rest days, and a list covering all seven days is too (a streak needs at least one day that counts).
export function parseRestDays(raw) {
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    const days = [...new Set(list
      .filter(v => typeof v === 'number' || (typeof v === 'string' && /^[0-6]$/.test(v.trim())))   // not null, '' or true, which Number() turns into 0 or 1
      .map(Number)
      .filter(n => Number.isInteger(n) && n >= 0 && n <= 6))].sort((a, b) => a - b);
    return days.length >= 7 ? [] : days;
  } catch {
    return [];
  }
}

export const serializeRestDays = days => JSON.stringify(parseRestDays(JSON.stringify(days)));

// The rest days after tapping `day`: switched on if it was off, off if it was on. The seventh day
// can't be switched on, so there is always one day a streak counts.
export function toggleRestDay(current, day) {
  const set = new Set(parseRestDays(JSON.stringify(current)));
  if (set.has(day)) set.delete(day); else set.add(day);
  const next = [...set].sort((a, b) => a - b);
  return next.length >= 7 ? parseRestDays(JSON.stringify(current)) : next;
}

// Sessions, lessons, minutes and practice days in the Monday–Sunday week containing today.
export function weekSummary(sessions, lessons, todayStr) {
  const d = noon(todayStr);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // back to Monday
  const start = iso(d);
  d.setDate(d.getDate() + 6);
  const end = iso(d);
  const inWeek = x => x.date >= start && x.date <= end;
  const ss = (sessions || []).filter(inWeek);
  return {
    sessions: ss.length,
    lessons: (lessons || []).filter(inWeek).length,
    minutes: ss.reduce((sum, s) => sum + minutesOf(s), 0),
    days: new Set(ss.map(s => s.date)).size,
    start, end,
  };
}

// The "tomorrow's focus" from the most recent session, if that session set one. Only the
// latest counts: a focus from an old session, with newer ones that set none, would be stale.
export function latestFocus(sessions) {
  let latest = null;
  (sessions || []).forEach(s => {
    if (!latest
      || s.date > latest.date
      || (s.date === latest.date && (s.createdAt || '') > (latest.createdAt || ''))) latest = s;
  });
  const focus = latest && typeof latest.tomorrowFocus === 'string' ? latest.tomorrowFocus.trim() : '';
  return focus ? { date: latest.date, focus } : null;
}

// ── Milestones ───────────────────────────────────────────────────────────────────────

const SESSION_COUNTS = [10, 25, 50, 100, 200, 365, 500, 1000];
const HOURS = [10, 25, 50, 100, 250, 500, 1000];
const STREAKS = [7, 14, 30, 60, 100, 365];

// The highest threshold crossed going from `before` to `after` (before < t <= after), or null.
function crossed(thresholds, before, after) {
  let hit = null;
  thresholds.forEach(t => { if (before < t && t <= after) hit = t; });
  return hit;
}

const hoursOf = sessions => (sessions || []).reduce((sum, s) => sum + minutesOf(s), 0) / 60;

// Milestones that saving one thing newly reaches, most notable first. `prev` and `next` are
// { sessions, lessons } before and after the save. Each one fires exactly once, when it is
// crossed, so re-saving or editing never repeats it.
export function detectMilestones(prev, next, todayStr, restDays = []) {
  const out = [];
  const ps = prev.sessions || [], ns = next.sessions || [];
  const pl = prev.lessons || [], nl = next.lessons || [];

  if (ps.length === 0 && ns.length > 0) {
    out.push({ id: 'first-session', title: 'First session logged', message: 'Your journal has begun. Come back tomorrow to start a streak.' });
  }
  if (pl.length === 0 && nl.length > 0) {
    out.push({ id: 'first-lesson', title: 'First lesson logged', message: 'Lessons and practice now sit side by side in your journal.' });
  }
  const streak = crossed(STREAKS, currentStreak(ps, todayStr, restDays), currentStreak(ns, todayStr, restDays));
  if (streak) out.push({ id: `streak-${streak}`, title: `${streak}-day streak`, message: `${streak} days in a row. Nice work.` });
  const hours = crossed(HOURS, Math.floor(hoursOf(ps)), Math.floor(hoursOf(ns)));
  if (hours) out.push({ id: `hours-${hours}`, title: `${hours} hours of practice`, message: `You've now logged ${hours} hours at the piano.` });
  const count = crossed(SESSION_COUNTS, ps.length, ns.length);
  if (count) out.push({ id: `sessions-${count}`, title: `${count} sessions`, message: `${count} practice sessions logged.` });
  return out;
}

// ── Timer plans and "repeat last session" ────────────────────────────────────────────

const makeId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

// Turn a logged session into a timer plan: the reverse of HomeScreen.handleTimerFinish.
// The same technique / piece segments and minutes (capped at the minutes dial's 60). Only
// what the timer uses is carried over — notes, tempo, scales and ratings aren't part of a
// plan. A segment that's ready to run comes back `confirmed` (collapsed); one that still
// needs a piece (say it has since been removed from the library) stays open.
export function sessionToTimerPlan(session, compositions) {
  return ((session && session.segments) || []).map(seg => {
    const isTech = seg.type === 'technique';
    const comp = (compositions || []).find(c => c.id === seg.compositionId);
    const draft = {
      id: makeId(),
      type: seg.type,
      // The timer keeps a technique's group in `title`; a repertoire segment's title is its piece.
      title: isTech ? (seg.group || '') : (comp ? comp.title : (seg.title || '')),
      compositionId: comp ? comp.id : '',
      plannedMinutes: Math.min(60, Math.max(1, Math.round(Number(seg.duration) || 10))),
    };
    if (isTech && seg.articulation) draft.articulation = seg.articulation;
    draft.confirmed = isTech ? !!draft.title : !!draft.compositionId;
    return draft;
  });
}

// The most recent session that actually has segments, to offer "repeat last session".
export function latestSession(sessions) {
  let best = null;
  (sessions || []).forEach(s => {
    if (!(s.segments || []).length) return;
    const d = s.date || '';
    if (!best || d > best.date || (d === best.date && (s.createdAt || '') > (best.createdAt || ''))) best = { ...s, date: d };
  });
  return best;
}
