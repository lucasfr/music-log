// Saving a running practice timer, so it can be offered back if the app is killed or reloaded
// mid-session. Pure (no React Native imports), so it's unit-tested in plain Node, see
// tests/timerSnapshot.test.mjs.
//
// The timer's plan and elapsed time lived only in memory, so the system closing the app, or the
// installed web app reloading (say on "A new version is available"), lost the whole session.
// A snapshot is written whenever the timer changes and every few seconds while it runs. Resume
// carries on from the time saved in the last snapshot; the gap between that snapshot and tapping
// Resume is not counted, because there is no way to know whether you carried on practising while
// the app was gone.

export const SNAPSHOT_KEY = 'timerSnapshot';
export const SNAPSHOT_EVERY_MS = 15000;
// Older than this and it is a different day's practice, not an interruption.
export const SNAPSHOT_MAX_AGE_MS = 6 * 60 * 60 * 1000;

// The state to save. While a segment is running its live time is added to what is already banked.
export function buildSnapshot({ segments, currentIndex, elapsedMs, runStart, isRunning, now }) {
  const elapsed = elapsedMs.slice();
  if (isRunning && runStart) elapsed[currentIndex] = (elapsed[currentIndex] || 0) + Math.max(0, now - runStart);
  return { v: 1, savedAt: now, segments, currentIndex, elapsedMs: elapsed };
}

const isNumber = n => typeof n === 'number' && Number.isFinite(n);

// The saved text -> a snapshot that is safe to restore, or null (nothing saved, damaged, the wrong
// shape, too old, or from the future).
export function parseSnapshot(raw, now, maxAge = SNAPSHOT_MAX_AGE_MS) {
  if (!raw) return null;
  let s;
  try { s = JSON.parse(raw); } catch { return null; }
  if (!s || s.v !== 1 || !isNumber(s.savedAt)) return null;
  if (now - s.savedAt > maxAge || s.savedAt - now > 60000) return null;
  if (!Array.isArray(s.segments) || s.segments.length === 0) return null;
  if (!s.segments.every(g => g && typeof g === 'object' && isNumber(g.plannedMinutes))) return null;
  if (!Number.isInteger(s.currentIndex) || s.currentIndex < 0 || s.currentIndex >= s.segments.length) return null;
  if (!Array.isArray(s.elapsedMs) || s.elapsedMs.length !== s.segments.length) return null;
  if (!s.elapsedMs.every(n => isNumber(n) && n >= 0)) return null;
  return s;
}

// A timer opened and closed within seconds isn't worth a "Resume?" card: it needs a minute of practice.
export const worthResuming = s => s.elapsedMs.reduce((t, n) => t + n, 0) >= 60000;

// What the Resume card says: which segments, how far through, and how long ago.
export function snapshotSummary(s, now) {
  const names = [...new Set(s.segments.map(g => g.title || (g.type === 'technique' ? 'Technical work' : 'Piece')))];
  const shown = names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3} more` : '');
  const used = Math.round(s.elapsedMs.reduce((t, n) => t + n, 0) / 60000);
  const planned = s.segments.reduce((t, g) => t + (g.plannedMinutes || 0), 0);
  const mins = Math.max(0, Math.floor((now - s.savedAt) / 60000));
  const ago = mins < 1 ? 'just now' : mins < 60 ? `${mins} min ago` : `${Math.floor(mins / 60)} h ago`;
  return { names: shown, used, planned, ago };
}
