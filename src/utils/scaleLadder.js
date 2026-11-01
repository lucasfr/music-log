// A scale ladder: a guided scales routine with the metronome. Each scale starts at a gentle tempo; tap Clean
// when you play it cleanly and the tempo steps up; tap Not yet to stay or drop back. The clean tempo is kept
// per scale (a preference), and shows next time. Pure (no React Native imports), so it's unit-tested in
// plain Node, see tests/scaleLadder.test.mjs.
//
// A scale is identified by its name, motion, octaves and interval, as in the grade target's requirements, so
// "C major, 2 oct" and "C major, 2 oct, contrary" are two ladders.

export const START_BPM = 60;
export const STEP_BPM = 4;
export const MIN_BPM = 30;
export const MAX_BPM = 240;
export const ROUTINE_SIZE = 5;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

// The key for one requirement ({ name | scale, motion, octaves, interval }).
export function ladderKey(q) {
  const name = (q && (q.name || q.scale)) || '';
  return [name, Number(q && q.octaves) || 1, (q && q.motion) || 'parallel', (q && q.interval) || 'unison'].join('|');
}

// Stored JSON to { [key]: { bpm, best, date } }; anything malformed is dropped.
export function parseScaleTempos(raw) {
  const out = {};
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return out;
    for (const [key, v] of Object.entries(data)) {
      const bpm = Math.round(Number(v && v.bpm));
      const best = Math.round(Number(v && v.best));
      if (!(bpm >= MIN_BPM && bpm <= MAX_BPM) || !ISO.test(String((v && v.date) || ''))) continue;
      out[key] = { bpm, best: best >= bpm && best <= MAX_BPM ? best : bpm, date: v.date };
    }
  } catch { /* not JSON: nothing recorded */ }
  return out;
}

export const serializeScaleTempos = map => JSON.stringify(parseScaleTempos(JSON.stringify(map || {})));

// The clean tempo recorded for a scale, or null.
export const cleanTempoFor = (map, q) => (map && map[ladderKey(q)] ? map[ladderKey(q)].bpm : null);

// The map with a clean tempo recorded (`best` keeps the highest ever, `bpm` is the latest). A tempo outside
// the metronome's range records nothing.
export function recordClean(map, q, bpm, date) {
  const b = Math.round(Number(bpm));
  if (!(b >= MIN_BPM && b <= MAX_BPM) || !ISO.test(String(date || ''))) return map || {};
  const key = ladderKey(q);
  const had = (map || {})[key];
  return { ...(map || {}), [key]: { bpm: b, best: Math.max(b, had ? had.best : 0), date } };
}

// Where to start a scale: a step above its last clean tempo, or the gentle start.
export function startTempoFor(map, q) {
  const had = cleanTempoFor(map, q);
  return had ? Math.min(MAX_BPM, had + STEP_BPM) : START_BPM;
}

// The tempo after tapping Clean (up a step) or Not yet (down a step, never below the start of the range).
export const stepTempo = (bpm, clean) => Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(Number(bpm) || START_BPM) + (clean ? STEP_BPM : -STEP_BPM)));

// Which scales to run: those with no clean tempo yet first, then the one longest since it was last done.
// `reqs` are the target's scale and arpeggio requirements. -> up to `n` of them, in routine order.
export function pickLadder(reqs, map, n = ROUTINE_SIZE) {
  const rank = q => {
    const had = (map || {})[ladderKey(q)];
    return had ? { tier: 1, date: had.date } : { tier: 0, date: '' };
  };
  return [...(reqs || [])]
    .map((q, i) => ({ q, i, r: rank(q) }))
    .sort((a, b) => a.r.tier - b.r.tier || a.r.date.localeCompare(b.r.date) || a.i - b.i)
    .slice(0, Math.max(0, n))
    .map(x => x.q);
}

// One line for a scale: "last clean 84 bpm, best 92", or "no clean tempo yet".
export function describeLadder(map, q) {
  const had = (map || {})[ladderKey(q)];
  if (!had) return 'No clean tempo yet';
  return had.best > had.bpm ? `Last clean ${had.bpm} bpm, best ${had.best}` : `Last clean ${had.bpm} bpm`;
}
