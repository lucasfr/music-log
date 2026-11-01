// Accent patterns for the metronome: for each main beat of the bar, a strong click, a weak one, or none, so a
// bar can be 1-and-3 accented, or have a beat left out to be felt rather than heard. The default is every
// beat strong, which is how the metronome has always clicked. Pure (no React Native imports), so it's
// unit-tested in plain Node, see tests/beatPattern.test.mjs.

export const STRONG = 'strong';
export const WEAK = 'weak';
export const MUTE = 'mute';
const ORDER = [STRONG, WEAK, MUTE];

// A pattern of `beats` main beats, all strong (the metronome as it was).
export const allStrong = beats => Array.from({ length: Math.max(1, Math.round(Number(beats)) || 1) }, () => STRONG);

// Strong on the first beat, weak on the rest ("1 only").
export const firstOnly = beats => allStrong(beats).map((s, i) => (i === 0 ? STRONG : WEAK));

// Strong on the first beat, and on the middle of an even bar, weak elsewhere (4 beats: 1 and 3).
export function halfBar(beats) {
  const n = Math.max(1, Math.round(Number(beats)) || 1);
  const mid = n % 2 === 0 ? n / 2 : -1;
  return allStrong(n).map((s, i) => (i === 0 || i === mid ? STRONG : WEAK));
}

// A stored pattern made to fit `beats` main beats: cut short, or padded with strong ones; anything unknown
// becomes strong.
export function fitPattern(pattern, beats) {
  const n = Math.max(1, Math.round(Number(beats)) || 1);
  const src = Array.isArray(pattern) ? pattern : [];
  return Array.from({ length: n }, (_, i) => (ORDER.includes(src[i]) ? src[i] : STRONG));
}

// The pattern after tapping beat `index`: strong, then weak, then mute, then strong again.
export function cycleBeat(pattern, index) {
  const fit = fitPattern(pattern, (pattern || []).length || 1);
  if (index < 0 || index >= fit.length) return fit;
  const next = ORDER[(ORDER.indexOf(fit[index]) + 1) % ORDER.length];
  return fit.map((s, i) => (i === index ? next : s));
}

// What the click for main beat `beatIndex` of the bar sounds like: 'strong', 'weak', or 'mute'. A beat beyond
// the pattern, or no pattern, is strong.
export function beatSound(pattern, beatIndex) {
  const s = Array.isArray(pattern) ? pattern[beatIndex] : undefined;
  return ORDER.includes(s) ? s : STRONG;
}

// Is every beat strong? (Then the pattern is "off", and the metronome sounds as it always has.)
export const isDefault = pattern => !Array.isArray(pattern) || pattern.every(s => s === STRONG);

// A short description for the button: "Accents: 1 · 3" for strong beats, with muted ones noted.
export function describePattern(pattern) {
  if (isDefault(pattern)) return 'Accents';
  const strong = pattern.map((s, i) => (s === STRONG ? i + 1 : null)).filter(Boolean);
  const muted = pattern.map((s, i) => (s === MUTE ? i + 1 : null)).filter(Boolean);
  const parts = [`Accents: ${strong.length ? strong.join(' \u00b7 ') : 'none'}`];
  if (muted.length) parts.push(`silent: ${muted.join(' \u00b7 ')}`);
  return parts.join(', ');
}
