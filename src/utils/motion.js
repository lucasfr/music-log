// Motion tokens and timing helpers (pure: no React Native imports, so they're unit-tested in
// plain Node, see tests/motion.test.mjs). The components that use them are in
// components/Motion.js.

export const DURATION = {
  enter: 320,   // a card or button fading up into place
  fill: 650,    // a progress bar filling
};

export const STAGGER_STEP = 55;   // ms between neighbours in a list
export const STAGGER_MAX = 440;   // never make anyone wait longer than this

// Delay for the item at `index` when a group animates in one after another. Capped, so a long
// list doesn't take seconds to appear; negative or missing indexes count as the first.
export function delayFor(index, base = 0, step = STAGGER_STEP, max = STAGGER_MAX) {
  const i = Number.isFinite(index) && index > 0 ? index : 0;
  return Math.min(max, base + i * step);
}

// A progress fraction kept inside 0..1 (and 0 for anything that isn't a number), so a bad
// value can never drive a bar wider than its track.
export function clampFraction(f) {
  const n = Number(f);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
