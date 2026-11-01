// Clean repetitions on a tricky spot: play it at its tempo, tap Clean or Miss after each go, and after a
// run of clean ones the app suggests the next tempo up. The counts of a session live in the metronome while
// you work; they are added to the spot's totals (`spot.reps = { clean, total }`) when you log them or raise
// the tempo. Pure (no React Native imports), so it's unit-tested in plain Node, see tests/cleanReps.test.mjs.

export const REPS_TO_STEP = 5;   // this many clean in a row, and the tempo is ready to go up

export const emptyReps = () => ({ streak: 0, clean: 0, total: 0 });

// The counts after one more go. A miss ends the run of clean ones.
export function recordRep(state, clean) {
  const s = state || emptyReps();
  return {
    streak: clean ? s.streak + 1 : 0,
    clean: s.clean + (clean ? 1 : 0),
    total: s.total + 1,
  };
}

// Enough clean ones in a row to try the next tempo?
export const readyToStep = (state, needed = REPS_TO_STEP) => !!state && state.streak >= needed;

// Undo the last go is not offered (a tap is a tap), but starting again is: a fresh count.
export const resetReps = emptyReps;

// "3 clean in a row · 8 of 11 clean", or '' before the first go.
export function describeReps(state) {
  if (!state || !state.total) return '';
  const run = state.streak > 0 ? `${state.streak} clean in a row · ` : '';
  return `${run}${state.clean} of ${state.total} clean`;
}

// The share of goes that were clean, as a whole percentage; null with none yet.
export function cleanPercent(clean, total) {
  const c = Number(clean);
  const t = Number(total);
  if (!Number.isFinite(c) || !Number.isFinite(t) || t <= 0) return null;
  return Math.round((Math.max(0, Math.min(c, t)) / t) * 100);
}

// A spot's lifetime totals, for its row on the piece's page: "12 of 20 clean (60%)", or '' with none.
export function spotRepsLine(spot) {
  const r = spot && spot.reps;
  if (!r || !(r.total > 0)) return '';
  return `${r.clean} of ${r.total} clean (${cleanPercent(r.clean, r.total)}%)`;
}
