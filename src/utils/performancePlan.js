// A performance countdown for one piece: give it a date and the app works back from there through four
// stages (notes learned, hands together, up to tempo, memorised), says where you should be this week, and
// whether you are behind. Nothing is ticked by hand: each stage is read from what the app already knows
// about the piece (its status, its tempo against its own, whether it is marked memorised).
//
// The piece carries `performDate` and `performFrom` (the day the date was set, which is where the schedule
// starts). Pure (no React Native imports), so it's unit-tested in plain Node, see
// tests/performancePlan.test.mjs. Dates are local 'YYYY-MM-DD' strings, counted by calendar date.

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const validDate = s => typeof s === 'string' && ISO.test(s) && !Number.isNaN(new Date(`${s}T12:00:00Z`).getTime());
const dayNumber = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;
const daysBetween = (a, b) => Math.round(dayNumber(b) - dayNumber(a));
const addDays = (s, n) => {
  const t = new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)));
  t.setUTCDate(t.getUTCDate() + n);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
};

// How far through the time from `performFrom` to the performance each stage is due, leaving the last days free.
export const STAGES = [
  { key: 'notes', label: 'Notes learned', due: 0.30 },
  { key: 'hands', label: 'Hands together', due: 0.55 },
  { key: 'tempo', label: 'Up to tempo', due: 0.80 },
  { key: 'memory', label: 'Memorised', due: 0.95 },
];

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const niceDate = s => `${Number(s.slice(8, 10))} ${SHORT_MONTHS[Number(s.slice(5, 7)) - 1]}`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// The piece with a performance date set (starting the schedule today), or cleared with a blank date.
export function withPerformance(piece, date, today) {
  if (!date) {
    const { performDate: _d, performFrom: _f, ...rest } = piece || {};
    return rest;
  }
  if (!validDate(date)) return piece;
  return { ...piece, performDate: date, performFrom: validDate(today) ? today : date };
}

// Which stages are done for this piece. `tempo` is { latest, target } (what pieceReport gives), or nothing.
export function stagesDone(piece, tempo) {
  const status = piece && piece.status;
  const started = !!status && status !== 'new' && status !== 'ambition';
  const together = status === 'consolidating' || status === 'performance-ready';
  const ready = status === 'performance-ready';
  const atTempo = ready || (!!tempo && Number(tempo.target) > 0 && Number(tempo.latest) >= Number(tempo.target));
  return { notes: started, hands: together, tempo: atTempo, memory: !!(piece && piece.memorised) };
}

// -> null when the piece has no (valid) performance date; otherwise
//    { date, from, daysLeft, passed, stages: [{ key, label, done, due, overdue }], next, behind, line }
export function performanceProgress(piece, today, tempo = null) {
  const date = piece && piece.performDate;
  if (!validDate(date) || !validDate(today)) return null;
  const from = validDate(piece.performFrom) && piece.performFrom <= date ? piece.performFrom : today;
  const span = Math.max(1, daysBetween(from, date));
  const done = stagesDone(piece, tempo);
  const stages = STAGES.map(s => {
    const due = addDays(from, Math.round(span * s.due));
    return { key: s.key, label: s.label, done: done[s.key], due, overdue: !done[s.key] && due < today };
  });
  const daysLeft = daysBetween(today, date);
  const passed = daysLeft < 0;
  const next = stages.find(s => !s.done) || null;
  const behind = !passed && stages.some(s => s.overdue);
  let line;
  if (!next) line = passed ? 'Every stage was done for the performance.' : `Every stage is done, ${plural(daysLeft, 'day', 'days')} to spare.`;
  else if (passed) line = `The date has passed (${niceDate(date)}). ${next.label} was not done.`;
  else if (behind) line = `${plural(daysLeft, 'day', 'days')} to go. Behind: ${next.label.toLowerCase()} was due ${niceDate(next.due)}.`;
  else line = `${plural(daysLeft, 'day', 'days')} to go. Next: ${next.label.toLowerCase()}, by ${niceDate(next.due)}.`;
  return { date, from, daysLeft, passed, stages, next, behind, line };
}

// For Today's plan: a piece with a performance coming up, and why it should be played today.
// -> { score, reason } or null.
export function performancePlanNudge(piece, today, tempo = null) {
  const p = performanceProgress(piece, today, tempo);
  if (!p || p.passed || !p.next) return null;
  if (p.behind) return { score: 2, reason: `behind for your performance on ${niceDate(p.date)}` };
  if (p.daysLeft <= 14) return { score: 1, reason: `performance in ${plural(p.daysLeft, 'day', 'days')}` };
  return null;
}
