// A readiness score for your grade target: one number and a plain breakdown, from what is already tracked.
// Today the Grade target card shows scales, pieces and sight-reading as separate pieces; this combines them (with
// the latest mock exam, when there is one) and says whether that is where you should be for the time left, and
// what is pulling it down. Pure (no React Native imports), so it's unit-tested in plain Node, see
// tests/readinessScore.test.mjs.
//
// Inputs are plain numbers taken from the existing results (readiness() in utils/insights.js and the mock exam
// history), so nothing here knows how they were worked out.

export const WEIGHTS = { scales: 35, pieces: 35, sight: 10, mock: 20 };
export const SIGHT_SESSIONS_FOR_FULL = 6;   // this many sight-reading sessions in four weeks counts as fully covered

const clamp01 = v => Math.max(0, Math.min(1, v));
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// How high the score should be for the time left: low early on, high near the date. With no date, a fair bar.
export function requiredScore(daysLeft) {
  if (daysLeft === null || daysLeft === undefined || !Number.isFinite(Number(daysLeft))) return 70;
  const d = Number(daysLeft);
  if (d <= 14) return 85;
  if (d <= 42) return 70;
  if (d <= 90) return 50;
  return 30;
}

// `input`: { scales: { recent, total }, pieces: { ready, needed }, sight: { sessions } | null,
//            mock: { flagged, count } | null, daysLeft: number | null }
// A part with nothing to measure (no scales in the target, no pieces needed, no mock exam yet) is left out, and
// the rest share its weight. -> null with nothing to measure, otherwise
// { score, parts: [{ key, label, value, percent, weight, detail }], status, required, weakest, line }
export function readinessScore(input) {
  const i = input || {};
  const parts = [];
  const scalesTotal = num(i.scales && i.scales.total);
  if (scalesTotal > 0) {
    const recent = Math.min(scalesTotal, num(i.scales.recent));
    parts.push({ key: 'scales', label: 'Scales and arpeggios', value: clamp01(recent / scalesTotal), weight: WEIGHTS.scales, detail: `${recent} of ${scalesTotal} practised in the last 3 weeks` });
  }
  const needed = num(i.pieces && i.pieces.needed);
  if (needed > 0) {
    const ready = Math.min(needed, num(i.pieces.ready));
    parts.push({ key: 'pieces', label: 'Pieces', value: clamp01(ready / needed), weight: WEIGHTS.pieces, detail: `${ready} of ${needed} performance-ready` });
  }
  if (i.sight && Number.isFinite(Number(i.sight.sessions))) {
    const s = Math.max(0, num(i.sight.sessions));
    parts.push({ key: 'sight', label: 'Sight-reading', value: clamp01(s / SIGHT_SESSIONS_FOR_FULL), weight: WEIGHTS.sight, detail: `${plural(s, 'session', 'sessions')} in the last 4 weeks` });
  }
  if (i.mock && num(i.mock.count) > 0) {
    const count = num(i.mock.count);
    const flagged = Math.min(count, Math.max(0, num(i.mock.flagged)));
    parts.push({ key: 'mock', label: 'Mock exam', value: clamp01(1 - flagged / count), weight: WEIGHTS.mock, detail: `${flagged} of ${count} flagged in your latest mock exam` });
  }
  if (!parts.length) return null;

  const totalWeight = parts.reduce((a, p) => a + p.weight, 0);
  const score = Math.round((100 * parts.reduce((a, p) => a + p.value * p.weight, 0)) / totalWeight);
  const withPercent = parts.map(p => ({ ...p, percent: Math.round(p.value * 100) }));
  const weakest = withPercent.reduce((w, p) => (p.value < w.value || (p.value === w.value && p.weight > w.weight) ? p : w), withPercent[0]);
  const daysLeft = i.daysLeft === undefined ? null : i.daysLeft;
  const required = requiredScore(daysLeft);
  const status = score >= required ? 'on track' : 'behind';
  const time = daysLeft !== null && Number.isFinite(Number(daysLeft)) && Number(daysLeft) >= 0 ? ` with ${plural(Number(daysLeft), 'day', 'days')} to go` : '';
  const line = status === 'on track'
    ? `Readiness ${score}: on track${time}.`
    : `Readiness ${score}: behind${time}. Weakest: ${weakest.label.toLowerCase()} (${weakest.detail}).`;
  return { score, parts: withPercent, status, required, weakest, line };
}
