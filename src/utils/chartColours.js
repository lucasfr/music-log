// Colours for chart segments, and which text colour is readable on them. Pure (no React Native
// imports), so it's unit-tested in plain Node, see tests/chartColours.test.mjs.
//
// Why this exists: the circle of fifths on Stats colours each key by how much scale work it has had,
// and wrote the key name in the theme's text colour whatever the segment was. That is pale text on
// the palest segments in dark mode, and dark text on the darkest (brown, green) in light mode. The
// ramps were also light-theme only, so their palest steps were near-white slabs on a dark page.

const DARK_TEXT = '#050A0D';
const LIGHT_TEXT = '#FFFFFF';

// '#rgb', '#rrggbb' or 'rgba(r,g,b,a)' -> [r, g, b, a]
function parse(c) {
  if (c[0] === '#') {
    const h = c.length === 4 ? [...c.slice(1)].map(x => x + x).join('') : c.slice(1);
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).concat(1);
  }
  const [r, g, b, a = 1] = c.match(/[\d.]+/g).map(Number);
  return [r, g, b, a];
}

// A translucent colour as it looks over the page behind it, as [r, g, b].
function over(fill, page) {
  const [r, g, b, a] = parse(fill);
  const [pr, pg, pb] = parse(page);
  return [r * a + pr * (1 - a), g * a + pg * (1 - a), b * a + pb * (1 - a)];
}

function luminance([r, g, b]) {
  const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// WCAG contrast ratio between two colours (either may be translucent over `page`).
export function contrast(a, b, page = '#FFFFFF') {
  const [hi, lo] = [luminance(over(a, page)), luminance(over(b, page))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// The text colour, near-black or white, that reads better on `fill` (which may be translucent
// over the page colour `page`).
export function readableOn(fill, page) {
  return contrast(DARK_TEXT, fill, page) >= contrast(LIGHT_TEXT, fill, page) ? DARK_TEXT : LIGHT_TEXT;
}

// Five steps per ramp, least to most practised. On a light page more practice is darker; on a dark
// page it is brighter, so the busiest keys stand out either way.
const RAMPS = {
  amber: {
    cuts: [0.15, 0.35, 0.6, 0.85],
    light: ['#FAEEDA', '#FAC775', '#EF9F27', '#BA7517', '#854F0B'],
    dark:  ['#3A2F16', '#6B4F14', '#A9731B', '#E09A2B', '#FCC15A'],
    none:  'rgba(180,178,170,0.22)',
  },
  teal: {
    cuts: [0.1, 0.3, 0.55, 0.8],
    light: ['#E1F5EE', '#9FE1CB', '#5DCAA5', '#1D9E75', '#0F6E56'],
    dark:  ['#14332D', '#1C5E4E', '#2A8E73', '#43BF97', '#7BE3BF'],
    none:  'rgba(180,178,170,0.15)',
  },
};
export const COVERAGE_KINDS = Object.keys(RAMPS);

// The segment colour for a key practised `n` times when the busiest key has `max`.
export function coverageColour(kind, n, max, dark) {
  const ramp = RAMPS[kind];
  if (!n) return ramp.none;
  const t = n / Math.max(max, 1);
  const steps = dark ? ramp.dark : ramp.light;
  const i = ramp.cuts.findIndex(cut => t < cut);
  return steps[i === -1 ? steps.length - 1 : i];
}
export const coverageRamp = (kind, dark) => RAMPS[kind][dark ? 'dark' : 'light'];
