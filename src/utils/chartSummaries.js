// One-sentence summaries of the Stats charts, for screen readers. A chart is a picture, so without
// these VoiceOver / TalkBack say nothing about it. Pure (no React Native imports), so they're
// unit-tested in plain Node, see tests/chartSummaries.test.mjs.
//
// Each takes the numbers the chart already draws from, and says what a sighted reader would take away:
// the total or average, the high point, the latest value, and which way it is heading.

import { COF_KEYS, COF_MINORS } from './scaleStats.js';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// 80 -> '1 hour 20 minutes', 45 -> '45 minutes'
export function spokenMinutes(m) {
  const r = Math.max(0, Math.round(Number(m) || 0));
  const h = Math.floor(r / 60);
  const mm = r % 60;
  if (!h) return plural(mm, 'minute', 'minutes');
  return mm ? `${plural(h, 'hour', 'hours')} ${plural(mm, 'minute', 'minutes')}` : plural(h, 'hour', 'hours');
}

const round1 = v => Math.round(v * 10) / 10;
const plain = v => String(round1(v));
const signed = v => (round1(v) > 0 ? `+${plain(v)}` : plain(v));
const nums = list => (list || []).filter(v => v !== null && v !== undefined && Number.isFinite(Number(v))).map(Number);

// Which way a series is going, comparing its first and last readings on a scale about 4 wide.
function direction(values, threshold = 0.5) {
  if (values.length < 2) return null;
  const delta = values[values.length - 1] - values[0];
  return delta > threshold ? 'rising' : delta < -threshold ? 'falling' : 'steady';
}

// Practice time per day (7-day view) or per week.
export function volumeSummary({ mins, period }) {
  const values = nums(mins);
  const unit = period === '7d' ? 'day' : 'week';
  const total = values.reduce((a, v) => a + v, 0);
  if (!values.length || total === 0) return `Practice time per ${unit}: nothing logged yet.`;
  const active = values.filter(v => v > 0);
  const avg = total / active.length;
  const peak = Math.max(...values);
  const latest = values[values.length - 1];
  return `Practice time per ${unit} over ${plural(values.length, unit, `${unit}s`)}. `
    + `Total ${spokenMinutes(total)}, average ${spokenMinutes(avg)} per active ${unit}. `
    + `Most in one ${unit}: ${spokenMinutes(peak)}. Latest ${unit}: ${latest > 0 ? spokenMinutes(latest) : 'none'}.`;
}

// Energy (-2 to +2) and liking (1 to 5) over time.
export function trendSummary({ energyPts, likingPts, period }) {
  const unit = period === '7d' ? 'day' : 'week';
  const part = (name, pts, fmt) => {
    const v = nums(pts);
    if (!v.length) return null;
    const avg = v.reduce((a, x) => a + x, 0) / v.length;
    const dir = direction(v);
    return `${name} averages ${fmt(avg)}, latest ${fmt(v[v.length - 1])}${dir ? `, ${dir}` : ''}.`;
  };
  const parts = [part('Energy', energyPts, signed), part('Liking', likingPts, plain)].filter(Boolean);
  if (!parts.length) return `Energy and liking by ${unit}: nothing rated yet.`;
  return `Energy and liking by ${unit}. ${parts.join(' ')}`;
}

// Session length against energy. `slope` is the fitted line's slope (energy per minute); the same
// threshold as the chart's own caption.
export function scatterSummary(points, slope) {
  const n = (points || []).length;
  const trend = slope > 0.005 ? 'Longer sessions tend to have higher energy.'
    : slope < -0.005 ? 'Longer sessions tend to have lower energy.'
    : 'No clear link between session length and energy.';
  return `Energy against session length, ${plural(n, 'session', 'sessions')} plotted. ${trend}`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function monthName(key) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(key || ''));
  return m && MONTHS[Number(m[2]) - 1] ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : String(key || '');
}

// The library over time: `points` are { m: 'YYYY-MM', total, added }, `activePts` the active count at each.
export function librarySummary(points, activePts) {
  const pts = points || [];
  if (!pts.length) return 'Library growth: no pieces yet.';
  const first = pts[0];
  const last = pts[pts.length - 1];
  const active = (activePts || [])[pts.length - 1];
  return `Library growth from ${monthName(first.m)} to ${monthName(last.m)}. `
    + `${plural(last.total, 'piece', 'pieces')} in total`
    + (Number.isFinite(active) ? `, ${active} active` : '') + '. '
    + `${last.added} added in ${monthName(last.m)}.`;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
// Sessions per weekday, Monday first. `byDay` is [{ count }, ...], `bestDay` the busiest index.
export function dayOfWeekSummary(byDay, bestDay) {
  const days = byDay || [];
  if (!days.length) return 'Sessions by day of the week: nothing logged yet.';
  const list = days.map((d, i) => `${DAYS[i] || `Day ${i + 1}`} ${(d && d.count) || 0}`).join(', ');
  const best = days[bestDay];
  return `Sessions by day of the week: ${list}.`
    + (best && best.count > 0 ? ` Most active: ${DAYS[bestDay]}.` : '');
}

// 'F#m' -> 'F sharp minor', 'Bb' -> 'B flat major'
export function spokenKey(key) {
  const minor = /m$/.test(key);
  let root = minor ? key.slice(0, -1) : key;
  root = root.replace('#', ' sharp');
  if (root.length === 2 && root.endsWith('b')) root = `${root[0]} flat`;
  return `${root} ${minor ? 'minor' : 'major'}`;
}

// The circle of fifths: how many of the 24 keys have been practised, and which most.
export function coverageSummary({ majorCounts, minorCounts, totalSessions, totalMinutes }) {
  const keys = [
    ...COF_KEYS.map((k, i) => ({ name: spokenKey(k), count: (majorCounts || [])[i] || 0 })),
    ...COF_MINORS.map((k, i) => ({ name: spokenKey(k), count: (minorCounts || [])[i] || 0 })),
  ];
  const practised = keys.filter(k => k.count > 0).sort((a, b) => b.count - a.count);
  if (!practised.length) return 'Circle of fifths: no scales practised in this period.';
  const list = practised.map(k => `${k.name} ${k.count}`).join(', ');
  return `Circle of fifths. ${practised.length} of 24 keys practised, `
    + `${plural(totalSessions || 0, 'session', 'sessions')} and ${spokenMinutes(totalMinutes || 0)}. `
    + `Sessions per key: ${list}.`;
}
