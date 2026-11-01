// Tap tempo: tap a beat and the metronome takes the tempo you tapped. Pure (no React Native imports),
// so it's unit-tested in plain Node, see tests/tapTempo.test.mjs.

export const TAP_RESET_MS = 2000;   // a pause this long starts a new count
export const MAX_TAPS = 6;          // only the latest taps count, so the tempo can follow you if it drifts
export const MIN_BPM = 30;          // the metronome's own range
export const MAX_BPM = 240;

// The taps so far, with one more at `now` (ms). A long gap, or a clock that went backwards, starts again.
export function addTap(taps, now) {
  const list = Array.isArray(taps) ? taps : [];
  const last = list[list.length - 1];
  if (last === undefined || now < last || now - last > TAP_RESET_MS) return [now];
  return [...list, now].slice(-MAX_TAPS);
}

// The tempo those taps give, in whole beats per minute within the metronome's range; null until there
// are two taps (one tap has no interval).
export function bpmFromTaps(taps) {
  if (!Array.isArray(taps) || taps.length < 2) return null;
  const span = taps[taps.length - 1] - taps[0];
  if (!(span > 0)) return null;
  const avgMs = span / (taps.length - 1);
  const bpm = Math.round(60000 / avgMs);
  return Math.max(MIN_BPM, Math.min(MAX_BPM, bpm));
}
