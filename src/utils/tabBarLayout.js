// How the floating tab bar fits the screen. Pure (no React Native imports), so it's unit-tested in
// plain Node, see tests/tabBarLayout.test.mjs.
//
// With the Timeline tab showing there are seven tabs, which is 370pt wide at the normal spacing:
// tight on a 375pt phone and wider than a 360pt one. The tabs themselves stay 44pt (the touch
// target minimum); the gaps between them, and then the padding at the ends, give way instead.

// count: tabs showing. screenWidth: the window width. Returns { gap, pad, width, fits }.
export function tabBarLayout(count, screenWidth, { icon = 44, label = 58, gap = 4, pad = 12, minPad = 4, margin = 8 } = {}) {
  // the active tab is wider than the others (it shows its name), hence label - icon
  const widthFor = (g, p) => count * icon + (count - 1) * g + 2 * p + (label - icon);
  const room = screenWidth - 2 * margin;
  let g = gap;
  let p = pad;
  while (widthFor(g, p) > room && g > 0) g--;
  while (widthFor(g, p) > room && p > minPad) p--;
  return { gap: g, pad: p, width: widthFor(g, p), fits: widthFor(g, p) <= room };
}
