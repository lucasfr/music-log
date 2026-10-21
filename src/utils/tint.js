// Small colour helpers for tinting UI with the theme's own colours. Pure, so they are unit-tested in
// plain Node, see tests/startCard.test.mjs.

// '#RRGGBB' or '#RGB' with an alpha (0 to 1) -> 'rgba(r, g, b, a)'. A colour that isn't a hex value
// (an rgba() the theme already made, say) is returned as it is.
export function tint(colour, alpha) {
  if (typeof colour !== 'string') return colour;
  const m = colour.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return colour;
  const h = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1];
  const a = Math.min(1, Math.max(0, Number(alpha)));
  return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${Number.isFinite(a) ? +a.toFixed(3) : 1})`;
}

// The theme colours the Start practice shortcuts take, in order: teal first, then amber, rose, green, gold.
export const TILE_ACCENTS = ['steel', 'amber', 'red', 'success', 'gold'];

// The colour name for the nth shortcut, wrapping round when there are more shortcuts than colours.
export const accentKey = index => TILE_ACCENTS[((index % TILE_ACCENTS.length) + TILE_ACCENTS.length) % TILE_ACCENTS.length];
