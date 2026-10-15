// Which x-axis labels a chart shows, and where each is anchored. Pure (no React Native imports),
// so it's unit-tested in plain Node, see tests/chartLabels.test.mjs.
//
// This replaces a fixed "every Nth point" step that (a) always added the newest label, even when
// it landed right beside the previous one (the "24 Aug" and "5 Oct" that ran together), and (b)
// allowed so little room per label that neighbours touched.

// A date label such as "29 Dec" or "Jan 26" is about 36pt wide at 11pt text, so ask for 56pt per
// label: the label plus a clear gap.
export const MIN_LABEL_WIDTH = 56;

// Which of `count` evenly spaced points get a label, as a Set of indices.
// `width` is the horizontal room the points actually span. Labels are chosen from the newest
// point backwards, so the latest date is always shown and no two labels are closer than
// `minLabelWidth`. The oldest point is labelled when it falls on that stride (it is never
// squeezed in beside its neighbour: what is left over is always less than one step).
export function labelIndices(count, width, minLabelWidth = MIN_LABEL_WIDTH) {
  const out = new Set();
  if (!(count > 0)) return out;
  if (count === 1 || !(width > 0)) { out.add(count - 1); return out; }
  const slot = width / count;                              // room per point
  const step = Math.max(1, Math.ceil(minLabelWidth / slot));
  for (let i = count - 1; i >= 0; i -= step) out.add(i);
  return out;
}

// 'middle' normally; 'start' or 'end' when a centred label of `labelWidth` would run off the
// left or right edge of a chart `width` wide (the first label used to be cut off).
export function labelAnchor(x, width, labelWidth = 40) {
  if (x - labelWidth / 2 < 0) return 'start';
  if (width > 0 && x + labelWidth / 2 > width) return 'end';
  return 'middle';
}
