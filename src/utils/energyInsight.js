// What your energy rating goes with: do sessions on high-energy days look different from low-energy ones?
// Pure (no imports), so it is unit-tested in plain Node, see tests/energyInsight.test.mjs.
//
// It compares three things you log for every session: how long you practised, how much progress you
// ticked off (the progress tags on its segments), and how hard the pieces felt (felt difficulty); plus
// how much you enjoyed it. A line is written only where the two ends really differ, in the direction
// they differ, with the numbers. It never says why: energy and the rest are both your own ratings at the
// time, so what comes out is a pattern in your log, not a cause.
//
// Nothing is shown until there is enough to compare (MIN_RATED sessions with an energy rating, and at
// least MIN_GROUP at each end), because a handful of sessions would only be noise dressed up as insight.

export const MIN_RATED = 12;   // sessions with an energy rating before anything is said
export const MIN_GROUP = 3;    // sessions (or segments) at each end before a metric is compared

// Energy runs from -2 (very low) to 2 (very high); 0 is neutral and counts, it is not "unset".
const GROUPS = [
  { key: 'low',  label: 'Low energy',  test: e => e <= -1 },
  { key: 'okay', label: 'Neutral',     test: e => e > -1 && e < 1 },
  { key: 'high', label: 'High energy', test: e => e >= 1 },
];

function energyOf(s) {
  const v = s && s.energy;
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const positive = v => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };
const mean = list => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);
const tags = v => (Array.isArray(v) ? v.length : 0);

// How a metric is compared and worded: `minDiff` is the smallest difference worth mentioning (and `rel`, for
// minutes, the smallest relative one); `say` writes the line from the two ends.
const one = n => (Math.round(n * 10) / 10).toFixed(1);
const METRICS = [
  {
    key: 'minutes', minDiff: 5, rel: 0.2,
    say: (hi, lo) => (hi > lo
      ? `You practise longer when your energy is high: ${Math.round(hi)} min a session on average, against ${Math.round(lo)} min when it is low.`
      : `You practise longer when your energy is low: ${Math.round(lo)} min a session on average, against ${Math.round(hi)} min when it is high.`),
  },
  {
    key: 'progress', minDiff: 0.5,
    say: (hi, lo) => (hi > lo
      ? `More progress is ticked off on high-energy days: ${one(hi)} progress tags a session, against ${one(lo)} on low-energy days.`
      : `More progress is ticked off on low-energy days: ${one(lo)} progress tags a session, against ${one(hi)} on high-energy days.`),
  },
  {
    key: 'enjoyment', minDiff: 0.5,
    say: (hi, lo) => (hi > lo
      ? `You enjoy high-energy sessions more: ${one(hi)} out of 5, against ${one(lo)} on low-energy days.`
      : `You enjoy low-energy sessions more: ${one(lo)} out of 5, against ${one(hi)} on high-energy days.`),
  },
  {
    key: 'felt', minDiff: 0.4,
    say: (hi, lo) => (hi < lo
      ? `Pieces feel easier when your energy is high: felt difficulty ${one(hi)}, against ${one(lo)} on low-energy days.`
      : `Pieces feel harder when your energy is high: felt difficulty ${one(hi)}, against ${one(lo)} on low-energy days.`),
  },
];

export const ENERGY_NOTE = 'Energy and enjoyment are both how you felt when you logged, so they tend to move together. This is an average over your own sessions: a pattern in your log, not a cause.';

// -> { ready: false, rated, needed, reason }
//    or { ready: true, rated, groups: [{ key, label, sessions, minutes, progress, enjoyment, felt }], lines, note }
// `groups` has the three ends in order; a metric that has nothing behind it is null.
export function energyInsight(sessions) {
  const rated = (sessions || []).filter(s => s && energyOf(s) !== null);
  if (rated.length < MIN_RATED) {
    return {
      ready: false, rated: rated.length, needed: MIN_RATED - rated.length,
      reason: `This needs about ${MIN_RATED} sessions with an energy rating to say anything worth reading. You have ${rated.length}.`,
    };
  }

  const groups = GROUPS.map(g => {
    const mine = rated.filter(s => g.test(energyOf(s)));
    const segs = mine.flatMap(s => (Array.isArray(s.segments) ? s.segments : []));
    const minutes = mine.map(s => positive(s.duration)).filter(v => v !== null);
    const enjoyment = mine.map(s => positive(s.enjoyment)).filter(v => v !== null);
    const felt = segs.map(sg => positive(sg && sg.feltDifficulty)).filter(v => v !== null);
    return {
      key: g.key, label: g.label, sessions: mine.length,
      minutes: mean(minutes), progress: mean(mine.map(s => (Array.isArray(s.segments) ? s.segments : []).reduce((n, sg) => n + tags(sg && sg.progress), 0))),
      enjoyment: mean(enjoyment), felt: mean(felt),
      counts: { minutes: minutes.length, enjoyment: enjoyment.length, felt: felt.length, progress: mine.length },
    };
  });

  const low = groups.find(g => g.key === 'low');
  const high = groups.find(g => g.key === 'high');
  if (high.sessions < MIN_GROUP || low.sessions < MIN_GROUP) {
    return {
      ready: false, rated: rated.length, needed: 0,
      reason: 'Almost all of your rated sessions are at one energy level, so there is nothing to compare yet. It needs a few high-energy and a few low-energy ones.',
    };
  }

  const lines = [];
  for (const m of METRICS) {
    const hi = high[m.key];
    const lo = low[m.key];
    if (hi === null || lo === null) continue;
    if (high.counts[m.key] < MIN_GROUP || low.counts[m.key] < MIN_GROUP) continue;
    const diff = Math.abs(hi - lo);
    if (diff < m.minDiff) continue;
    if (m.rel && diff < m.rel * Math.min(hi, lo)) continue;
    lines.push(m.say(hi, lo));
  }
  if (!lines.length) lines.push('No clear difference yet between your high-energy and low-energy sessions: they look much alike on time, progress and enjoyment.');

  return {
    ready: true, rated: rated.length,
    groups: groups.map(({ counts, ...rest }) => rest),   // eslint-disable-line no-unused-vars
    lines, note: ENERGY_NOTE,
  };
}
