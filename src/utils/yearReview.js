// The year in review: a summary of a calendar year from what is already logged, to read every December. Hours,
// sessions and days practised, the busiest month, the longest run of days, the piece played most, how many scales
// and pieces were covered, the biggest tempo gain, pieces memorised, and a few of the wins you wrote down. Pure
// (no React Native imports), so it's unit-tested in plain Node, see tests/yearReview.test.mjs.
//
// Dates are local 'YYYY-MM-DD' strings, counted by calendar date. `restDays` are weekdays off (0 = Sunday), which
// don't break a run of days, as everywhere else in the app.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const dayNumber = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;
const weekday = s => new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))).getUTCDay();
const round1 = v => Math.round(v * 10) / 10;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// The longest run of practice days; a gap that is only rest days doesn't break it, and rest days aren't counted.
function longestRun(dates, restDays) {
  const rest = new Set(restDays || []);
  const days = [...new Set(dates)].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of days) {
    if (prev !== null) {
      let bridged = true;
      for (let n = dayNumber(prev) + 1; n < dayNumber(d); n += 1) {
        const w = new Date(n * 86400000).getUTCDay();
        if (!rest.has(w)) { bridged = false; break; }
      }
      run = bridged ? run + 1 : 1;
    } else run = 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

const scaleNames = seg => (seg.scales || []).map(e => (typeof e === 'string' ? e : e && e.scale)).filter(Boolean);

// -> { year, empty, hours, sessions, lessons, activeDays, longestRun, busiestMonth, topPiece, piecesPlayed, scalesPlayed,
//      memorised, biggestGain, wins, highlights }
export function yearReview(sessions, lessons, compositions, year, restDays = []) {
  const y = String(year);
  const inYear = d => typeof d === 'string' && ISO.test(d) && d.slice(0, 4) === y;
  const ss = (sessions || []).filter(s => s && inYear(s.date));
  const ls = (lessons || []).filter(l => l && inYear(l.date));
  const titles = new Map((compositions || []).map(c => [c.id, c.title]));

  const minutes = ss.reduce((a, s) => a + num(s.duration), 0);
  const byMonth = new Array(12).fill(0);
  ss.forEach(s => { byMonth[Number(s.date.slice(5, 7)) - 1] += num(s.duration); });
  const topMonthIndex = byMonth.reduce((best, m, i) => (m > byMonth[best] ? i : best), 0);

  const pieceMinutes = new Map();
  const scales = new Set();
  const series = new Map();   // key -> [{ date, bpm }]
  ss.forEach(s => (s.segments || []).forEach(seg => {
    if (seg.type === 'repertoire' && seg.compositionId) {
      pieceMinutes.set(seg.compositionId, (pieceMinutes.get(seg.compositionId) || 0) + num(seg.duration));
    }
    scaleNames(seg).forEach(n => scales.add(n));
    const bpm = num(seg.tempo);
    if (bpm > 0) {
      const key = seg.compositionId ? `piece:${seg.compositionId}` : `${seg.group || ''}|${seg.title || ''}`;
      if (!series.has(key)) series.set(key, { name: seg.compositionId ? (titles.get(seg.compositionId) || seg.title || 'a piece') : [seg.group, seg.title].filter(Boolean).join(' '), points: [] });
      series.get(key).points.push({ date: s.date, bpm });
    }
  }));

  let topPiece = null;
  for (const [id, m] of pieceMinutes) if (!topPiece || m > topPiece.minutes) topPiece = { id, title: titles.get(id) || 'Untitled', minutes: m };

  let biggestGain = null;
  for (const { name, points } of series.values()) {
    const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length < 2) continue;
    const gain = sorted[sorted.length - 1].bpm - sorted[0].bpm;
    if (gain > 0 && (!biggestGain || gain > biggestGain.gain)) biggestGain = { name: name || 'an exercise', from: sorted[0].bpm, to: sorted[sorted.length - 1].bpm, gain };
  }

  const wins = ss.filter(s => s.wins && String(s.wins).trim()).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map(s => ({ date: s.date, text: String(s.wins).trim() }));
  const memorised = (compositions || []).filter(c => c && c.memorised && inYear(c.memorisedAt)).length;
  const dates = ss.map(s => s.date);
  const activeDays = new Set(dates).size;
  const run = longestRun(dates, restDays);

  const highlights = [];
  if (ss.length) {
    highlights.push(`${round1(minutes / 60)} hours over ${plural(ss.length, 'session', 'sessions')} on ${plural(activeDays, 'day', 'days')}.`);
    if (byMonth[topMonthIndex] > 0) highlights.push(`Busiest month: ${MONTHS[topMonthIndex]}, ${round1(byMonth[topMonthIndex] / 60)} hours.`);
    if (run > 1) highlights.push(`Longest run: ${plural(run, 'day', 'days')} in a row.`);
    if (topPiece) highlights.push(`Played most: ${topPiece.title}, ${round1(topPiece.minutes / 60)} hours.`);
    if (pieceMinutes.size) highlights.push(`${plural(pieceMinutes.size, 'piece', 'pieces')} practised.`);
    if (scales.size) highlights.push(`${plural(scales.size, 'scale or arpeggio', 'scales and arpeggios')} covered.`);
    if (biggestGain) highlights.push(`Biggest tempo gain: ${biggestGain.name}, ${biggestGain.from} to ${biggestGain.to} bpm.`);
    if (memorised) highlights.push(`${plural(memorised, 'piece', 'pieces')} memorised.`);
  }
  if (ls.length) highlights.push(`${plural(ls.length, 'lesson', 'lessons')}.`);

  return {
    year: Number(y), empty: ss.length === 0 && ls.length === 0,
    hours: round1(minutes / 60), sessions: ss.length, lessons: ls.length, activeDays, longestRun: run,
    busiestMonth: byMonth[topMonthIndex] > 0 ? { month: MONTHS[topMonthIndex], hours: round1(byMonth[topMonthIndex] / 60) } : null,
    topPiece, piecesPlayed: pieceMinutes.size, scalesPlayed: scales.size, memorised, biggestGain, wins, highlights,
  };
}
