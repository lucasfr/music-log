// Small pure helpers for the error boundary (components/ErrorBoundary.js). No imports, so they are
// unit-tested in plain Node, see tests/errorBoundary.test.mjs.

// One short line about a caught error, safe to show on screen: its message with line breaks folded
// away and cut to `max` characters. Anything thrown that is not an Error (a string, an object, nothing)
// still gives something readable.
export function describeError(error, max = 160) {
  let text = '';
  if (error && typeof error === 'object' && typeof error.message === 'string') text = error.message;
  else if (typeof error === 'string') text = error;
  else if (error != null) { try { text = JSON.stringify(error); } catch { text = String(error); } }
  text = (text || '').replace(/\s+/g, ' ').trim();
  if (!text) return 'Unknown error';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// Whether a boundary that is showing an error should try its children again: when any of the
// `resetKeys` it was given has changed (the theme was switched, say, which remounts the screens).
export function resetKeysChanged(prev = [], next = []) {
  if (prev.length !== next.length) return true;
  return prev.some((v, i) => !Object.is(v, next[i]));
}
