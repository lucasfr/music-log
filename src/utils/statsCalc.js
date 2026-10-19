// The calculations behind the Stats screen. Pure (no React Native imports), so they're unit-tested in
// plain Node, see tests/statsCalc.test.mjs.
//
// These used to sit inside the components in StatsScreen.js, where a mistake could only be seen by
// looking at a chart. Every function takes `today` ('YYYY-MM-DD') instead of reading the clock, and
// all date arithmetic is by calendar date, never by milliseconds. That matters in two ways the old
// inline code got wrong:
//  - a day is not always 24 hours: on the days the clocks change it is 23 or 25, so counting
//    consecutive days by `diff === 1` split a streak in two across them, and "days since" came out
//    one too low after the spring change;
//  - "now" has a time of day: comparing a date's noon with the current moment made several results
//    depend on whether you opened the app before or after 12:00.
// Dates are local 'YYYY-MM-DD' strings throughout.

const num = v => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const mean = a => (a.length ? a.reduce((t, v) => t + v, 0) / a.length : null);

const parts = iso => [Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), Number(iso.slice(8, 10))];
const pad2 = n => String(n).padStart(2, '0');

// The date n days after (or before, if negative) a date. By calendar, so daylight saving can't shift it.
export function addDays(iso, n) {
  const [y, m, d] = parts(iso);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + n);
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`;
}

// Whole calendar days from a to b (negative when b is earlier).
export function daysBetween(a, b) {
  const t = iso => { const [y, m, d] = parts(iso); return Date.UTC(y, m - 1, d) / 86400000; };
  return Math.round(t(b) - t(a));
}

// ── Periods ──────────────────────────────────────────────────────────────────────────────────
// The Stats screen's period is '7d', '30d' or 'all'. The cutoff is the date that many days ago,
// and a record on the cutoff date is inside the period.

export function periodCutoff(period, today) {
  if (period === 'all') return null;
  return addDays(today, -(period === '7d' ? 7 : 30));
}

export function inPeriod(items, period, today) {
  const cutoff = periodCutoff(period, today);
  return cutoff ? (items || []).filter(r => r.date >= cutoff) : (items || []);
}

// ISO 8601 week of a date, as '2026-W42'. Weeks start on Monday and week 1 holds the first Thursday,
// so early January can belong to the previous year's last week and late December to the next year's
// first. Worked out in UTC at midnight: the original did it at noon local time, which added half a
// day and made every week of a year that starts on a Friday (2021, 2027, 2038) one too high.
export function isoWeek(dateStr) {
  const [y, m, d] = parts(dateStr);
  const thursday = new Date(Date.UTC(y, m - 1, d));
  thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7));
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((thursday - yearStart) / 86400000 + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// ── Charts ───────────────────────────────────────────────────────────────────────────────────

// Minutes practised per day (the 7-day view) or per ISO week (30 days, all time; at most 12 weeks
// unless all time). The 7-day view always shows today and the six days before it, with zeros for
// days without practice. -> { visible: keys in order, mins: minutes for each }
export function volumeBuckets(sessions, period, today) {
  const isDaily = period === '7d';
  const cutoff = periodCutoff(period, today);
  const buckets = {};
  if (isDaily) for (let i = 6; i >= 0; i--) buckets[addDays(today, -i)] = 0;
  (sessions || []).forEach(s => {
    if (cutoff && s.date < cutoff) return;
    const key = isDaily ? s.date : isoWeek(s.date);
    buckets[key] = (buckets[key] || 0) + num(s.duration);
  });
  const keys = Object.keys(buckets).sort();
  const visible = isDaily ? keys : keys.slice(-(period === 'all' ? keys.length : 12));
  return { visible, mins: visible.map(k => buckets[k] || 0) };
}

// Average energy and average liking of pieces per day or week, on the same buckets. A bucket with
// no values is null (a gap in the line), not zero.
// -> { visible, energyPts, likingPts, hasData }
export function trendBuckets(sessions, period, today) {
  const isDaily = period === '7d';
  const cutoff = periodCutoff(period, today);
  const buckets = {};
  if (isDaily) for (let i = 6; i >= 0; i--) buckets[addDays(today, -i)] = { energy: [], liking: [] };
  (sessions || []).forEach(s => {
    if (cutoff && s.date < cutoff) return;
    const key = isDaily ? s.date : isoWeek(s.date);
    if (!buckets[key]) buckets[key] = { energy: [], liking: [] };
    if (s.energy != null) buckets[key].energy.push(Number(s.energy));
    (s.segments || []).forEach(seg => {
      if (seg.type === 'repertoire' && seg.liking) buckets[key].liking.push(Number(seg.liking));
    });
  });
  const keys = Object.keys(buckets).sort();
  const visible = isDaily ? keys : keys.slice(-(period === 'all' ? keys.length : 12));
  const energyPts = visible.map(k => mean(buckets[k].energy));
  const likingPts = visible.map(k => mean(buckets[k].liking));
  return { visible, energyPts, likingPts, hasData: energyPts.some(v => v !== null) || likingPts.some(v => v !== null) };
}

// Sessions and minutes by weekday, Monday first. -> { byDay: [{ count, minutes, energy: [] } x 7], maxCount, bestDay }
export function dayOfWeekBuckets(sessions) {
  const byDay = Array.from({ length: 7 }, () => ({ count: 0, minutes: 0, energy: [] }));
  (sessions || []).forEach(s => {
    const dow = (new Date(s.date + 'T12:00:00').getDay() + 6) % 7;
    byDay[dow].count++;
    byDay[dow].minutes += num(s.duration);
    if (s.energy != null) byDay[dow].energy.push(Number(s.energy));
  });
  return {
    byDay,
    maxCount: Math.max(...byDay.map(d => d.count), 1),
    bestDay: byDay.indexOf(byDay.reduce((a, b) => (b.count > a.count ? b : a))),
  };
}

// ── Streaks ──────────────────────────────────────────────────────────────────────────────────

// Every run of two or more consecutive practice days, oldest first: [{ start, end, len }].
export function streakRuns(sessions) {
  const dates = [...new Set((sessions || []).map(s => s.date))].sort();
  if (!dates.length) return [];
  const runs = [];
  let start = dates[0];
  let prev = dates[0];
  let len = 1;
  for (let i = 1; i < dates.length; i++) {
    if (daysBetween(prev, dates[i]) === 1) { len++; prev = dates[i]; }
    else {
      if (len > 1) runs.push({ start, end: prev, len });
      start = dates[i]; prev = dates[i]; len = 1;
    }
  }
  if (len > 1) runs.push({ start, end: prev, len });
  return runs;
}

// The longest `n` runs, longest first (equal lengths stay oldest first), and the longest length.
export function topStreaks(runs, n = 6) {
  return {
    top: [...runs].sort((a, b) => b.len - a.len).slice(0, n),
    maxLen: runs.length ? Math.max(...runs.map(r => r.len)) : 0,
  };
}

// The longest run of consecutive practice days within the period, up to and including today.
// `sessions` are the ones in the period. For 'all' the walk starts at the first session.
export function longestStreak(sessions, period, today) {
  const dates = new Set((sessions || []).map(s => s.date));
  if (dates.size === 0) return 0;
  const start = period === 'all' ? [...dates].sort()[0] : addDays(today, -(period === '7d' ? 7 : 30));
  let best = 0;
  let current = 0;
  for (let d = start; d <= today; d = addDays(d, 1)) {
    if (dates.has(d)) { current++; if (current > best) best = current; } else current = 0;
  }
  return best;
}

// ── Summary numbers ──────────────────────────────────────────────────────────────────────────

// Total minutes, and the average energy and enjoyment over the sessions that have one. A session
// with no energy (or enjoyment) logged is left out of that average, not counted as zero.
// -> { totalMin, avgEnergy | null, avgEnjoyment | null }
export function periodAverages(sessions) {
  const list = sessions || [];
  const energies = list.filter(s => s.energy != null).map(s => Number(s.energy));
  const enjoyments = list.filter(s => s.enjoyment != null).map(s => Number(s.enjoyment));
  return {
    totalMin: list.reduce((t, s) => t + num(s.duration), 0),
    avgEnergy: mean(energies),
    avgEnjoyment: mean(enjoyments),
  };
}

// Whole days from the latest record's date to today; null when there are none.
export function daysSinceLatest(records, today) {
  const dates = (records || []).map(r => r.date).filter(Boolean).sort();
  return dates.length ? daysBetween(dates[dates.length - 1], today) : null;
}

// ── Pieces ───────────────────────────────────────────────────────────────────────────────────

// Active pieces (learning or consolidating) not practised for at least `minDays` days, or never.
// Never-practised first, then the longest-neglected. A segment linked to a piece counts as working
// on it whether it was logged as repertoire or technique. -> [{ id, title, status, daysSince | null }]
export function neglectedPieces(sessions, compositions, today, minDays = 7) {
  const lastSeen = {};
  (sessions || []).forEach(s => (s.segments || []).forEach(seg => {
    if (!seg.compositionId) return;
    if (!lastSeen[seg.compositionId] || s.date > lastSeen[seg.compositionId]) lastSeen[seg.compositionId] = s.date;
  }));
  const active = new Set(['learning', 'consolidating']);
  return (compositions || [])
    .filter(c => active.has(c.status))
    .map(c => {
      const last = lastSeen[c.id] || null;
      return { id: c.id, title: c.title, status: c.status, daysSince: last ? daysBetween(last, today) : null };
    })
    .filter(p => p.daysSince === null || p.daysSince >= minDays)
    .sort((a, b) => {
      if (a.daysSince === null) return -1;
      if (b.daysSince === null) return 1;
      return b.daysSince - a.daysSince;
    });
}

// The five most practised pieces in these sessions, by number of segments and by time. Pieces
// marked as an ambition are skipped; a segment with no library piece is counted under its title.
// Each entry: { name, count, mins, avgLiking, avgEnergy, avgSessionEnjoyment, avgDifficulty } where
// the averages are null when there is nothing to average. -> { byCount, byTime }
export function pieceStats(sessions, compositions) {
  const freq = {};
  const minutes = {};
  const liking = {};
  const energy = {};
  const enjoyment = {};
  const difficulty = {};
  const push = (map, key, v) => { (map[key] = map[key] || []).push(v); };

  (sessions || []).forEach(s => (s.segments || []).forEach(seg => {
    if (seg.type !== 'repertoire') return;
    const comp = (compositions || []).find(c => c.id === seg.compositionId);
    if (comp && comp.status === 'ambition') return;
    const name = seg.compositionId ? (comp || {}).title || seg.compositionId : seg.title;
    if (!name) return;
    freq[name] = (freq[name] || 0) + 1;
    minutes[name] = (minutes[name] || 0) + num(seg.duration);
    if (seg.liking) push(liking, name, Number(seg.liking));
    if (s.energy != null) push(energy, name, Number(s.energy));
    if (s.enjoyment != null) push(enjoyment, name, Number(s.enjoyment));
    if (seg.feltDifficulty) push(difficulty, name, Number(seg.feltDifficulty));
  }));

  const entry = name => ({
    name,
    count: freq[name] || 0,
    mins: minutes[name] || 0,
    avgLiking: mean(liking[name] || []),
    avgEnergy: mean(energy[name] || []),
    avgSessionEnjoyment: mean(enjoyment[name] || []),
    avgDifficulty: mean(difficulty[name] || []),
  });
  const top = map => Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name]) => entry(name));
  return { byCount: top(freq), byTime: top(minutes) };
}

// ── Lessons ──────────────────────────────────────────────────────────────────────────────────

// What lessons in the period covered. -> { count, avgEnergy, avgEnjoyment, topPieces, lessonOnly, maxCount }
//  - topPieces: the five pieces appearing in most lessons, [{ id, title, count }];
//  - lessonOnly: pieces that came up in a lesson but have never been in a practice session,
//    A to Z by title, [{ id, title }].
export function lessonInsights(lessons, sessions, compositions, period, today) {
  const inRange = inPeriod(lessons, period, today);
  const titleOf = id => ((compositions || []).find(c => c.id === id) || {}).title || id;

  const counts = {};
  inRange.forEach(l => (l.segments || []).forEach(seg => {
    if (seg.type !== 'repertoire' || !seg.compositionId) return;
    counts[seg.compositionId] = (counts[seg.compositionId] || 0) + 1;
  }));
  const topPieces = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({ id, title: titleOf(id), count }));

  const practised = new Set();
  (sessions || []).forEach(s => (s.segments || []).forEach(seg => {
    if (seg.type === 'repertoire' && seg.compositionId) practised.add(seg.compositionId);
  }));
  const lessonOnly = Object.keys(counts)
    .filter(id => !practised.has(id))
    .map(id => ({ id, title: titleOf(id) }))
    .sort((a, b) => a.title.localeCompare(b.title));

  return {
    count: inRange.length,
    avgEnergy: mean(inRange.filter(l => l.energy != null).map(l => Number(l.energy))),
    avgEnjoyment: mean(inRange.filter(l => l.enjoyment != null).map(l => Number(l.enjoyment))),
    topPieces,
    lessonOnly,
    maxCount: (topPieces[0] && topPieces[0].count) || 1,
  };
}
