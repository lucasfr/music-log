// Silent bars for the metronome: it clicks for some bars, then goes quiet for some, and repeats, so you
// have to keep the pulse yourself through the quiet ones. A standard way to find out whether your tempo
// holds without the click. Pure (no React Native imports), so it's unit-tested in plain Node, see
// tests/silentBars.test.mjs.

export const MIN_BARS = 1;
export const MAX_BARS = 8;

const clamp = n => Math.max(MIN_BARS, Math.min(MAX_BARS, Math.round(Number(n)) || MIN_BARS));

// Is this step inside a silent bar? A step is one subdivision tick, `stepsPerBar` of them make a bar
// (subdivision × main beats), and bar 0 is the first bar after the metronome starts. Anything that
// isn't a usable setting means "never silent", so a bad value can only leave the click on.
export function isSilentStep(stepIndex, stepsPerBar, playBars, silentBars) {
  if (!(stepsPerBar > 0) || !(playBars > 0) || !(silentBars > 0) || !(stepIndex >= 0)) return false;
  const bar = Math.floor(stepIndex / stepsPerBar);
  return bar % (playBars + silentBars) >= playBars;
}

// The setting after a change, kept inside 1–8 bars.
export const nextBars = (current, delta) => clamp((Number(current) || MIN_BARS) + delta);

// 'Click 2 bars, silent 2' for the button.
export function describeSilentBars(playBars, silentBars) {
  const bars = n => `${n} bar${n === 1 ? '' : 's'}`;
  return `Click ${bars(playBars)}, silent ${silentBars}`;
}
